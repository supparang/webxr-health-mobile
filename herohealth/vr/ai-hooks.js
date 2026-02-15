// === /herohealth/vr/ai-hooks.js ===
// HHA AI Hooks — SAFE (no-crash) — PRODUCTION v20260215a
// ✅ window.HHA.createAIHooks({game, runMode, diff, seed, deterministic})
// ✅ Never crashes if consumer calls missing methods
// ✅ Study/Research => deterministic=true => tips/adaptive OFF by default
// ✅ Supports Plate ML-1: consumes events 'features_1s' and 'judge'
// ✅ Explainable micro-tips (rate-limited) + simple prediction (heuristic)
// NOTE: This is a "hook layer" — keeps logic safe + small; can be swapped with real ML later.

'use strict';

(function(){
  const WIN = window;

  // If already present, keep the existing (avoid double define)
  if(WIN.HHA && typeof WIN.HHA.createAIHooks === 'function') return;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mkTip(msg, mood='neutral', meta){
    const o = { msg, mood };
    if(meta && typeof meta === 'object') Object.assign(o, meta);
    return o;
  }

  function safeObj(){
    return {
      enabled:false,
      deterministic:true,
      onEvent(){},
      getTip(){ return null; },
      getPrediction(){ return null; },
      getDifficultySignal(){ return null; },
      reset(){}
    };
  }

  function createAIHooks(cfg){
    cfg = cfg || {};
    const game = String(cfg.game || '').toLowerCase();
    const runMode = String(cfg.runMode || 'play').toLowerCase();
    const diff = String(cfg.diff || 'normal').toLowerCase();
    const seed = Number(cfg.seed || 0) || 0;
    const deterministic = !!cfg.deterministic || (runMode === 'study' || runMode === 'research');

    // In deterministic modes, keep everything OFF (research-safe)
    const enabled = !deterministic;

    const rng = seededRng(seed || 13579);

    // --- internal state ---
    const S = {
      lastTipAt: 0,
      tipCooldownMs: 3800,
      lastEventAt: 0,

      // rolling signals from features_1s
      lastFeat: null,

      // simple counters
      nGood: 0,
      nJunk: 0,
      nExpire: 0,
      nMiss: 0,

      // "prediction" cache
      pred: null
    };

    function reset(){
      S.lastTipAt = 0;
      S.lastEventAt = 0;
      S.lastFeat = null;
      S.nGood = 0;
      S.nJunk = 0;
      S.nExpire = 0;
      S.nMiss = 0;
      S.pred = null;
    }

    function shouldTip(){
      if(!enabled) return false;
      const t = now();
      if(t - S.lastTipAt < S.tipCooldownMs) return false;
      return true;
    }

    function commitTip(){
      S.lastTipAt = now();
    }

    // --- heuristics by game ---
    function tipForPlate(feat){
      // feat: emitted from plate.safe.js (hha:features_1s)
      // common fields:
      //  accNowPct, missDelta3s, targetDensityAvg3s, groupImbalance01, spawnRatePerSec, stormActive, bossActive
      if(!feat) return null;

      const acc = Number(feat.accNowPct||0);
      const miss3 = Number(feat.missDelta3s||0);
      const dens = Number(feat.targetDensityAvg3s!=null ? feat.targetDensityAvg3s : feat.targetDensity);
      const imb  = Number(feat.groupImbalance01||0);
      const storm = !!feat.stormActive;
      const boss  = !!feat.bossActive;

      // Boss/Storm tips (high priority)
      if(boss){
        if(acc < 78) return mkTip('👹 ช่วงบอส: เล็งช้าๆ แต่ชัวร์ — อย่าโดนขยะเด็ดขาด!', 'neutral', { tag:'boss_focus' });
        return mkTip('👹 บอสมาแล้ว: โฟกัส GOOD ให้ครบก่อนหมดเวลา!', 'neutral', { tag:'boss_goal' });
      }
      if(storm){
        if(miss3 > 0) return mkTip('🌪️ พายุ: อย่าฝืนยิงไกล — ขยับเล็งให้เข้า lock ก่อนยิง!', 'fever', { tag:'storm_lock' });
        return mkTip('🌪️ พายุ: เก็บ GOOD รัว ๆ แต่ห้ามหลุดโซนปลอดภัย!', 'fever', { tag:'storm_speed' });
      }

      // General tips
      if(miss3 >= 2) return mkTip('🎯 พลาดติดกัน! ลดสปีดนิดนึง แล้วเล็งให้เข้า “วงล็อก” ก่อนยิง', 'sad', { tag:'miss_streak' });
      if(acc < 70) return mkTip('🎯 ลองโฟกัสที่เป้าชิ้นใหญ่ใกล้ ๆ ก่อน จะดันความแม่นยำขึ้นไว', 'neutral', { tag:'acc_low' });

      // too dense => prioritize nearest
      if(dens >= 0.72) return mkTip('🧠 เป้าแน่น! เก็บใกล้สุดก่อน จะคอมโบต่อเนื่องง่ายขึ้น', 'neutral', { tag:'density_high' });

      // imbalance => chase missing groups
      if(imb >= 0.55) return mkTip('🍽️ หมู่ยังไม่บาลานซ์ — เก็บหมู่ที่ยังน้อย เพื่อให้ครบ 5 หมู่เร็วขึ้น', 'neutral', { tag:'imbalance' });

      // good performance occasional praise
      if(acc >= 86 && miss3 === 0 && rng() < 0.25) return mkTip('สุดยอด! ความแม่นยำดีมาก 🔥 รักษาจังหวะนี้ไว้', 'happy', { tag:'praise' });

      return null;
    }

    // simple prediction: "risk of miss soon" + "likely grade band"
    function predictPlate(feat){
      if(!feat) return null;

      const acc = Number(feat.accNowPct||0);
      const miss3 = Number(feat.missDelta3s||0);
      const dens = Number(feat.targetDensityAvg3s!=null ? feat.targetDensityAvg3s : feat.targetDensity);
      const rate = Number(feat.spawnRatePerSec||0);
      const boss = !!feat.bossActive;
      const storm = !!feat.stormActive;

      // risk: 0..1
      let risk = 0.15;
      if(acc < 72) risk += 0.25;
      if(miss3 >= 2) risk += 0.30;
      if(dens > 0.70) risk += 0.10;
      if(rate > 1.2) risk += 0.10;
      if(storm) risk += 0.18;
      if(boss)  risk += 0.22;

      risk = clamp(risk, 0, 1);

      // grade band guess purely from scoreNow + acc
      const score = Number(feat.scoreNow||0);
      let band = 'C';
      if(score >= 2200 && acc >= 88) band='S';
      else if(score >= 1700 && acc >= 82) band='A';
      else if(score >= 1200 && acc >= 75) band='B';
      else if(score >= 700 && acc >= 68) band='C';
      else band='D';

      return {
        game:'plate',
        tPlayedSec: feat.tPlayedSec|0,
        riskMissSoon01: Math.round(risk*1000)/1000,
        gradeBand: band,
        why: {
          accNowPct: acc,
          missDelta3s: miss3,
          density: Math.round(dens*1000)/1000,
          spawnRatePerSec: Math.round(rate*100)/100,
          bossActive: boss,
          stormActive: storm
        }
      };
    }

    // difficulty signal: return suggestion only (engine decides)
    function difficultySignalPlate(feat){
      if(!feat) return null;
      if(!enabled) return null;

      const acc = Number(feat.accNowPct||0);
      const miss3 = Number(feat.missDelta3s||0);

      // Suggest: -1 easier, 0 keep, +1 harder
      let s = 0;
      if(acc >= 88 && miss3 === 0) s = +1;
      else if(acc < 70 && miss3 >= 1) s = -1;

      return { game:'plate', signal:s, accNowPct:acc, missDelta3s:miss3, tPlayedSec: feat.tPlayedSec|0 };
    }

    function onEvent(type, payload){
      try{
        S.lastEventAt = now();

        if(type === 'judge' && payload){
          const k = String(payload.kind||'').toLowerCase();
          if(k === 'good') S.nGood++;
          else if(k === 'junk') { S.nJunk++; S.nMiss++; }
          else if(k === 'expire_good') { S.nExpire++; S.nMiss++; }
        }

        if(type === 'features_1s' && payload){
          S.lastFeat = payload;

          // update prediction cache
          if(game === 'plate'){
            S.pred = predictPlate(payload);
          }
        }
      }catch{}
    }

    function getTip(feat){
      if(!enabled) return null;
      if(!shouldTip()) return null;

      let tip = null;
      if(game === 'plate') tip = tipForPlate(feat || S.lastFeat);

      if(tip && tip.msg){
        commitTip();
        return tip;
      }
      return null;
    }

    function getPrediction(feat){
      // allow in deterministic too (read-only), but keep it safe
      const f = feat || S.lastFeat;
      if(game === 'plate'){
        return predictPlate(f);
      }
      return null;
    }

    function getDifficultySignal(feat){
      if(!enabled) return null;
      const f = feat || S.lastFeat;
      if(game === 'plate'){
        return difficultySignalPlate(f);
      }
      return null;
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
  }

  // attach namespace
  WIN.HHA = WIN.HHA || {};
  WIN.HHA.createAIHooks = createAIHooks;

})();
