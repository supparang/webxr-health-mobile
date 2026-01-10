/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks — OFF by default
✅ attach({runMode, seed, enabled})
✅ Provides window.GroupsVR.__ai = { enabled, director, pattern }
✅ director.spawnSpeedMul(acc, combo, misses) -> multiplier
✅ pattern.bias() -> [-0.08..+0.08] affects wrong/junk rates
*/

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const AIHooks = {
    attach({ runMode='play', seed='', enabled=false } = {}){
      runMode = String(runMode||'play').toLowerCase();
      const on = !!enabled && runMode === 'play';

      const rng = makeRng(hashSeed(String(seed)+'::ai'));

      const director = {
        // ✅ ปรับความเร็วสปอนแบบ "ยุติธรรม": เก่งขึ้น -> เร็วขึ้นเล็กน้อย, พลาดมาก -> ช้าลงเล็กน้อย
        spawnSpeedMul(accPct, combo, misses){
          if (!on) return 1.0;
          accPct = clamp(accPct, 0, 100);
          combo = clamp(combo, 0, 50);
          misses = clamp(misses, 0, 50);

          // base fairness curve
          let m = 1.0;

          // reward skill (slight)
          if (accPct >= 85) m *= 0.94;
          if (accPct >= 92) m *= 0.92;
          if (combo >= 10)  m *= 0.92;

          // help struggling (slight)
          if (misses >= 8)  m *= 1.06;
          if (misses >= 12) m *= 1.10;

          return clamp(m, 0.82, 1.16);
        }
      };

      const pattern = {
        // ✅ bias to modulate wrong/junk rates (small)
        // positive -> more wrong, negative -> less wrong (more junk slightly adjusted by engine)
        bias(){
          if (!on) return 0;
          // slow oscillation
          const v = (rng() * 2 - 1) * 0.06; // [-0.06..+0.06]
          return clamp(v, -0.08, 0.08);
        }
      };

      root.GroupsVR.__ai = { enabled:on, director, pattern, seed:String(seed) };

      // optional event for debug
      try{
        root.dispatchEvent(new CustomEvent('hha:ai', { detail:{ enabled:on, seed:String(seed), runMode } }));
      }catch(_){}

      return root.GroupsVR.__ai;
    }
  };

  NS.AIHooks = AIHooks;

})(typeof window !== 'undefined' ? window : globalThis);