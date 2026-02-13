// === /fitness/js/dl-features.js ===
// DLFeatures (lightweight) — track attempts/hits for accuracy & timing
'use strict';

export class DLFeatures {
  constructor(){ this.reset(); }
  reset(){
    this._shots = 0;
    this._hits = 0;
    this._lastHitMs = 0;
  }
  onShot(){ this._shots++; }
  onHit(){
    this._hits++;
    this._lastHitMs = performance.now();
  }
  getTotalShots(){ return this._shots; }
  getHits(){ return this._hits; }
}