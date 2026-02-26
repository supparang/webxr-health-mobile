<!-- === /herohealth/ai/ai-hooks.js ===
HeroHealth AI Hooks — SAFE STUB (Standalone, no modules)
✅ Attach as: window.HHA.createAIHooks(opts)
✅ Default OFF (especially research/practice)
✅ Enable only when run=play AND ?ai=1
✅ Deterministic knobs via seed hashing (no learning in research)
✅ Provides:
   - onEvent(name,payload)
   - getDifficulty() -> multiplier (1.0 default)
   - getTip(nowMs?) -> {text,mood,why} | null (rate-limited)
   - getPatternHint() -> small deterministic hint (optional)
*/
(function(){
  'use strict';

  const WIN = window;

  WIN.HHA = WIN.HHA || {};

  // ---- tiny utils ----
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function strSeedToU32(s){
    s = String(s ?? '');
    if (!s) s = String(Date.now());
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  // mulberry32
  function makeRng(seedU32){
    let t = seedU32 >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function nowMs(){
    try{ return performance.now(); }catch(_){ return Date.now(); }
  }

  // ---- policy: enable only play + ai=1 ----
  function isEnabledByPolicy(runMode){
    runMode = String(runMode||'play').toLowerCase();
    if (runMode === 'research') return false;
    if (runMode === 'practice') return false;

    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on === '1' || on === 'true');
  }

  // ---- main factory ----
  WIN.HHA.createAIHooks = function createAIHooks(opts){
    opts = opts || {};
    const game = String(opts.game||'').toLowerCase() || 'unknown';
    const runMode = String(opts.runMode||'play').toLowerCase();
    const diff = String(opts.diff||'normal').toLowerCase();
    const seed = String(opts.seed||qs('seed','')||Date.now());

    const enabled = !!opts.enabled && isEnabledByPolicy(runMode);
    const u32 = strSeedToU32(game + '|' + seed + '|' + diff);
    const rng = makeRng(u32);

    // --- internal state (lightweight, no learning persistence) ---
    const S = {
      enabled,
      game,
      runMode,
      diff,
      seed,

      // difficulty director state (multiplier)
      dMul: 1.0,

      // simple rolling counters
      shots: 0,
      good: 0,
      miss: 0,
      combo: 0,

      // tip rate limit
      lastTipAt: 0,
      tipCooldownMs: 1800,

      // last event timestamp
      lastEventAt: 0,

      // deterministic “personality”
      persona: (rng() < 0.5) ? 'coach' : 'director'
    };

    function accPct(){
      return (S.shots > 0) ? Math.round((S.good / S.shots) * 100) : 0;
    }

    // ---- Difficulty Director (very simple, fair, bounded) ----
    // getDifficulty() returns multiplier applied to spawn interval in engine
    function recomputeDifficulty(){
      // no hard adaptation; just soft nudges (bounded), resets each run
      // Good performance -> slightly faster spawn (mul < 1), Struggle -> slightly slower (mul > 1)
      const acc = accPct();

      // baseline by diff (optional)
      let base = 1.0;
      if (diff === 'easy') base = 1.03;
      if (diff === 'hard') base = 0.97;

      // soft curve
      let adj = 1.0;
      if (S.shots >= 8){
        if (acc >= 88 && S.miss <= 1) adj = 0.93;
        else if (acc >= 78) adj = 0.97;
        else if (acc >= 62) adj = 1.02;
        else adj = 1.10;
      }

      // combo spice: reward flow (tiny)
      if (S.combo >= 8) adj *= 0.98;
      if (S.combo === 0 && S.miss >= 3) adj *= 1.04;

      // deterministic jitter (tiny) to avoid “robotic”
      const jit = 0.995 + (rng()*0.01); // 0.995..1.005

      S.dMul = clamp(base * adj * jit, 0.85, 1.18);
    }

    // ---- AI Coach tips (explainable micro-tips) ----
    function pickTip(){
      const acc = accPct();
      // tips are explainable: why = metric snapshot
      if (S.shots < 6){
        return { text:'เล็งกลางเป้า แล้วค่อยยิงนะ 🎯', mood:'neutral', why:`shots=${S.shots}` };
      }
      if (acc < 60){
        return { text:'ช้าลงนิด แล้วอ่านชื่อหมู่ก่อนยิง ✅', mood:'neutral', why:`acc=${acc}%` };
      }
      if (S.miss >= 4){
        return { text:'อย่ารีบยิงมั่ว! รอเป้าที่ใช่ แล้วค่อยยิง 💡', mood:'sad', why:`miss=${S.miss}` };
      }
      if (S.combo >= 10){
        return { text:'คอมโบโหดมาก! รักษาจังหวะไว้ 🔥', mood:'happy', why:`combo=${S.combo}` };
      }
      if (acc >= 85){
        return { text:'แม่นมาก! เพิ่มสปีดอีกนิดได้ 😈', mood:'fever', why:`acc=${acc}%` };
      }
      return { text:'ดีอยู่! โฟกัส “หมู่ปัจจุบัน” แล้วคอมโบจะมาเอง ✨', mood:'happy', why:`acc=${acc}%` };
    }

    function getTip(tNow){
      if (!S.enabled) return null;
      tNow = Number(tNow)||nowMs();
      if ((tNow - S.lastTipAt) < S.tipCooldownMs) return null;
      S.lastTipAt = tNow;
      return pickTip();
    }

    // ---- Pattern generator hint (seeded, optional) ----
    function getPatternHint(){
      if (!S.enabled) return null;
      // purely deterministic “flavor”, not changing gameplay
      const v = rng();
      if (v < 0.33) return { hint:'แพทเทิร์นวันนี้: เน้นเป้าถูกหมู่ 2 ตัวติด', why:'seeded' };
      if (v < 0.66) return { hint:'แพทเทิร์นวันนี้: รอจังหวะ แล้วยิง 1-2-1', why:'seeded' };
      return { hint:'แพทเทิร์นวันนี้: คุมคอมโบ อย่าเสียจากยิงผิดหมู่', why:'seeded' };
    }

    // ---- event sink ----
    function onEvent(name, payload){
      if (!S.enabled) return;
      name = String(name||'');
      payload = payload || {};
      S.lastEventAt = nowMs();

      // update counters from known events (GroupsVR sends these)
      if (name === 'run:start'){
        S.shots = 0; S.good = 0; S.miss = 0; S.combo = 0;
        recomputeDifficulty();
        return;
      }

      if (name === 'shot:miss'){
        S.shots++;
        S.miss++;
        S.combo = 0;
        recomputeDifficulty();
        return;
      }

      if (name === 'shot:hit_good'){
        S.shots++;
        S.good++;
        S.combo = clamp(Number(payload.combo||0), 0, 99);
        recomputeDifficulty();
        return;
      }

      if (name === 'shot:hit_bad'){
        S.shots++;
        S.miss++;
        S.combo = 0;
        recomputeDifficulty();
        return;
      }

      if (name === 'target:timeout_miss'){
        S.miss++;
        S.combo = 0;
        recomputeDifficulty();
        return;
      }

      // mini/boss signals can nudge tips (not required)
      if (name === 'mini:start' || name === 'boss:spawn'){
        // shorten tip cooldown a bit to react
        S.tipCooldownMs = 1400;
        return;
      }
      if (name === 'boss:down'){
        S.tipCooldownMs = 1800;
        return;
      }

      if (name === 'run:end'){
        // freeze, no persistence
        return;
      }
    }

    function getDifficulty(){
      if (!S.enabled) return 1.0;
      return clamp(S.dMul, 0.85, 1.18);
    }

    return {
      enabled: S.enabled,
      game: S.game,
      seed: S.seed,
      runMode: S.runMode,

      onEvent,
      getDifficulty,
      getTip,
      getPatternHint
    };
  };

})();
