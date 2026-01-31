// === /fitness/js/rb-ai-director.js ===
// AI Difficulty Director (play-only). Research-safe.
// Deterministic-ready via seed.
(function(){
  'use strict';

  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function lerp(a,b,t){ return a+(b-a)*t; }

  // Simple deterministic RNG (xorshift32)
  function makeRng(seed){
    let x = (seed|0) || 123456789;
    return function(){
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      // [0,1)
      return ((x>>>0) / 4294967296);
    };
  }

  function pickTip(state){
    // prioritize actionable + short
    if (state.missStreak >= 4) return 'ช้าลงนิด—เล็งเส้นตีให้เป๊ะ แล้วค่อยเร่ง';
    if (state.hp <= 35) return 'HP ต่ำแล้ว! เน้น “Good” ให้ติดก่อน อย่ากดรัว';
    if (state.acc < 60) return 'ลองโฟกัสเลน C ก่อน แล้วค่อยขยายไป L/R';
    if (state.offsetAbsMean > 0.14) return 'จังหวะยังแกว่ง—แตะตอนโน้ต “แตะเส้น” พอดี';
    if (state.combo >= 12 && state.acc >= 85) return 'เริ่มนิ่งแล้ว! ลองเพิ่มความเร็วได้';
    return '';
  }

  function suggestDifficulty(state){
    // stable rules (no ML yet — but feels “AI”)
    if (state.fatigueRisk > 0.75) return 'easy';
    if (state.hp <= 30) return 'easy';
    if (state.acc >= 90 && state.comboAvg >= 8 && state.offsetAbsMean < 0.10) return 'hard';
    if (state.acc >= 78) return 'normal';
    return 'easy';
  }

  function densityScaleFromState(state){
    // base around 1.0
    // if struggling → reduce, if strong → increase slightly
    let s = 1.0;
    s -= clamp((70 - state.acc) / 100, 0, 0.22);     // down to -0.22
    s -= clamp((state.missStreak) * 0.02, 0, 0.10);  // miss streak reduces
    s += clamp((state.acc - 88) / 100, 0, 0.10);     // strong boosts
    s += clamp((state.comboAvg - 6) / 60, 0, 0.06);
    // fatigue reduces density
    s -= clamp((state.fatigueRisk - 0.55) / 3, 0, 0.08);

    return clamp(s, 0.85, 1.20);
  }

  function bossTuning(state){
    // make boss fair: reqCombo + window length adjustments
    const strong = (state.acc >= 86 && state.hp >= 55 && state.offsetAbsMean < 0.12);
    const weak   = (state.acc < 65 || state.hp < 40);

    return {
      mirrorLenSec: strong ? 7.0 : weak ? 5.0 : 6.0,
      holdLenSec:   strong ? 7.0 : weak ? 5.0 : 6.0,
      reqComboDelta: strong ? +1 : weak ? -2 : 0
    };
  }

  class RBAIDirector{
    constructor(opts={}){
      this.enabled = !!opts.enabled;
      this.seed = (opts.seed|0) || 0;
      this.rng = makeRng(this.seed || (Date.now()|0));

      this.lastTipAt = 0;
      this.tipCooldownMs = 1800; // rate limit
      this.state = {
        fatigueRisk: 0,
        skillScore: 0.5,
        acc: 0,
        hp: 100,
        combo: 0,
        comboAvg: 0,
        missStreak: 0,
        offsetAbsMean: 0.12
      };

      this._comboSum = 0;
      this._comboCount = 0;
    }

    updateFromEngine(engine){
      if (!this.enabled || !engine) return null;

      // derive stats
      const totalNotes = engine.totalNotes || 1;
      const judged = engine.hitPerfect + engine.hitGreat + engine.hitGood + engine.hitMiss;
      const acc = judged ? ((judged - engine.hitMiss) / totalNotes) * 100 : 0;

      // miss streak (engine doesn't store → infer from last event? we'll keep simple: if combo==0 and miss increased)
      // engine can provide hitMiss; we track if it changed
      if (this._lastMiss == null) this._lastMiss = engine.hitMiss|0;
      const missNow = engine.hitMiss|0;
      if (missNow > this._lastMiss) this.state.missStreak += (missNow - this._lastMiss);
      else if (engine.combo > 0) this.state.missStreak = 0;
      this._lastMiss = missNow;

      // combo avg (rough)
      this._comboSum += engine.combo;
      this._comboCount++;
      const comboAvg = this._comboCount ? (this._comboSum / this._comboCount) : engine.combo;

      // timing stability
      const offsetAbsMean = (engine.offsetsAbs && engine.offsetsAbs.length)
        ? (engine.offsetsAbs.reduce((s,v)=>s+v,0) / engine.offsetsAbs.length)
        : 0.12;

      // connect with existing ai-predictor if present
      let fatigueRisk = 0.0;
      let skillScore  = 0.5;
      if (window.AIPredictor && typeof window.AIPredictor.get === 'function') {
        const a = window.AIPredictor.get();
        fatigueRisk = clamp(a.fatigueRisk||0, 0, 1);
        skillScore  = clamp(a.skillScore||0.5, 0, 1);
      } else {
        // fallback heuristic
        fatigueRisk = clamp((1 - acc/100)*0.6 + (engine.hpUnder50Time>3?0.2:0) + (engine.hp<35?0.2:0), 0, 1);
        skillScore  = clamp(acc/100, 0, 1);
      }

      this.state.fatigueRisk = fatigueRisk;
      this.state.skillScore  = skillScore;
      this.state.acc = acc;
      this.state.hp = engine.hp|0;
      this.state.combo = engine.combo|0;
      this.state.comboAvg = comboAvg;
      this.state.offsetAbsMean = offsetAbsMean;

      const suggestedDifficulty = suggestDifficulty(this.state);
      const chartDensityScale   = densityScaleFromState(this.state);
      const tune = bossTuning(this.state);

      // micro tip (rate-limited)
      let tip = '';
      const now = performance.now();
      if (now - this.lastTipAt > this.tipCooldownMs) {
        tip = pickTip(this.state);
        if (tip) this.lastTipAt = now;
      }

      return {
        fatigueRisk,
        skillScore,
        suggestedDifficulty,
        chartDensityScale,
        bossTuning: tune,
        tip
      };
    }

    // Deterministic thinning/boosting for chart events
    // scale <1 => drop some notes; scale >1 => duplicate some notes (carefully)
    resampleChart(chart, scale, durationSec){
      if (!this.enabled || !Array.isArray(chart) || !chart.length) return chart;
      const s = clamp(scale, 0.85, 1.20);
      if (Math.abs(s - 1.0) < 0.02) return chart;

      const rng = this.rng;
      const out = [];

      // drop chance when scale < 1
      const dropP = (s < 1) ? clamp(1 - s, 0, 0.20) : 0;

      for (const ev of chart) {
        if (!ev || ev.type !== 'note') { out.push(ev); continue; }

        // never drop very early first seconds (avoid empty start)
        const protect = (ev.time < 4.0);
        if (dropP > 0 && !protect) {
          const r = rng();
          if (r < dropP) continue;
        }

        out.push(ev);

        // boost: occasionally add an extra note nearby (small offset)
        if (s > 1) {
          const addP = clamp((s - 1) * 0.22, 0, 0.06);
          const r = rng();
          if (r < addP) {
            const dt = 0.18 + rng()*0.12; // 180–300ms after
            const t2 = ev.time + dt;
            if (t2 < (durationSec || 32) - 2.0) {
              out.push({ time: t2, lane: ev.lane, type: 'note' });
            }
          }
        }
      }

      out.sort((a,b)=>a.time-b.time);
      return out;
    }
  }

  window.RBAIDirector = RBAIDirector;
})();