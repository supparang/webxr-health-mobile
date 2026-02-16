// === /herohealth/vr/ai-hooks.js ===
// AI Hooks — SAFE STUB (deterministic-friendly) — v20260215b
// Purpose: provide window.HHA.createAIHooks() so games can attach AI optionally.
//
// ✅ Default OFF (enabled only when allowed)
// ✅ Deterministic-safe: uses seed(string/number) -> u32 -> mulberry32 for any randomness
// ✅ Rate-limited coach tips, fairness clamps, no external deps
// ✅ Never crashes if game calls missing methods
//
// API:
//   window.HHA.createAIHooks({game, runMode, diff, seed, deterministic}) -> {
//      enabled, deterministic,
//      onEvent(type, payload),
//      getTip(features),                // -> {msg,mood,prio?} | null
//      getPrediction(features),         // -> {type, value, conf} | null
//      getDifficultySignal(features),   // -> {spawnRateMul, sizeMul, junkMul} | null
//      reset()
//   }
//
// Enable rules (SAFE defaults):
// - deterministic (study/research) => enabled=false
// - play => enabled only when ?ai=1 (explicit opt-in) OR window.HHA_AI_FORCE=1
//
// Notes:
// - This is NOT "real ML". It's a safe hook layer with heuristics and stable signals.
// - You can replace this file later with a full ML/DL implementation, keeping the same API.

(function(){
  'use strict';

  const WIN = window;
  WIN.HHA = WIN.HHA || {};

  // If upstream AI exists, do not override.
  if(typeof WIN.HHA.createAIHooks === 'function') return;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return v < a ? a : (v > b ? b : v);
  }

  function u32FromSeed(seed){
    // Accept number/string; stable hash to u32
    const s = String(seed ?? '');
    let h = 2166136261 >>> 0; // FNV-1a
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a){
    let t = (a >>> 0);
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function nowMs(){
    return (performance && performance.now) ? performance.now() : Date.now();
  }

  // -------- tip engine (rate-limited) --------
  function createTipper(rng){
    let lastTipAt = 0;
    let lastTipKey = '';
    let streakSame = 0;

    function canTip(minGapMs){
      const t = nowMs();
      if(t - lastTipAt < minGapMs) return false;
      lastTipAt = t;
      return true;
    }

    function pick(arr){
      return arr[Math.floor(rng()*arr.length)];
    }

    function tipFromFeatures(f){
      // Expect features_1s-like object (plate emits these)
      const acc = Number(f?.accNowPct ?? 0);
      const missD3 = Number(f?.missDelta3s ?? 0);
      const dens = Number(f?.targetDensityAvg3s ?? f?.targetDensity ?? 0);
      const combo = Number(f?.comboNow ?? 0);
      const storm = !!f?.stormActive;
      const boss  = !!f?.bossActive;

      // Priority: boss/storm warnings
      if(boss){
        const key='boss_focus';
        if(key === lastTipKey) streakSame++; else { lastTipKey=key; streakSame=0; }
        if(!canTip(2400)) return null;
        return { msg: pick([
          '👹 บอสอยู่! เล็งให้ชัวร์ แล้วค่อยยิงทีละนัด!',
          '👹 ห้ามพลาด! โฟกัส GOOD ก่อนหมดเวลา!',
          '👹 อย่ารีบยิงมั่ว—ล็อกเป้าให้ติดก่อน!'
        ]), mood:'neutral', prio:3 };
      }

      if(storm){
        const key='storm_fast';
        if(key === lastTipKey) streakSame++; else { lastTipKey=key; streakSame=0; }
        if(!canTip(2200)) return null;
        return { msg: pick([
          '🌪️ พายุมาแล้ว! ยิงเร็วแต่ต้องแม่น!',
          '🌪️ จังหวะสั้น ๆ: เล็ง-ยิง-เล็ง-ยิง จะไม่พลาด!',
          '🌪️ ถ้าห้ามโดนขยะ: เล็ง GOOD เท่านั้น!'
        ]), mood:'fever', prio:3 };
      }

      // Accuracy / Miss coaching
      if(missD3 >= 2 && acc < 78){
        const key='accuracy_low';
        if(key === lastTipKey) streakSame++; else { lastTipKey=key; streakSame=0; }
        if(!canTip(2600)) return null;
        return { msg: pick([
          '🎯 ลองช้าลงนิด—เล็งกลางเป้าแล้วค่อยยิง จะคุม miss ได้!',
          '🎯 อย่าไล่ทุกชิ้น เลือกเป้าที่ใกล้ crosshair ก่อน!',
          '🎯 ถ้าพลาดติดกัน ให้รีเซ็ตจังหวะ: หยุด 0.5s แล้วค่อยยิงต่อ'
        ]), mood:'neutral', prio:2 };
      }

      // Density / overload hints
      if(dens > 0.72 && acc < 85){
        const key='density_high';
        if(key === lastTipKey) streakSame++; else { lastTipKey=key; streakSame=0; }
        if(!canTip(2800)) return null;
        return { msg: pick([
          '⚡ เป้าแน่น! เลือกยิง “ใกล้สุด” ทีละชิ้น จะคุมความแม่นยำได้',
          '⚡ ใช้ aim-assist: ขยับ crosshair ใกล้ศูนย์กลางเป้า แล้วค่อยยิง',
          '⚡ โฟกัสเป้าที่อยู่กลางจอ ก่อนเป้าขอบ ๆ'
        ]), mood:'neutral', prio:1 };
      }

      // Positive reinforcement
      if(combo >= 10 && acc >= 86){
        const key='praise_combo';
        if(key === lastTipKey) streakSame++; else { lastTipKey=key; streakSame=0; }
        if(streakSame > 1) return null; // avoid spam
        if(!canTip(4200)) return null;
        return { msg: pick([
          '🔥 คอมโบสวย! รักษาจังหวะแบบนี้ต่อเลย',
          '✨ แม่นมาก! ตอนนี้เพิ่มสปีดได้อีกนิด',
          '🏆 ฟอร์มดี! เลือกเป้าไวขึ้นอีกหน่อยจะได้คะแนนพุ่ง'
        ]), mood:'happy', prio:0 };
      }

      return null;
    }

    return { tipFromFeatures };
  }

  // -------- difficulty signal (fair clamps) --------
  function createDifficultyDirector(){
    // output multipliers relative to game's own base settings
    let last = { spawnRateMul: 1, sizeMul: 1, junkMul: 1 };
    let lastAt = 0;

    function compute(f){
      const t = nowMs();
      // update at most every 2s (stability)
      if(t - lastAt < 1800) return last;
      lastAt = t;

      const acc = Number(f?.accAvg3s ?? f?.accNowPct ?? 0); // 0..100
      const miss3 = Number(f?.missDelta3s ?? 0);
      const dens = Number(f?.targetDensityAvg3s ?? f?.targetDensity ?? 0);
      const combo = Number(f?.comboMax ?? 0);

      // Normalize signals
      const acc01 = clamp(acc/100, 0, 1);
      const dens01 = clamp(dens, 0, 1);

      // Base: if player strong -> slightly harder; if struggling -> slightly easier
      let spawnMul = 1.0;
      let sizeMul  = 1.0;
      let junkMul  = 1.0;

      // Struggling: low acc or lots of misses => easier
      if(acc01 < 0.72 || miss3 >= 2){
        spawnMul *= 1.10;   // slower spawns (game uses spawnRate ms; mul>1 => slower)
        sizeMul  *= 1.06;   // bigger targets
        junkMul  *= 0.92;   // fewer junk
      }

      // Strong: high acc + sustained combo => harder
      if(acc01 > 0.88 && combo >= 10 && miss3 === 0){
        spawnMul *= 0.90;   // faster spawns
        sizeMul  *= 0.96;   // slightly smaller
        junkMul  *= 1.06;   // slightly more junk
      }

      // Overload protection: if density high, do not increase difficulty further
      if(dens01 > 0.75){
        spawnMul = Math.max(spawnMul, 1.02); // avoid too fast when crowded
      }

      // Fair clamps
      spawnMul = clamp(spawnMul, 0.78, 1.25);
      sizeMul  = clamp(sizeMul,  0.90, 1.12);
      junkMul  = clamp(junkMul,  0.80, 1.18);

      last = { spawnRateMul: spawnMul, sizeMul, junkMul };
      return last;
    }

    return { compute };
  }

  // -------- prediction stub --------
  function createPredictor(rng){
    // Provides a simple "risk" estimate (0..1) as a placeholder.
    let lastOut = null;
    let lastAt = 0;

    function predict(f){
      const t = nowMs();
      if(t - lastAt < 1200) return lastOut;
      lastAt = t;

      const acc = Number(f?.accAvg3s ?? f?.accNowPct ?? 0);
      const miss3 = Number(f?.missDelta3s ?? 0);
      const dens = Number(f?.targetDensityAvg3s ?? f?.targetDensity ?? 0);
      const storm = !!f?.stormActive;
      const boss  = !!f?.bossActive;

      // risk heuristic
      let risk = 0.15;
      risk += (acc < 78) ? 0.25 : 0;
      risk += clamp(miss3/4, 0, 1) * 0.25;
      risk += clamp(dens, 0, 1) * 0.20;
      if(storm) risk += 0.12;
      if(boss)  risk += 0.18;

      // little noise but deterministic from rng
      risk = clamp(risk + (rng()-0.5)*0.06, 0, 1);

      lastOut = { type:'risk_miss_next3s', value: Math.round(risk*100)/100, conf: 0.55 };
      return lastOut;
    }

    return { predict };
  }

  // -------- main factory --------
  WIN.HHA.createAIHooks = function createAIHooks(opts){
    const game = String(opts?.game || 'unknown');
    const runMode = String(opts?.runMode || 'play').toLowerCase();
    const diff = String(opts?.diff || 'normal').toLowerCase();
    const seed = (opts?.seed ?? 0);

    const deterministic = !!opts?.deterministic || (runMode === 'study' || runMode === 'research');

    const force = (String(qs('ai','0')) === '1') || (WIN.HHA_AI_FORCE === 1) || (WIN.HHA_AI_FORCE === true);
    const enabled = (!deterministic) && !!force;

    const rng = mulberry32(u32FromSeed(seed + '|' + game + '|' + diff));

    const tipper = createTipper(rng);
    const director = createDifficultyDirector();
    const predictor = createPredictor(rng);

    // internal state
    let lastFeatures = null;

    function onEvent(type, payload){
      // store last features for prediction/tips if caller passes events
      if(type === 'features_1s') lastFeatures = payload || null;
    }

    function getTip(features){
      if(!enabled) return null;
      const f = features || lastFeatures;
      if(!f) return null;
      return tipper.tipFromFeatures(f);
    }

    function getPrediction(features){
      if(!enabled) return null;
      const f = features || lastFeatures;
      if(!f) return null;
      return predictor.predict(f);
    }

    function getDifficultySignal(features){
      if(!enabled) return null;
      const f = features || lastFeatures;
      if(!f) return null;
      return director.compute(f);
    }

    function reset(){
      lastFeatures = null;
    }

    return {
      enabled,
      deterministic,
      onEvent,
      getTip,
      getPrediction,
      getDifficultySignal,
      reset
    };
  };

})();