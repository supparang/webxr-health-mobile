// === /fitness/js/ai-predictor.js ===
// Shadow Breaker — AI Predictor (Online ML, lightweight, explainable)
// ✅ Predict weak zone (lowest hit probability) from simple online logistic model
// ✅ Update per hit/miss (SGD) — runs fully in browser
// ✅ Explainable: returns top feature contributions (optional)

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function sigmoid(z){ return 1 / (1 + Math.exp(-z)); }

export class AIPredictor {
  constructor(opts = {}) {
    this.numZones = opts.numZones ?? 6;
    this.lr = opts.lr ?? 0.06;              // learning rate
    this.l2 = opts.l2 ?? 0.0006;            // tiny regularization
    this.minSamples = opts.minSamples ?? 10; // ต้องมีข้อมูลพอค่อยเดา
    this.bias = 0;

    // weights: zone 6 + phase 3 + storm + fever + time + combo + rtNorm
    this.dim = this.numZones + 3 + 1 + 1 + 1 + 1 + 1;
    this.w = new Array(this.dim).fill(0);

    // stats
    this.samples = 0;
    this.zoneSeen = new Array(this.numZones).fill(0);
    this.zoneHit = new Array(this.numZones).fill(0);
    this.zoneMiss = new Array(this.numZones).fill(0);

    // for explanation cache
    this._lastExplain = null;
  }

  // feature vector builder
  featurize(ctx){
    const z = clamp(ctx.zoneId, 0, this.numZones-1) | 0;
    const phase = clamp(ctx.phase, 1, 3) | 0;

    const storm = ctx.storm ? 1 : 0;
    const fever = ctx.feverOn ? 1 : 0;
    const timeLeftN = clamp(ctx.timeLeftN, 0, 1);   // 0..1
    const comboN = clamp(ctx.comboN, 0, 1);         // 0..1
    const rtN = clamp(ctx.rtN, 0, 1);               // 0..1 (only for update; for predict can be 0.5)

    const x = new Array(this.dim).fill(0);
    let k = 0;

    // zone one-hot
    x[k + z] = 1; k += this.numZones;

    // phase one-hot (1..3)
    x[k + (phase-1)] = 1; k += 3;

    // scalar features
    x[k++] = storm;
    x[k++] = fever;
    x[k++] = timeLeftN;
    x[k++] = comboN;
    x[k++] = rtN;

    return x;
  }

  score(x){
    let z = this.bias;
    for (let i=0;i<this.dim;i++) z += this.w[i] * x[i];
    return z;
  }

  predictProb(ctx){
    const x = this.featurize(ctx);
    const p = sigmoid(this.score(x));
    return { p, x };
  }

  update(label, ctx){
    // label: 1 hit, 0 miss
    const y = label ? 1 : 0;
    const zId = clamp(ctx.zoneId, 0, this.numZones-1) | 0;

    this.zoneSeen[zId]++; 
    if (y) this.zoneHit[zId]++; else this.zoneMiss[zId]++;

    const { p, x } = this.predictProb(ctx);

    // SGD logistic regression: grad = (p - y)*x + l2*w
    const err = (p - y);

    this.bias -= this.lr * err;

    for (let i=0;i<this.dim;i++){
      const g = err * x[i] + this.l2 * this.w[i];
      this.w[i] -= this.lr * g;
    }

    this.samples++;

    // cache explain
    this._lastExplain = this.explain(ctx);
  }

  ready(){
    return this.samples >= this.minSamples;
  }

  weakZone(ctxBase){
    // return zone id with lowest predicted hit probability
    if (!this.ready()) return -1;

    let bestZ = -1;
    let bestP =  2;

    for (let z=0; z<this.numZones; z++){
      // ต้องเห็นโซนนั้นบ้าง
      if (this.zoneSeen[z] < 4) continue;

      const ctx = Object.assign({}, ctxBase, {
        zoneId: z,
        // สำหรับ predict ไม่รู้ rt จริง ใช้ค่า neutral 0.5
        rtN: 0.5
      });

      const { p } = this.predictProb(ctx);
      if (p < bestP){
        bestP = p;
        bestZ = z;
      }
    }
    return bestZ;
  }

  explain(ctx){
    // returns top contributions
    const { x } = this.predictProb(ctx);
    const items = [];
    for (let i=0;i<this.dim;i++){
      const v = x[i];
      if (!v) continue;
      items.push({ i, contrib: this.w[i] * v });
    }
    items.sort((a,b)=>Math.abs(b.contrib)-Math.abs(a.contrib));
    return items.slice(0, 5);
  }

  lastExplain(){
    return this._lastExplain;
  }

  snapshot(){
    return {
      dim: this.dim,
      bias: this.bias,
      w: this.w.slice(),
      samples: this.samples,
      zoneSeen: this.zoneSeen.slice(),
      zoneHit: this.zoneHit.slice(),
      zoneMiss: this.zoneMiss.slice()
    };
  }

  restore(obj){
    if (!obj || !Array.isArray(obj.w) || obj.w.length !== this.dim) return false;
    this.bias = Number(obj.bias)||0;
    for (let i=0;i<this.dim;i++) this.w[i] = Number(obj.w[i])||0;
    this.samples = Number(obj.samples)||0;
    if (Array.isArray(obj.zoneSeen)) this.zoneSeen = obj.zoneSeen.map(n=>Number(n)||0).slice(0,this.numZones);
    if (Array.isArray(obj.zoneHit))  this.zoneHit  = obj.zoneHit.map(n=>Number(n)||0).slice(0,this.numZones);
    if (Array.isArray(obj.zoneMiss)) this.zoneMiss = obj.zoneMiss.map(n=>Number(n)||0).slice(0,this.numZones);
    return true;
  }
}