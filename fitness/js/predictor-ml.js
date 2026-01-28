// === /fitness/js/predictor-ml.js ===
// PredictorML: online prediction (miss risk / fatigue / zone weakness)
// - lightweight "DL-lite": 2-layer MLP (tiny) with online SGD update
// - explainable outputs: why risk increased (RT up / miss streak / bomb hits / weak zone)
// - provides gentle multipliers (spawn / ttl / hazard weights) = fair adaptive

'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
const nowMs = ()=>{ try{return performance.now();}catch(_){return Date.now();} };

function sigmoid(x){ return 1/(1+Math.exp(-x)); }

export class PredictorML{
  constructor(){
    this.reset();
  }

  reset(){
    // rolling stats
    this.t = 0;
    this.emaRt = 360;
    this.emaRtFast = 320;
    this.emaMiss = 0;
    this.emaBomb = 0;
    this.emaComboBreak = 0;
    this.streakMiss = 0;
    this.streakHit = 0;

    // per-zone: 0..5
    this.zone = Array.from({length:6}, ()=>({
      emaRt: 360, emaMiss: 0, hits: 0, miss: 0
    }));
    this.lastZoneId = -1;

    // fatigue index (0..1)
    this.fatigue = 0;

    // tiny MLP weights (deterministic-ish init)
    // input features length = 9
    this.W1 = this._initMat(9, 6, 0.18);
    this.b1 = new Array(6).fill(0);
    this.W2 = this._initMat(6, 1, 0.22);
    this.b2 = [0];

    // learning rate (small!)
    this.lr = 0.015;

    // outputs
    this.risk = 0.18;        // miss risk prediction (0..1)
    this.riskReason = 'baseline';
    this.weakZoneId = 0;
    this.weakZoneReason = '';
  }

  _initMat(inN, outN, scale){
    const m = [];
    let seed = 1337;
    const rnd = ()=>{
      // tiny deterministic LCG
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 4294967296);
    };
    for(let o=0;o<outN;o++){
      const row = [];
      for(let i=0;i<inN;i++){
        row.push((rnd()*2-1) * scale);
      }
      m.push(row);
    }
    return m;
  }

  _forward(x){
    // x: length 9
    const h = new Array(6).fill(0);
    for(let j=0;j<6;j++){
      let s = this.b1[j];
      const w = this.W1[j];
      for(let i=0;i<x.length;i++) s += w[i]*x[i];
      // tanh
      h[j] = Math.tanh(s);
    }
    let y = this.b2[0];
    for(let j=0;j<6;j++) y += this.W2[0][j]*h[j];
    const p = sigmoid(y);
    return {h, p, y};
  }

  _train(x, target){
    // target: 0/1 where 1 means "miss-like outcome"
    const {h, p} = this._forward(x);
    const err = (p - target); // dL/dy for log-loss
    // grad W2/b2
    for(let j=0;j<6;j++){
      this.W2[0][j] -= this.lr * err * h[j];
    }
    this.b2[0] -= this.lr * err;

    // backprop to hidden (approx)
    for(let j=0;j<6;j++){
      const dh = (1 - h[j]*h[j]) * (this.W2[0][j] * err); // tanh'
      const w = this.W1[j];
      for(let i=0;i<x.length;i++){
        w[i] -= this.lr * dh * x[i];
      }
      this.b1[j] -= this.lr * dh;
    }
  }

  _features(){
    // normalize to roughly 0..1 ranges
    const rt = clamp(this.emaRt / 900, 0, 1);
    const rtFast = clamp(this.emaRtFast / 900, 0, 1);
    const miss = clamp(this.emaMiss, 0, 1);
    const bomb = clamp(this.emaBomb, 0, 1);
    const cb = clamp(this.emaComboBreak, 0, 1);
    const sm = clamp(this.streakMiss / 6, 0, 1);
    const sh = clamp(this.streakHit / 10, 0, 1);

    const wz = this._weakZoneScore(); // 0..1
    const fat = clamp(this.fatigue, 0, 1);

    return [rt, rtFast, miss, bomb, cb, sm, sh, wz, fat];
  }

  _weakZoneScore(){
    // choose the zone with highest (miss rate + slow RT)
    let bestId = 0;
    let bestScore = -1;
    for(let i=0;i<this.zone.length;i++){
      const z = this.zone[i];
      const missRate = (z.hits + z.miss) > 0 ? (z.miss / (z.hits + z.miss)) : 0.0;
      const rtN = clamp(z.emaRt / 900, 0, 1);
      const score = 0.62*missRate + 0.38*rtN;
      if (score > bestScore){ bestScore = score; bestId = i; }
    }
    this.weakZoneId = bestId;
    // reason text
    const z = this.zone[bestId];
    const missRate = (z.hits + z.miss) > 0 ? (z.miss / (z.hits + z.miss)) : 0.0;
    this.weakZoneReason = (missRate > 0.35) ? 'miss-high' : (z.emaRt > 520 ? 'rt-slow' : 'mixed');
    return clamp(bestScore, 0, 1);
  }

  onEvent(ev){
    // ev: {type:'hit'|'timeout', targetType, rtMs, zoneId, grade}
    this.t++;

    const isHit = ev && ev.type === 'hit';
    const isRealMiss = ev && (ev.type === 'timeout') && (ev.targetType === 'normal' || ev.targetType === 'bossface');

    const rt = (ev && typeof ev.rtMs === 'number') ? ev.rtMs : null;
    const zoneId = (ev && typeof ev.zoneId === 'number') ? ev.zoneId : -1;
    if (zoneId >= 0) this.lastZoneId = zoneId;

    // EMAs
    const a = 0.06;
    const aFast = 0.12;

    // miss ema (0..1)
    this.emaMiss = (1-a)*this.emaMiss + a*(isRealMiss ? 1 : 0);
    this.emaBomb = (1-a)*this.emaBomb + a*((ev && ev.targetType==='bomb') ? 1 : 0);
    this.emaComboBreak = (1-a)*this.emaComboBreak + a*((isRealMiss || (ev && ev.targetType==='decoy' && isHit)) ? 1 : 0);

    if (rt != null){
      this.emaRt = (1-a)*this.emaRt + a*rt;
      this.emaRtFast = (1-aFast)*this.emaRtFast + aFast*rt;
    }

    if (isRealMiss){
      this.streakMiss++;
      this.streakHit = 0;
    } else if (isHit){
      this.streakHit++;
      this.streakMiss = 0;
    }

    // per-zone update
    if (zoneId >= 0 && zoneId < this.zone.length){
      const z = this.zone[zoneId];
      if (rt != null) z.emaRt = (1-a)*z.emaRt + a*rt;
      if (isRealMiss){ z.miss++; z.emaMiss = (1-a)*z.emaMiss + a*1; }
      if (isHit){ z.hits++; z.emaMiss = (1-a)*z.emaMiss + a*0; }
    }

    // fatigue: grows with time + miss streak + slow RT, recovers on hit streak
    const rtSlow = clamp((this.emaRt - 320) / 480, 0, 1);
    const add = 0.0035 + 0.010*(this.streakMiss>=2?1:0) + 0.006*rtSlow;
    const rec = 0.010*(this.streakHit>=4?1:0);
    this.fatigue = clamp(this.fatigue + add - rec, 0, 1);

    // prediction (MLP)
    const x = this._features();
    const out = this._forward(x);
    // base risk from model
    let risk = out.p;

    // rule overlay for safety (fair)
    // if fatigue high -> risk slightly up; if hit streak high -> risk down a bit
    risk += 0.10*this.fatigue - 0.08*clamp(this.streakHit/8,0,1);

    this.risk = clamp(risk, 0.05, 0.92);

    // online train: treat miss-like outcomes as label 1, good hit as 0
    const label = isRealMiss ? 1 : (isHit ? 0 : null);
    if (label != null){
      this._train(x, label);
    }

    // reason string (explainable)
    const wz = this._weakZoneScore();
    if (this.fatigue > 0.72) this.riskReason = 'fatigue-high';
    else if (this.streakMiss >= 2) this.riskReason = 'miss-streak';
    else if (this.emaRtFast > 520) this.riskReason = 'rt-slow';
    else if (wz > 0.55) this.riskReason = 'weak-zone';
    else this.riskReason = 'stable';
  }

  tick(dtMs){
    // light passive decay (smooth)
    const dt = (Number(dtMs)||0)/1000;
    if (dt <= 0) return;
    // fatigue naturally decays slowly if stable
    if (this.streakMiss === 0 && this.streakHit > 0){
      this.fatigue = clamp(this.fatigue - 0.010*dt, 0, 1);
    } else {
      this.fatigue = clamp(this.fatigue - 0.004*dt, 0, 1);
    }
  }

  getAdjustments(){
    // convert predicted risk into gentle multipliers
    const r = this.risk;
    // When risk is high => slightly slower spawn, slightly longer ttl, fewer hazards
    const spawnMul = (r > 0.55) ? 1.10 : (r < 0.25 ? 0.96 : 1.00);
    const ttlMul   = (r > 0.60) ? 1.08 : (r < 0.22 ? 0.96 : 1.00);

    // hazard multipliers (lower when risk high)
    const hazardDown = (r > 0.60) ? 0.78 : (r < 0.22 ? 1.06 : 1.00);

    // slight challenge boost when stable & low fatigue
    const challengeUp = (r < 0.22 && this.fatigue < 0.35) ? 1.08 : 1.00;

    return {
      risk: r,
      fatigue: this.fatigue,
      spawnMul: spawnMul / challengeUp,  // if skilled, spawns a bit faster
      ttlMul: ttlMul,
      bombMul: hazardDown,
      decoyMul: hazardDown,
      reason: this.riskReason,
      weakZoneId: this.weakZoneId,
      weakZoneReason: this.weakZoneReason
    };
  }
}