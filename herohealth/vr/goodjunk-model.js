// === /herohealth/vr/goodjunk-model.js ===
// Exported model for GoodJunk predictions
// - hazardRisk_1s: binary probability
// - miss_3s: binary probability
// This file can be overwritten by train_goodjunk.py export.
// FULL v20260301-MODEL-STUB
'use strict';

// Simple logistic helpers
function sigmoid(z){ return 1 / (1 + Math.exp(-z)); }
function dot(w, x){
  let s = 0;
  for(let i=0;i<w.length;i++) s += (w[i]||0) * (x[i]||0);
  return s;
}

// Default (stub) weights — will be replaced by training export
// Feature order must match ai-goodjunk.js buildFeatureVector()
export const MODEL_META = {
  version: 'stub',
  featureOrder: [
    'miss','dMiss','accPct','accRecent','combo','feverPct','shield',
    'missGoodExpired','missJunkHit','medianRtGoodMs'
  ]
};

// Two-head logistic regression
export const WEIGHTS = {
  hazardRisk_1s: { b: -1.6, w: [ 0.35, 1.20, -0.02, -0.60, -0.05, -0.01, -0.15, 0.30, 0.55, 0.0006 ] },
  miss_3s:       { b: -2.2, w: [ 0.40, 1.50, -0.02, -0.55, -0.06, -0.01, -0.12, 0.35, 0.65, 0.0008 ] }
};

export function predictProba(xVec){
  // returns {hazardRisk, miss3s}
  try{
    const h = sigmoid(WEIGHTS.hazardRisk_1s.b + dot(WEIGHTS.hazardRisk_1s.w, xVec));
    const m = sigmoid(WEIGHTS.miss_3s.b       + dot(WEIGHTS.miss_3s.w, xVec));
    return { hazardRisk: h, miss3s: m };
  }catch(e){
    return { hazardRisk: 0.15, miss3s: 0.08 };
  }
}
