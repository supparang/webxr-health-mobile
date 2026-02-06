// === /fitness/js/dl-features.js ===
// Feature extraction for Shadow Breaker (heuristics → ML-ready)
// ✅ Export: FeatureTracker
// Snapshot-ish inputs you pass:
//   { score, combo, miss, rtMs, feverPct, shield, bossHpPct, youHpPct, phase, tSec, tMaxSec }
// Output vector matches AIPredictor.FEATURE_ORDER

'use strict';

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

export class FeatureTracker {
  constructor(){
    this.reset();
  }

  reset(){
    this.lastT = 0;
    this.lastScore = 0;
    this.lastCombo = 0;
    this.lastMiss = 0;

    this.rtEma = 320;          // ms
    this.rtVarEma = 0;         // variance proxy
    this.hitRateEma = 0;       // hits/sec proxy
    this.missRateEma = 0;      // miss/sec proxy
    this.comboStabEma = 0.5;   // stability
    this.fatigueEma = 0.0;     // heuristic fatigue
  }

  // update with current state; dt is computed from tSec
  update(s){
    const t = Number(s.tSec) || 0;
    const dt = clamp(t - (this.lastT || 0), 0, 2.0);
    const score = Number(s.score) || 0;
    const combo = Number(s.combo) || 0;
    const miss  = Number(s.miss)  || 0;

    const dScore = score - (this.lastScore || 0);
    const dCombo = combo - (this.lastCombo || 0);
    const dMiss  = miss  - (this.lastMiss  || 0);

    // rates
    const hitsThis = dScore > 0 ? 1 : 0; // coarse: score increment usually means a hit
    const hitRate = dt > 0 ? hitsThis / dt : 0;
    const missRate = dt > 0 ? dMiss / dt : 0;

    // reaction time (if provided)
    const rt = Number(s.rtMs);
    if (Number.isFinite(rt) && rt > 0){
      const a = 0.12;
      const prev = this.rtEma;
      this.rtEma = prev + a * (rt - prev);
      const diff = rt - prev;
      this.rtVarEma = (1 - a) * this.rtVarEma + a * (diff * diff);
    }

    // ema rates
    {
      const a = 0.10;
      this.hitRateEma  = (1-a)*this.hitRateEma  + a*hitRate;
      this.missRateEma = (1-a)*this.missRateEma + a*missRate;
    }

    // combo stability: combo goes up -> stable, drops -> unstable
    {
      const a = 0.12;
      const stab = dCombo >= 0 ? 1 : 0;
      this.comboStabEma = (1-a)*this.comboStabEma + a*stab;
    }

    // fatigue: rises if miss rate high, rt worse, hp low
    {
      const youHp = clamp((Number(s.youHpPct) || 1), 0, 1);
      const bossHp = clamp((Number(s.bossHpPct) || 1), 0, 1);

      const rtScore = clamp(1 - (this.rtEma / 520), 0, 1);
      const missScore = clamp(this.missRateEma / 2.5, 0, 1);
      const hpRisk = clamp(1 - youHp, 0, 1);

      const fatigue = clamp( missScore*0.45 + (1-rtScore)*0.35 + hpRisk*0.20, 0, 1);
      const a = 0.08;
      this.fatigueEma = (1-a)*this.fatigueEma + a*fatigue;

      // (optional) small bonus when boss low but player stable -> lower fatigue perceived
      if (bossHp < 0.25 && this.comboStabEma > 0.7) {
        this.fatigueEma *= 0.98;
      }
    }

    this.lastT = t;
    this.lastScore = score;
    this.lastCombo = combo;
    this.lastMiss = miss;
  }

  // produce ML-ready vector in AIPredictor.FEATURE_ORDER
  toVector(s){
    const t = Number(s.tSec) || 0;
    const tMax = Math.max(1, Number(s.tMaxSec) || 1);
    const timeNorm = clamp(t / tMax, 0, 1);

    const fever = clamp((Number(s.feverPct) || 0), 0, 1);
    const shield = clamp((Number(s.shield) || 0) / 3, 0, 1); // assume cap ~3
    const phase = clamp(((Number(s.phase) || 1) - 1) / 4, 0, 1); // up to 5 phases → 0..1

    const youHp = clamp((Number(s.youHpPct) || 1), 0, 1);
    const bossHp = clamp((Number(s.bossHpPct) || 1), 0, 1);

    // derived
    const rtNorm = clamp(this.rtEma / 520, 0, 1);
    const rtVar = clamp(this.rtVarEma / (180*180), 0, 1);

    const hitRate = clamp(this.hitRateEma / 2.2, 0, 1);
    const missRate = clamp(this.missRateEma / 2.2, 0, 1);

    const combo = clamp((Number(s.combo) || 0) / 30, 0, 1);
    const score = clamp((Number(s.score) || 0) / 2000, 0, 1);

    const accProxy = clamp( 1 - missRate*0.85 - rtNorm*0.20, 0, 1);

    return {
      timeNorm,
      score,
      combo,
      missRate,
      hitRate,
      rtNorm,
      rtVar,
      fever,
      shield,
      youHp,
      bossHp,
      phase,
      comboStab: clamp(this.comboStabEma, 0, 1),
      fatigue: clamp(this.fatigueEma, 0, 1),
      accProxy
    };
  }
}