// === /fitness/js/ai-predictor.js ===
// Shadow Breaker — DL-lite Predictor (ESM)
// ✅ Export: AIPredictor, FEATURE_ORDER, toVector (helper)
// Notes:
// - This is ML-ready scaffolding: current inference is lightweight heuristic.
// - Other games can reuse by feeding the same feature schema (FEATURE_ORDER).

'use strict';

function clamp01(v){ v = Number(v)||0; return Math.max(0, Math.min(1, v)); }
function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

// Fixed feature order (vector)
export const FEATURE_ORDER = [
  'timeNorm',
  'score',
  'combo',
  'missRate',
  'hitRate',
  'rtNorm',
  'rtVar',
  'fever',
  'shield',
  'youHp',
  'bossHp',
  'phase',
  'comboStab',
  'fatigue',
  'accProxy'
];

export function toVector(featObj){
  const f = featObj || {};
  return FEATURE_ORDER.map((k)=> clamp01(f[k]));
}

export class AIPredictor {
  constructor(opts = {}){
    this.opts = Object.assign({
      // thresholds can be tuned per game
      easyAt: 0.45,
      hardAt: 0.78,
      fatigueHigh: 0.70,
      fatigueLow: 0.35
    }, opts || {});
  }

  // Input: feature object from FeatureTracker.toVector()
  predict(featObj){
    const f = featObj || {};
    const acc = clamp01(f.accProxy);
    const fatigue = clamp01(f.fatigue);
    const rt = clamp01(f.rtNorm);
    const missRate = clamp01(f.missRate);

    // heuristic “skill” score
    const skillScore = clamp01(
      acc * 0.55 +
      (1-rt) * 0.25 +
      (1-missRate) * 0.20
    );

    let suggestedDifficulty = 'normal';
    if (skillScore >= this.opts.hardAt && fatigue <= this.opts.fatigueLow) suggestedDifficulty = 'hard';
    else if (skillScore <= this.opts.easyAt || fatigue >= this.opts.fatigueHigh) suggestedDifficulty = 'easy';

    // micro tip
    let tip = '';
    if (missRate >= 0.35) tip = 'ช้าลงนิดนึง—โฟกัสเป้า แล้วค่อยชก/แตะ';
    else if (rt > 0.65) tip = 'ลอง “รอเป้าเข้าใกล้” ก่อนชก จะพลาดน้อยลง';
    else if (skillScore > 0.82 && fatigue < 0.30) tip = 'ดีมาก! ลองเพิ่มโหมด Hard จะท้าทายขึ้น';
    else if (fatigue > 0.62) tip = 'พักจังหวะหน่อย—อย่ากดรัว เลือกตีเป้าที่ชัวร์';

    return {
      fatigueRisk: fatigue,
      skillScore,
      suggestedDifficulty,
      tip
    };
  }
}