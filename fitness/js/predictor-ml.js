// === /fitness/js/predictor-ml.js ===
// Online ML Predictor (Logistic Regression via SGD) — lightweight, on-device
'use strict';

function sigmoid(x){
  if (x > 20) return 1;
  if (x < -20) return 0;
  return 1 / (1 + Math.exp(-x));
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

/**
 * Predict "miss risk" for next ~2-5 seconds window
 * Train online from actual outcomes (hit/miss).
 *
 * Features (normalized):
 *  - missRate (0..1)
 *  - rtAvg (ms -> 0..1)
 *  - rtSlope (ms/sec -> 0..1)
 *  - zoneBias (L worse positive)
 *  - feverOn (0/1)
 *  - phase (1..3)
 */
export class OnlineRiskPredictor {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      lr: 0.18,
      l2: 0.0008,
      clipGrad: 3.0,
      // thresholds for labels
      low: 0.30,
      high: 0.62
    }, opts);
    this.reset();
  }

  reset() {
    // weights: [bias, f1..f6]
    this.w = new Float32Array(7);
    this.w[0] = 0.0; // bias
    this._last = { p: 0.5, label: 'MED', score: 0.0, features: null };
    this._trained = 0;
  }

  // normalize raw stats -> feature vector
  featurize(input) {
    const missRate = clamp(input.missRate ?? 0, 0, 1);
    const rtAvgMs = input.rtAvg ?? 0;
    const rtAvg = clamp((rtAvgMs - 240) / 520, 0, 1); // 240..760ms -> 0..1

    const slopeRaw = input.slope ?? 0; // ms/sec, [-50..50]
    const slope = clamp((slopeRaw + 50) / 100, 0, 1);

    const biasRaw = input.zoneBias ?? 0; // approx [-1..1]
    const bias = clamp((biasRaw + 0.35) / 0.70, 0, 1); // shift to 0..1

    const feverOn = input.feverOn ? 1 : 0;
    const phase = clamp(((input.phase ?? 1) - 1) / 2, 0, 1); // 1..3 -> 0..1

    // x = [1, missRate, rtAvg, slope, bias, feverOn, phase]
    return [1, missRate, rtAvg, slope, bias, feverOn, phase];
  }

  predict(input) {
    const x = this.featurize(input);
    let z = 0;
    for (let i = 0; i < this.w.length; i++) z += this.w[i] * x[i];
    const p = sigmoid(z);

    let label = 'MED';
    if (p < this.cfg.low) label = 'LOW';
    else if (p >= this.cfg.high) label = 'HIGH';

    this._last = { p, label, score: z, features: x };
    return this._last;
  }

  /**
   * Train from outcome
   * y = 1 => miss happened (bad)
   * y = 0 => hit happened (good)
   */
  update(y) {
    const last = this._last;
    if (!last.features) return;

    const x = last.features;
    const p = last.p;

    // gradient for log-loss: (p - y) * x
    const err = (p - y);
    const lr = this.cfg.lr;

    for (let i = 0; i < this.w.length; i++) {
      let g = err * x[i] + this.cfg.l2 * this.w[i];
      g = clamp(g, -this.cfg.clipGrad, this.cfg.clipGrad);
      this.w[i] -= lr * g;
    }
    this._trained++;
  }

  trainedCount(){ return this._trained; }
}