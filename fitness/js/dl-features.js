// === /fitness/js/dl-features.js ===
// DLFeatures: เก็บ feature สำหรับ AI/analytics (NO imports)
// ✅ แก้แล้ว: ไม่ import {RB_AI} เพื่อกันพังตอนโหลดโมดูล
'use strict';

export class DLFeatures {
  constructor(){
    this.reset();
  }

  reset(){
    this.totalShots = 0; // opportunities/spawns
    this.hits = 0;
    this.misses = 0;

    this.hitPerfect = 0;
    this.hitGood = 0;
    this.hitBad = 0;

    this.offsetAbsSum = 0; // (optional) if you feed timing
    this.offsetAbsN = 0;

    this._tLastHit = 0;
  }

  onShot(){
    this.totalShots++;
  }

  onHit(info = {}){
    this.hits++;
    const g = (info.grade || 'good');
    if (g === 'perfect') this.hitPerfect++;
    else if (g === 'bad' || g === 'bomb') this.hitBad++;
    else this.hitGood++;

    this._tLastHit = performance.now();

    // optional timing
    if (Number.isFinite(info.offsetAbsSec)) {
      this.offsetAbsSum += Math.abs(info.offsetAbsSec);
      this.offsetAbsN++;
    }
  }

  onMiss(){
    this.misses++;
  }

  getTotalShots(){ return this.totalShots; }
  getHits(){ return this.hits; }

  getAccPct(){
    const t = this.totalShots;
    return t > 0 ? (this.hits / t) * 100 : 0;
  }

  getOffsetAbsMean(){
    return this.offsetAbsN > 0 ? (this.offsetAbsSum / this.offsetAbsN) : null;
  }

  snapshot(extra = {}){
    const accPct = this.getAccPct();
    const offsetAbsMean = this.getOffsetAbsMean();
    return {
      accPct,
      hitPerfect: this.hitPerfect,
      hitGood: this.hitGood,
      hitMiss: this.misses,
      offsetAbsMean,
      ...extra
    };
  }
}