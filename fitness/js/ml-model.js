// === /fitness/js/ml-model.js ===
// PACK M: Lightweight ML inference (no deps)
// - Supports logistic regression (binary risk) + linear score
// - Designed for browser: small, fast, explainable

'use strict';

// helpers
const clamp01 = (v)=> Math.max(0, Math.min(1, Number(v) || 0));
const sigmoid = (z)=> 1 / (1 + Math.exp(-z));
const dot = (w, x, keys)=>{
  let s = 0;
  for(const k of keys){
    const wi = Number(w[k] ?? 0);
    const xi = Number(x[k] ?? 0);
    if(Number.isFinite(wi) && Number.isFinite(xi)) s += wi * xi;
  }
  return s;
};

// Default placeholder weights (ต้องเอา weights จริงมาใส่ทีหลัง)
const DEFAULT = {
  version: 'ml-v0-placeholder',
  // features expected in "x"
  features: [
    'acc01','hp01','bossHp01','combo01','missRate01','shield01','fever01','feverOn01','rtScore01'
  ],
  // logistic risk model: fatigue_risk_prob
  fatigue: {
    bias: -0.2,
    w: {
      acc01:   -0.5,
      hp01:    -1.2,
      bossHp01: 0.1,
      combo01:  -0.3,
      missRate01: 1.4,
      shield01: -0.2,
      fever01:  -0.1,
      feverOn01:-0.1,
      rtScore01:-0.6
    }
  },
  // linear skill score
  skill: {
    bias: 0.0,
    w: {
      acc01:  0.65,
      hp01:   0.10,
      combo01:0.20,
      missRate01:-0.35,
      rtScore01:0.25
    }
  }
};

export class MLModel {
  constructor(weights){
    this.setWeights(weights || DEFAULT);
  }

  setWeights(weights){
    this.W = weights || DEFAULT;
    this.features = Array.isArray(this.W.features) ? this.W.features : DEFAULT.features;
  }

  // xRaw: any object with live numbers (acc%, hp%, etc)
  // returns normalized feature vector for consistent inference
  featurize(xRaw){
    const accPct = Number(xRaw.acc_live ?? xRaw.accPct ?? 0);
    const hp01 = clamp01(Number(xRaw.hp_live ?? 1));
    const bossHp01 = clamp01(Number(xRaw.boss_hp_live ?? 1));
    const combo = Number(xRaw.combo_live ?? 0);
    const miss = Number(xRaw.miss_live ?? 0);
    const shield = Number(xRaw.shield_live ?? 0);
    const fever = Number(xRaw.fever_live ?? 0);
    const feverOn = Number(xRaw.fever_on_live ?? 0);

    // normalize
    const acc01 = clamp01(accPct / 100);
    const combo01 = clamp01(combo / 12);
    const shield01 = clamp01(shield / 5);
    const fever01 = clamp01(fever / 100);
    const feverOn01 = clamp01(feverOn);

    // missRate: normalize against time scale
    const timeSec = Number(xRaw.time_sec ?? xRaw.timeSec ?? 70);
    const missRate01 = clamp01(miss / Math.max(6, timeSec/4)); // ~0..1

    // RT score: if you have rt_mean_ms in session
    const rtMean = Number(xRaw.rt_mean_ms ?? xRaw.rtMeanMs ?? NaN);
    const rtScore01 = Number.isFinite(rtMean) ? clamp01(1 - (rtMean / 900)) : 0.55;

    const x = {
      acc01, hp01, bossHp01, combo01, missRate01, shield01, fever01, feverOn01, rtScore01
    };
    return x;
  }

  predict(xRaw){
    const x = this.featurize(xRaw);

    // fatigue risk prob (logistic)
    const fKeys = this.features;
    const zF = (Number(this.W.fatigue?.bias ?? 0)) + dot(this.W.fatigue?.w || {}, x, fKeys);
    const fatigue_prob = sigmoid(zF);

    // skill score (linear then clamp)
    const zS = (Number(this.W.skill?.bias ?? 0)) + dot(this.W.skill?.w || {}, x, fKeys);
    const skill_score = clamp01(zS);

    // suggested difficulty
    let suggested_diff = 'normal';
    if(skill_score >= 0.78 && fatigue_prob <= 0.35) suggested_diff = 'hard';
    else if(skill_score <= 0.45 || fatigue_prob >= 0.70) suggested_diff = 'easy';

    // explain
    let why = '';
    if(fatigue_prob >= 0.70) why = 'fatigue↑ (hp/miss/rt)';
    else if(skill_score >= 0.78) why = 'skill↑ (acc/rt/combo)';
    else why = 'steady';

    return {
      model_version: this.W.version || 'unknown',
      fatigue_prob: Number(fatigue_prob.toFixed(3)),
      skill_score: Number(skill_score.toFixed(3)),
      suggested_diff,
      why
    };
  }
}