// === fitness/js/ai-predictor.js ===
// Shadow Breaker — tiny online predictor (ML-ish, lightweight, no training step)
// Output: probability of near-future miss/overwhelm + difficulty suggestion.
//
// Design goals:
// - No external libs
// - Stable & fair (smooth features from FeatureTracker)
// - Explainable: exposes feature contributions for the coach

'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b,v));

function sigmoid(x){
  const z = Math.exp(-clamp(x, -12, 12));
  return 1 / (1 + z);
}

function tanh(x){
  const e2 = Math.exp(2*clamp(x, -6, 6));
  return (e2 - 1) / (e2 + 1);
}

function dot(w, x){
  let s = 0;
  for (let i=0;i<w.length;i++) s += (w[i]||0) * (x[i]||0);
  return s;
}

// Order of features vector:
const FEAT_KEYS = [
  'rt','vol','miss','streak','aps',
  'phase','lowHp','timeP',
  'pressure','control'
];

export class AIPredictor {
  constructor(opts={}){
    this.cfg = Object.assign({
      // If you want a slightly stronger “DL feel”, raise hiddenScale a bit (<=1.2)
      hiddenScale: 1.0
    }, opts);

    // 2-layer perceptron (fixed weights)
    // Hidden: 6 units
    this.W1 = [
      // rt, vol, miss, streak, aps, phase, lowHp, timeP, pressure, control
      [ 1.15, 0.55, 1.10, 0.90, 0.30, 0.35, 0.60, 0.25, 1.05, -0.75 ],
      [ 0.80, 0.95, 0.60, 1.05, 0.20, 0.20, 0.85, 0.10, 0.90, -0.60 ],
      [ 0.35, 0.40, 0.90, 0.50, 0.85, 0.25, 0.25, 0.70, 0.65, -0.45 ],
      [ 0.25, 0.20, 0.55, 0.80, 0.95, 0.65, 0.35, 0.55, 0.70, -0.50 ],
      [ 0.60, 0.30, 0.65, 0.35, 0.25, 0.75, 0.90, 0.30, 0.80, -0.40 ],
      [ 0.20, 0.25, 0.40, 0.55, 0.35, 0.20, 0.55, 0.85, 0.60, -0.55 ]
    ];
    this.B1 = [ -0.35, -0.25, -0.20, -0.15, -0.10, -0.05 ];

    // Outputs:
    // y0 => pMissSoon, y1 => pOverwhelm
    this.W2 = [
      [ 1.10, 0.70, 0.55, 0.55, 0.65, 0.50 ],
      [ 1.25, 0.85, 0.60, 0.70, 0.75, 0.65 ]
    ];
    this.B2 = [ -0.15, 0.05 ];
  }

  _vec(features){
    const x = [];
    for (const k of FEAT_KEYS) x.push(Number(features?.[k]) || 0);
    return x;
  }

  // returns {pMiss, pOverwhelm, contrib}
  predict(features){
    const x = this._vec(features);

    // simple explainability: contribution is linear proxy from input layer
    const contrib = {};
    for (let i=0;i<FEAT_KEYS.length;i++){
      // approximate “importance” by averaging absolute weights in W1
      let wsum = 0;
      for (let h=0;h<this.W1.length;h++) wsum += Math.abs(this.W1[h][i]||0);
      contrib[FEAT_KEYS[i]] = (x[i]||0) * (wsum/this.W1.length);
    }

    const hs = [];
    for (let h=0; h<this.W1.length; h++){
      const a = dot(this.W1[h], x) + (this.B1[h]||0);
      hs.push(tanh(a) * this.cfg.hiddenScale);
    }

    const y0 = dot(this.W2[0], hs) + this.B2[0];
    const y1 = dot(this.W2[1], hs) + this.B2[1];

    const pMiss = sigmoid(y0);
    const pOverwhelm = sigmoid(y1);

    return { pMiss, pOverwhelm, contrib };
  }
}

export { FEAT_KEYS };