/* === /herohealth/vr/ai/ai-pattern.js ===
HHA AI Pattern Generator (Deterministic by seed)
- Provides pattern decisions for storm/boss/spawn strategy based on "heat"
- Designed to be game-agnostic
Expose: window.HHA_AI.Pattern.create(...)
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

  function pick(rng, arr){
    return arr[(rng()*arr.length)|0];
  }

  function create(opts){
    opts = opts || {};
    const seed = String(opts.seed||Date.now());
    const rng  = makeRng(seed + '::ai-pattern');

    function stormPattern(heat){
      heat = clamp(heat, 0, 1);
      // low heat = burst/wave; high heat = spiral more often
      if (heat >= 0.72) return (rng() < 0.70) ? 'spiral' : 'wave';
      if (heat >= 0.40) return (rng() < 0.55) ? 'wave' : 'burst';
      return (rng() < 0.65) ? 'burst' : 'wave';
    }

    function bossPlan(heat){
      heat = clamp(heat, 0, 1);
      // returns hints: {teleportChance, decoyCountMinMax}
      const tp = clamp(0.15 + heat*0.45, 0.10, 0.65);
      const dMin = (heat >= 0.65) ? 1 : 0;
      const dMax = (heat >= 0.65) ? 2 : 1;
      return { teleportChance: tp, decoyMin: dMin, decoyMax: dMax };
    }

    function spawnStrategy(heat){
      heat = clamp(heat, 0, 1);
      // You can map these in each game: "uniform" | "ring" | "grid9"
      if (heat >= 0.75) return pick(rng, ['ring','grid9']);
      if (heat >= 0.45) return pick(rng, ['uniform','ring']);
      return 'uniform';
    }

    function aimAssistLockPx(heat){
      heat = clamp(heat, 0, 1);
      // higher heat => smaller lock radius (harder)
      return Math.round(clamp(110 - heat*38, 68, 120));
    }

    return { stormPattern, bossPlan, spawnStrategy, aimAssistLockPx };
  }

  HHA.Pattern = { create };

})(typeof window !== 'undefined' ? window : globalThis);