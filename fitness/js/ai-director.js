// === /fitness/js/ai-director.js ===
// AI Difficulty Director + Pattern Generator (seeded) for Rhythm Boxer
// ✅ play only (engine decides gating)
// ✅ deterministic by seed (mulberry32)

(function(){
  'use strict';

  function clamp(v,a,b){ return v<a?a : v>b?b : v; }

  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // tiny “model” (DL-lite) weights can be overridden by window.RB_AI_MODEL
  function dlLiteSkill(x){
    // x: {acc, missRate, blankRate, offsetStd, hpNorm}
    const M = window.RB_AI_MODEL || {
      // weights are heuristic; replace with trained later
      b: -0.15,
      w_acc:  2.10,
      w_miss: -1.10,
      w_blank:-0.60,
      w_std:  -1.30,
      w_hp:    0.55
    };
    const z =
      (M.b||0) +
      (M.w_acc||0) * (x.acc||0) +
      (M.w_miss||0) * (x.missRate||0) +
      (M.w_blank||0) * (x.blankRate||0) +
      (M.w_std||0) * clamp((x.offsetStd||0)/0.18, 0, 1) +
      (M.w_hp||0) * (x.hpNorm||1);
    // sigmoid
    return 1 / (1 + Math.exp(-z));
  }

  class RbAiDirector{
    constructor(opts={}){
      this.cfg = Object.assign({
        updateEverySec: 2.0,
        stormChance: 0.35,
        stormMinStartSec: 18,
        stormDurSec: 5.0
      }, opts);

      this.seed = (opts.seed|0) || (Date.now()|0);
      this.rand = mulberry32(this.seed);

      this.lastUpdateAt = -999;
      this.state = {
        level: 0.50,          // 0..1
        density: 1.00,        // multiplier baseline
        hitWindowScale: 1.00, // >1 easier, <1 harder
        pattern: 'base',      // base|storm|drillL|drillR
        patternEndTime: 0
      };
    }

    update(songTime, agg, predictorOut){
      const st = this.state;
      if(songTime - this.lastUpdateAt < this.cfg.updateEverySec) return st;
      this.lastUpdateAt = songTime;

      // ----- compute skill & fatigue -----
      const acc = clamp((agg.acc||0), 0, 1);
      const missRate = clamp((agg.missRate||0), 0, 1);
      const blankRate = clamp((agg.blankRate||0), 0, 1);
      const offsetStd = Math.max(0, agg.offsetStd||0);
      const hpNorm = clamp((agg.hp||1), 0, 1);

      const skillDL = dlLiteSkill({acc, missRate, blankRate, offsetStd, hpNorm});
      const fatigue = predictorOut && predictorOut.fatigueRisk != null
        ? clamp(predictorOut.fatigueRisk, 0, 1)
        : clamp((1-hpNorm)*0.55 + missRate*0.25 + blankRate*0.20, 0, 1);

      // ----- target level: rise with skill, fall with fatigue -----
      let target = clamp(0.15 + 0.95*skillDL - 0.65*fatigue, 0, 1);

      // smooth
      st.level = clamp(st.level*0.70 + target*0.30, 0, 1);

      // ----- map to knobs -----
      // density: 0.8..1.6
      st.density = 0.80 + st.level * 0.80;

      // hit windows: 1.25(easy) .. 0.85(hard)
      st.hitWindowScale = 1.25 - st.level * 0.40;

      // ----- pattern: storm near end if player is strong & not fatigued -----
      const canStorm =
        songTime >= this.cfg.stormMinStartSec &&
        st.level > 0.62 &&
        fatigue < 0.55 &&
        songTime > st.patternEndTime;

      if(canStorm && this.rand() < this.cfg.stormChance){
        st.pattern = 'storm';
        st.patternEndTime = songTime + this.cfg.stormDurSec;
      }else if(songTime > st.patternEndTime){
        st.pattern = 'base';
      }

      // weak-side drill (if predictor suggests)
      if(predictorOut && predictorOut.training && songTime > st.patternEndTime){
        st.pattern = predictorOut.training.side === 'L' ? 'drillL' : 'drillR';
        st.patternEndTime = songTime + (predictorOut.training.durationSec||9);
      }

      return st;
    }

    pickLane(bias){ // bias: 'L'|'R'|null
      // lanes: 0,1,2,3,4
      const r = this.rand();
      if(bias === 'L'){
        if(r < 0.45) return 0;
        if(r < 0.90) return 1;
        return 2;
      }
      if(bias === 'R'){
        if(r < 0.45) return 4;
        if(r < 0.90) return 3;
        return 2;
      }
      // base: favor center a bit
      if(r < 0.20) return 2;
      if(r < 0.40) return 1;
      if(r < 0.60) return 3;
      if(r < 0.80) return 0;
      return 4;
    }
  }

  window.RbAiDirector = RbAiDirector;
})();