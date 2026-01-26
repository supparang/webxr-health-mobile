// === /fitness/js/ai-predictor.js ===
// Lightweight predictor (ML-ready) — no external libs
// Predict: fatigue risk from RT trend + miss rate window
'use strict';

export class AIPredictor {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      windowHits: 18,
      rtBadMs: 520,
      missBadRate: 0.22,
    }, opts);
    this.reset();
  }

  reset(){
    this.rt = [];
    this.misses = 0;
    this.hits = 0;

    // online regression y = a + b*x (x = hit index)
    this.n = 0;
    this.sumX = 0; this.sumY = 0;
    this.sumXX = 0; this.sumXY = 0;

    this.lastScore = null;
    this.fatigue = 0; // 0..1
  }

  // feed only when "real" normal hits (not decoy/bomb/heal/shield)
  pushRt(rtMs){
    const x = this.n;
    const y = rtMs;

    this.n++;
    this.sumX += x; this.sumY += y;
    this.sumXX += x*x; this.sumXY += x*y;

    this.rt.push(rtMs);
    if (this.rt.length > this.cfg.windowHits) this.rt.shift();
  }

  addHit(){ this.hits++; }
  addMiss(){ this.misses++; }

  // returns fatigue prediction {risk, label, hint}
  predict(){
    const rtAvg = this.rt.length ? (this.rt.reduce((a,b)=>a+b,0)/this.rt.length) : 0;

    // slope b
    let b = 0;
    const denom = (this.n * this.sumXX - this.sumX * this.sumX);
    if (this.n >= 6 && denom !== 0) {
      b = (this.n * this.sumXY - this.sumX * this.sumY) / denom; // ms per hit
    }

    const total = this.hits + this.misses;
    const missRate = total ? (this.misses / total) : 0;

    // risk composition (0..1)
    let risk = 0;
    if (rtAvg > this.cfg.rtBadMs) risk += 0.45;
    if (b > 6) risk += 0.25;      // getting slower
    if (missRate > this.cfg.missBadRate) risk += 0.35;

    risk = Math.max(0, Math.min(1, risk));
    this.fatigue = risk;

    const label =
      risk >= 0.75 ? 'HIGH' :
      risk >= 0.45 ? 'MID' : 'LOW';

    const hint =
      label === 'HIGH' ? 'เหนื่อยแล้ว! ลดความเสี่ยง: โฟกัสเป้าชัด ๆ และรอจังหวะ' :
      label === 'MID' ? 'เริ่มล้า: เล็งให้ชัด เน้น “ไม่พลาด” ก่อน' :
      'กำลังดี: รักษาจังหวะ แล้วไล่คอมโบต่อ!';

    return { risk, label, hint, rtAvg: Math.round(rtAvg), slope: +b.toFixed(2), missRate: +missRate.toFixed(3) };
  }
}