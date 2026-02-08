// === /fitness/js/dl-features.js ===
// Shadow Breaker — DLFeatures (lightweight feature logger)
// ✅ No dependency on RB_AI (แก้ error import RB_AI)
// ✅ Used by engine.js for accuracy + shot/hit counters

'use strict';

export class DLFeatures {
  constructor(){
    this.reset();
  }

  reset(){
    this._shots = 0;
    this._hits = 0;
    this._lastHitMs = 0;
    this._streak = 0;
    this._missBurst = 0;
  }

  onShot(){
    this._shots++;
  }

  onHit(tMs){
    this._hits++;
    this._streak++;
    this._missBurst = Math.max(0, this._missBurst - 1);
    if (typeof tMs === 'number') this._lastHitMs = tMs;
  }

  onMiss(){
    this._streak = 0;
    this._missBurst = Math.min(10, this._missBurst + 1);
  }

  getTotalShots(){ return this._shots; }
  getHits(){ return this._hits; }
  getStreak(){ return this._streak; }
  getMissBurst(){ return this._missBurst; }

  snapshot(){
    const shots = this._shots;
    const hits = this._hits;
    const acc = shots > 0 ? hits / shots : 0;
    return {
      shots,
      hits,
      acc,
      streak: this._streak,
      missBurst: this._missBurst,
      lastHitMs: this._lastHitMs
    };
  }
}

export default DLFeatures;