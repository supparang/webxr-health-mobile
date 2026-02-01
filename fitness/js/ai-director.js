// === /fitness/js/ai-director.js ===
// Fair adaptive pacing director (lightweight)

'use strict';

export function computeAssist(pred, snap) {
  const fatigue = Number(pred?.fatigueRisk) || 0;
  const skill = Number(pred?.skillScore) || 0;

  // spawn multiplier: fatigue high => slower; skill high => faster (small range)
  let spawnMul = 1.0;
  spawnMul += (skill - 0.5) * 0.35;
  spawnMul -= (fatigue - 0.4) * 0.40;
  spawnMul = Math.max(0.85, Math.min(1.25, spawnMul));

  return { spawnMul, fatigue, skill };
}

export class AIDirector {
  constructor() {
    this.spawnMul = 1.0;
  }

  step(assist, dt) {
    const target = Number(assist?.spawnMul) || 1.0;
    const k = Math.min(1, (Number(dt) || 0.016) * 3.2); // smoothing
    this.spawnMul = this.spawnMul + (target - this.spawnMul) * k;

    return { spawnMul: this.spawnMul };
  }
}