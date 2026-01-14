// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks — SAFE STUB that can be enabled in PLAY only (?ai=1)
// ✅ Deterministic by seed
// ✅ Director: spawn speed multiplier (fair, explainable)
// ✅ Pattern: bias wrong/junk distribution (gentle)
// ✅ Tip: coach micro-tips (rate-limited)
// Notes:
// - research/practice: forced OFF by caller (A) and by attach guard here.

(function(root){
  'use strict';
  const DOC = root.document;
  const NS  = root.GroupsVR = root.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v); if(!isFinite(v)) v=a; return v<a?a:(v>b?b:v); }

  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let s = (seedU32>>>0) || 1;
    return function(){
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} }

  // internal state
  const AI = {
    enabled:false,
    runMode:'play',
    seed:'',
    rng:null,
    lastTipAt:0,
    attach(ctx){
      ctx = ctx || {};
      const runMode = String(ctx.runMode||'play').toLowerCase();
      const enabled = !!ctx.enabled;

      // Hard safety: never in research/practice
      if (runMode !== 'play') {
        this.enabled = false;
        this.runMode = runMode;
        NS.__ai = null;
        return;
      }

      this.enabled = enabled;
      this.runMode = runMode;
      this.seed = String(ctx.seed||'');
      this.rng = makeRng(hashSeed(this.seed + '::ai'));

      if (!this.enabled) { NS.__ai = null; return; }

      // expose as __ai for engine to consult
      NS.__ai = {
        director: this._makeDirector(),
        pattern:  this._makePattern(),
        tip:      (text,mood)=> this.tip(text,mood),
      };

      this.tip('AI เปิดแล้ว ✅ (ช่วยปรับความยากแบบยุติธรรม)', 'happy');
    },

    // Director: fair adjustments (not spiky)
    _makeDirector(){
      const self = this;
      return {
        // accPct: 0..100, combo/misses are ints
        spawnSpeedMul(accPct, combo, misses){
          if (!self.enabled) return 1.0;

          accPct = clamp(accPct, 0, 100);
          combo  = Math.max(0, combo|0);
          misses = Math.max(0, misses|0);

          // Fair: if doing well -> slightly faster; if struggling -> slightly slower
          let mul = 1.0;
          if (accPct >= 88) mul *= 0.94;
          if (accPct >= 94) mul *= 0.92;

          if (combo >= 8) mul *= 0.92;
          if (combo >= 12) mul *= 0.90;

          if (misses >= 6) mul *= 1.06;
          if (misses >= 10) mul *= 1.10;

          return clamp(mul, 0.86, 1.18);
        }
      };
    },

    // Pattern bias: gentle bias (engine uses it to tweak wrongRate/junkRate)
    _makePattern(){
      const self = this;
      let drift = 0;
      return {
        bias(){
          if (!self.enabled) return 0;

          // slowly drift bias within [-0.10..+0.10]
          const r = self.rng ? self.rng() : Math.random();
          drift += (r - 0.5) * 0.02;
          drift = clamp(drift, -0.10, 0.10);

          // meaning:
          // +bias -> more wrong, less junk (engine may interpret)
          // -bias -> less wrong, more junk
          return drift;
        }
      };
    },

    // rate-limited coach tips
    tip(text, mood){
      if (!this.enabled) return;
      const t = nowMs();
      if (t - this.lastTipAt < 1600) return;
      this.lastTipAt = t;
      emit('hha:coach', { text:String(text||''), mood:String(mood||'neutral') });
    }
  };

  NS.AIHooks = AI;

})(typeof window !== 'undefined' ? window : globalThis);