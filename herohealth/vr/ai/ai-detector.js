/* === /herohealth/vr/ai/ai-director.js ===
HHA AI Difficulty Director (Fair + Smooth + Deterministic in research)
- Input: live metrics (acc, combo, fever, rt, misses, junkError)
- Output: tuning suggestions {spawnMs, ttlMs, junkBias, decoyBias, bossEveryMs, stormGapMs}
- Play mode: adaptive + smoothing
- Research mode: returns base by diff only (deterministic, no personalization)
Expose: window.HHA_AI.Director.create(...)
*/

(function(root){
  'use strict';
  const HHA = (root.HHA_AI = root.HHA_AI || {});
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  function baseByDiff(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy')   return { spawnMs:900, ttlMs:1750, junkBias:0.10, decoyBias:0.08, bossEveryMs:22000, stormGapMs:19000 };
    if (diff==='hard')   return { spawnMs:680, ttlMs:1450, junkBias:0.16, decoyBias:0.12, bossEveryMs:16000, stormGapMs:15500 };
    return               { spawnMs:780, ttlMs:1600, junkBias:0.12, decoyBias:0.10, bossEveryMs:19000, stormGapMs:17000 };
  }

  function create(opts){
    opts = opts || {};
    const mode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    const diff = String(opts.diff||'normal').toLowerCase();
    const seed = String(opts.seed||Date.now());
    const rng  = makeRng(seed + '::ai-director');

    const base = baseByDiff(diff);

    // smoothed heat ∈ [0..1]
    let heat = 0.0;

    // last explain
    let explain = 'base';

    // last tuning (smoothed)
    const tuning = {
      spawnMs: base.spawnMs,
      ttlMs: base.ttlMs,
      junkBias: base.junkBias,
      decoyBias: base.decoyBias,
      bossEveryMs: base.bossEveryMs,
      stormGapMs: base.stormGapMs
    };

    function computeHeat(m){
      // m: {acc, combo, fever, avgRtMs, missesRate, junkError}
      const acc = clamp(m.acc ?? 0.0, 0, 1);
      const combo = clamp((m.combo ?? 0)/18, 0, 1);
      const fever = clamp((m.fever ?? 0)/100, 0, 1);
      const rt = clamp((m.avgRtMs ?? 600), 180, 900);
      const rtFast = clamp((900-rt)/720, 0, 1); // 0 slow -> 1 fast
      const missR = clamp(m.missesRate ?? 0, 0, 1);
      const junkE = clamp(m.junkError ?? 0, 0, 1);

      // “เล่นเก่ง” = acc + combo + rtFast สูง, แต่ fever/miss/junkError ต่ำ
      const skill = (acc*0.45 + combo*0.25 + rtFast*0.20);
      const struggle = (fever*0.20 + missR*0.20 + junkE*0.20);

      const h = clamp(skill - struggle + 0.15, 0, 1);

      // explain text (human-readable)
      if (h > 0.75) explain = 'ผู้เล่นคุมได้ดี (acc+combo+เร็ว) → เพิ่มความท้าทายแบบยุติธรรม';
      else if (h < 0.35) explain = 'ผู้เล่นกำลังล้า/พลาด/ไข้สูง → ผ่อนความโหดให้ไหลลื่น';
      else explain = 'สมดุลดี → ปรับเล็กน้อย';
      return h;
    }

    function smooth(nextHeat){
      // smooth with inertia; add tiny seeded noise to avoid “stuck feeling” (play only)
      const target = clamp(nextHeat, 0, 1);
      const a = 0.08; // smoothing factor
      heat = heat*(1-a) + target*a;

      if (mode === 'play'){
        const n = (rng()-0.5) * 0.02;
        heat = clamp(heat + n, 0, 1);
      }
      return heat;
    }

    function update(metrics){
      // In research: strictly base, no personalization
      if (mode === 'research'){
        Object.assign(tuning, base);
        return tuning;
      }

      const h = smooth(computeHeat(metrics||{}));

      // Map heat -> tuning (bounded)
      // Higher heat => faster spawns, shorter ttl, more junk/decoy pressure, more bosses/storms
      const spawnMs = clamp(base.spawnMs - h*260, 480, 980);
      const ttlMs   = clamp(base.ttlMs   - h*280, 1200, 1850);
      const junkBias= clamp(base.junkBias+ h*0.06, 0.08, 0.24);
      const decBias = clamp(base.decoyBias+ h*0.05, 0.06, 0.22);
      const bossEvery = clamp(base.bossEveryMs - h*6000, 14000, 26000);
      const stormGap  = clamp(base.stormGapMs  - h*6500, 12000, 26000);

      // extra fairness: when fever high, don’t stack too much junk
      const feverK = clamp((metrics?.fever ?? 0)/100, 0, 1);
      const fairJ  = clamp(junkBias - feverK*0.03, 0.08, 0.22);

      // smooth tuning to avoid sudden jumps
      const lerp = (a,b,t)=>a+(b-a)*t;
      const k = 0.10;

      tuning.spawnMs = Math.round(lerp(tuning.spawnMs, spawnMs, k));
      tuning.ttlMs   = Math.round(lerp(tuning.ttlMs, ttlMs, k));
      tuning.junkBias= +lerp(tuning.junkBias, fairJ, k).toFixed(4);
      tuning.decoyBias=+lerp(tuning.decoyBias, decBias, k).toFixed(4);
      tuning.bossEveryMs = Math.round(lerp(tuning.bossEveryMs, bossEvery, k));
      tuning.stormGapMs  = Math.round(lerp(tuning.stormGapMs, stormGap, k));

      return tuning;
    }

    function getState(){
      return {
        mode, diff,
        heat: +heat.toFixed(3),
        explain,
        tuning: Object.assign({}, tuning)
      };
    }

    return { update, getState };
  }

  HHA.Director = { create };

})(typeof window !== 'undefined' ? window : globalThis);