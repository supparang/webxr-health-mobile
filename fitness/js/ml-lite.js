// === /fitness/js/ml-lite.js ===
// ML-lite Online Logistic for miss prediction (A-62)
// ✅ online update: observe(hit/miss, features)
// ✅ predictMissProb(features)
// ✅ tiny + fast (no deps)

'use strict';

function sigmoid(z){
  // clamp กัน overflow
  if (z > 18) return 0.99999998;
  if (z < -18) return 0.00000002;
  return 1 / (1 + Math.exp(-z));
}

function dot(w, x){
  let s = 0;
  for (let i=0;i<w.length;i++) s += w[i] * (x[i] || 0);
  return s;
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// ฟีเจอร์ที่ใช้ (fixed length):
// [1] bias
// [2] avgRtNorm (0..1)
// [3] missRate (0..1)
// [4] hpInv (0..1) = 1 - hp
// [5] comboNorm (0..1)
// [6] phaseNorm (0..1)
// [7] feverOn (0/1)
export function featurize(state){
  if (!state) return [1,0.5,0.15,0.0,0.0,0.0,0];

  const p = state.perf || {};
  const hits = p.hits || 0;
  const miss = p.miss || 0;
  const total = hits + miss;

  const avgRt = (p.rtCount ? (p.rtSum / p.rtCount) : 420);      // ms
  const avgRtNorm = clamp((avgRt - 220) / (620 - 220), 0, 1);   // 220..620 => 0..1
  const missRate = total ? clamp(miss / total, 0, 1) : 0.12;

  const hp = clamp(state.playerHp ?? 1, 0, 1);
  const hpInv = 1 - hp;

  const combo = clamp(state.combo ?? 0, 0, 16);
  const comboNorm = combo / 16;

  const phase = clamp(state.bossPhase ?? 1, 1, 3);
  const phaseNorm = (phase - 1) / 2; // 0..1

  const feverOn = state.feverOn ? 1 : 0;

  return [1, avgRtNorm, missRate, hpInv, comboNorm, phaseNorm, feverOn];
}

export class MLLiteMissPredictor {
  constructor(opts){
    const o = opts || {};
    this.lr = (typeof o.lr === 'number') ? o.lr : 0.18;     // learning rate
    this.l2 = (typeof o.l2 === 'number') ? o.l2 : 0.002;    // regularization
    this.w = new Array(7).fill(0);                          // 7 features
    // init: ให้มี prior พอประมาณ (miss 10-18%)
    this.w[0] = -1.6; // bias
    this.seen = 0;
  }

  predictProb(x){
    const z = dot(this.w, x);
    return sigmoid(z);
  }

  observe(x, y01){
    // y01: 1=miss, 0=hit
    const y = y01 ? 1 : 0;
    const p = this.predictProb(x);
    const err = (p - y);

    // SGD with L2
    for (let i=0;i<this.w.length;i++){
      const grad = err * (x[i] || 0) + this.l2 * this.w[i];
      this.w[i] -= this.lr * grad;
    }
    this.seen++;
    return { p, y, err };
  }

  reset(){
    this.w.fill(0);
    this.w[0] = -1.6;
    this.seen = 0;
  }
}