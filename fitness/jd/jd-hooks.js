// === /fitness/jd/jd-hooks.js ===
// Jump-Duck AI Hooks — PRODUCTION (stub)
// ✅ Safe if AI not provided
// ✅ Research deterministic friendly (seed passthrough)
// API: window.JD_AI = createAIHooks(ctx)

'use strict';

(function(){
  const WIN = window;

  function hash32(str){
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createAIHooks(ctx){
    const c = ctx || {};
    const seedStr = String(c.seed ?? (c.pid||'') + '|' + (c.studyId||'') + '|' + (c.phase||''));
    const rnd = mulberry32(hash32(seedStr));

    // --- Difficulty Director (stub) ---
    function getDifficulty(baseDiff, telemetry){
      // telemetry: {acc, missRate, combo, stability, phase, elapsedMs}
      // default: no change
      return { diff: baseDiff, spawnMul: 1.0, speedMul: 1.0, hitWindowMul: 1.0 };
    }

    // --- Coach micro-tips (rate-limited) ---
    let lastTipAt = 0;
    function getTip(telemetry){
      const now = performance.now();
      if (now - lastTipAt < 4500) return null;
      lastTipAt = now;

      if (!telemetry) return null;
      if ((telemetry.missRate||0) > 0.35) return 'ลอง “รอให้เข้าเส้น” แล้วค่อย Jump/Duck นะ';
      if ((telemetry.combo||0) >= 8)      return 'เยี่ยม! รักษา COMBO ไว้!';
      if ((telemetry.stability||100) < 55)return 'ช้าลงนิดนึง คุมลมหายใจให้คงที่';
      return null;
    }

    // --- Pattern Generator (seeded) ---
    function nextObstacleType(phase){
      // return 'high'|'low' with slight phase bias
      const p = phase||1;
      const r = rnd();
      if (p === 1) return r < 0.50 ? 'low' : 'high';
      if (p === 2) return r < 0.48 ? 'low' : 'high';
      return r < 0.52 ? 'low' : 'high';
    }

    function onEvent(_name, _payload){ /* stub */ }

    return { getDifficulty, getTip, nextObstacleType, onEvent };
  }

  WIN.JD_AI = { createAIHooks };
})();