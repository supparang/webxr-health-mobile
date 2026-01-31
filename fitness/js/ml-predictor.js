// === /fitness/js/ml-predictor.js ===
// A-65 Online ML Predictor (lightweight)
// Predict p(miss soon) using Online Logistic Regression (SGD)
// Works client-side only. No model files.

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function sigmoid(z){ return 1 / (1 + Math.exp(-z)); }

export class OnlineMissPredictor {
  constructor(opts){
    const o = Object.assign({
      lr: 0.08,          // learning rate
      l2: 0.0008,        // L2 regularization
      warmup: 18,        // steps before trusting strongly
      minP: 0.03,
      maxP: 0.97
    }, opts || {});

    this.lr = o.lr;
    this.l2 = o.l2;
    this.warmup = o.warmup;
    this.minP = o.minP;
    this.maxP = o.maxP;

    this.steps = 0;
    this.w = new Float32Array(10); // 9 features + bias (we use w[0] as bias)
    // init small random-ish but deterministic
    for (let i=0;i<this.w.length;i++) this.w[i] = (i===0? 0 : 0.02*(i%2?1:-1));
    this.lastP = 0.18;
    this.lastLabel = 0;
  }

  // features: object -> vector
  featurize(f){
    // Normalize to ~[0..1] where possible
    const rtN = clamp((f.rtMs || 0) / 900, 0, 1);              // 0..900ms
    const missStreak = clamp((f.missStreak || 0) / 6, 0, 1);   // 0..6
    const phase = clamp(((f.phase || 1) - 1) / 2, 0, 1);       // phase 1..3
    const hp = clamp(f.playerHp ?? 1, 0, 1);
    const bossHp = clamp(f.bossHp ?? 1, 0, 1);
    const fever = clamp(f.fever ?? 0, 0, 1);
    const shield = clamp((f.shield || 0) / 3, 0, 1);           // 0..3
    const tLeft = clamp(f.timeLeftFrac ?? 1, 0, 1);
    const pace = clamp(f.paceLevel ?? 0.5, 0, 1);              // 0..1

    // vector: [bias, rtN, missStreak, phase, 1-hp, bossHpLow, feverOn, shieldLow, endSoon, pace]
    const v = new Float32Array(10);
    v[0] = 1;
    v[1] = rtN;
    v[2] = missStreak;
    v[3] = phase;
    v[4] = 1 - hp;
    v[5] = 1 - bossHp;               // bossHp low => closer to clear => tension
    v[6] = fever;                    // higher fever => less miss (usually)
    v[7] = 1 - shield;               // low shield => higher risk
    v[8] = 1 - tLeft;                // near end => pressure
    v[9] = pace;
    return v;
  }

  predict(featObj){
    const x = this.featurize(featObj);
    let z = 0;
    for (let i=0;i<this.w.length;i++) z += this.w[i] * x[i];
    const p = clamp(sigmoid(z), this.minP, this.maxP);
    this.lastP = p;
    return p;
  }

  // label: 1=miss/negative outcome soon, 0=ok
  // featObj should be the same features used at predict time (or close)
  learn(featObj, label){
    const y = label ? 1 : 0;
    const x = this.featurize(featObj);
    const p = this.predict(featObj); // uses x internally; ok
    const err = (p - y);

    // SGD update with L2
    const lr = this.lr;
    const l2 = this.l2;

    for (let i=0;i<this.w.length;i++){
      const grad = err * x[i] + l2 * this.w[i];
      this.w[i] -= lr * grad;
    }

    this.steps++;
    this.lastLabel = y;
    return p;
  }

  // confidence grows with steps
  confidence(){
    return clamp(this.steps / Math.max(1,this.warmup), 0, 1);
  }
}