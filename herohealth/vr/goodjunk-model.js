// === /webxr-health-mobile/herohealth/vr/goodjunk-model.js ===
// GoodJunk Model Stub (on-device) — logistic risk predictor
// FULL v20260301-MODEL-STUB
'use strict';

export const GOODJUNK_MODEL = {
  version: 'goodjunk-logit-v1',
  // feature order (must match featurizeGoodJunk in ai-goodjunk.js)
  features: [
    'tLeft','stage','score','combo','miss','accPct','medianRtGoodMs','fever','shield','onScreen','spawnMs','lifeMs'
  ],
  // weights roughly tuned for “risk = likely to miss soon / unstable performance”
  // you will overwrite these with trained weights from train_goodjunk.py output later
  w: [
    -0.015,  0.35, -0.0009, -0.06, 0.28, -0.05, 0.0012, -0.01, -0.18, 0.08, -0.0014, -0.0010
  ],
  b: 0.25,
  // calibration to label
  thresholds: { low: 0.35, mid: 0.60, high: 0.78 }
};

export function sigmoid(x){
  const z = Math.max(-20, Math.min(20, x));
  return 1 / (1 + Math.exp(-z));
}

export function predictRiskProba(xVec, model = GOODJUNK_MODEL){
  let s = Number(model.b || 0) || 0;
  const w = model.w || [];
  for(let i=0;i<xVec.length;i++){
    s += (Number(w[i]||0) * Number(xVec[i]||0));
  }
  return sigmoid(s);
}

export function riskLabel(p, model = GOODJUNK_MODEL){
  const th = model.thresholds || { low:.35, mid:.60, high:.78 };
  if(p >= th.high) return 'HIGH';
  if(p >= th.mid)  return 'MID';
  if(p >= th.low)  return 'LOW';
  return 'OK';
}