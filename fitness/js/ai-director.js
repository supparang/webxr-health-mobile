'use strict';

// AiDirector — fair adaptive pacing (play only)
// Research: should be disabled by caller
export class AiDirector {
  constructor(opts = {}) {
    this.enabled = !!opts.enabled;
    this.diff = (opts.diff || 'normal');
    this._spawnRateMul = 1.0;
    this._ttlMul = 1.0;
    this._sizeMul = 1.0;

    this._hits = 0;
    this._miss = 0;
    this._lastAdjustAt = 0;
  }

  setEnabled(v){ this.enabled = !!v; }
  setDiff(d){ this.diff = d || 'normal'; }

  getSpawnRateMul(){ return this._spawnRateMul; }
  getTtlMul(){ return this._ttlMul; }
  getSizeMul(){ return this._sizeMul; }

  onHit(info = {}) {
    if (!this.enabled) return;
    this._hits++;
    this._maybeAdjust();
  }

  onMiss() {
    if (!this.enabled) return;
    this._miss++;
    this._maybeAdjust();
  }

  _maybeAdjust() {
    const now = performance.now();
    if (now - this._lastAdjustAt < 900) return; // rate limit
    this._lastAdjustAt = now;

    const h = this._hits;
    const m = this._miss;
    const total = h + m;
    if (total < 8) return;

    const missRate = m / total;

    // Target: missRate ~ 0.18–0.28
    if (missRate > 0.38) {
      // too hard -> easier
      this._spawnRateMul = Math.max(0.78, this._spawnRateMul * 0.94);
      this._ttlMul = Math.min(1.22, this._ttlMul * 1.06);
      this._sizeMul = Math.min(1.18, this._sizeMul * 1.04);
      // soften memory a bit
      this._hits = Math.floor(h * 0.6);
      this._miss = Math.floor(m * 0.6);
    } else if (missRate < 0.12) {
      // too easy -> harder
      this._spawnRateMul = Math.min(1.28, this._spawnRateMul * 1.05);
      this._ttlMul = Math.max(0.82, this._ttlMul * 0.96);
      this._sizeMul = Math.max(0.88, this._sizeMul * 0.98);
      this._hits = Math.floor(h * 0.6);
      this._miss = Math.floor(m * 0.6);
    } else {
      // within band: drift back to 1
      this._spawnRateMul += (1.0 - this._spawnRateMul) * 0.08;
      this._ttlMul += (1.0 - this._ttlMul) * 0.08;
      this._sizeMul += (1.0 - this._sizeMul) * 0.08;
    }
  }
}