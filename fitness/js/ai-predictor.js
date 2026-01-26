// === /fitness/js/ai-predictor.js ===
// ML-lite: Online Logistic Regression (tiny) + rolling stats
// Predicts pMiss in next few seconds based on recent RT/grade/miss trend.
// ✅ No deps, fast, safe.
// ✅ Not used in research mode (engine controls).

'use strict';

export class AIPredictor {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      lr: 0.08,            // learning rate
      l2: 0.0008,          // weight decay
      maxHist: 36,         // rolling window
      clampZ: 8,           // stability
    }, opts);

    // weights for features: [bias, rt, missStreak, bombStreak, hpLow, feverOn, phase, diffHard]
    this.w = new Float32Array(8);
    this.w[0] = -0.15; // bias: default slightly "ok"

    this.hist = []; // each {y, x[]} y=1 miss-like, 0 hit-like
    this.lastP = 0.35;
  }

  _sigmoid(z) {
    const cz = Math.max(-this.cfg.clampZ, Math.min(this.cfg.clampZ, z));
    return 1 / (1 + Math.exp(-cz));
  }

  _dot(w, x) {
    let s = 0;
    for (let i = 0; i < w.length; i++) s += w[i] * x[i];
    return s;
  }

  _normRt(rtMs) {
    // normalize: 0..1 roughly (fast->0, slow->1), cap at 1200ms
    if (rtMs == null || rtMs === '') return 0.5;
    const v = Math.max(0, Math.min(1200, rtMs));
    return v / 1200;
  }

  _pushHist(item) {
    this.hist.push(item);
    while (this.hist.length > this.cfg.maxHist) this.hist.shift();
  }

  _streakCount(pred) {
    let c = 0;
    for (let i = this.hist.length - 1; i >= 0; i--) {
      if (pred(this.hist[i])) c++;
      else break;
    }
    return c;
  }

  /**
   * Observe one resolved event (hit/timeout/bomb/decoy)
   * @param {Object} e { type, grade, rtMs, playerHp, feverOn, bossPhase, diffKey }
   */
  observe(e) {
    if (!e) return;

    const isMissLike = (e.type === 'timeout') || (e.grade === 'bomb');
    const y = isMissLike ? 1 : 0;

    const missStreak = Math.min(6, this._streakCount(h => h.y === 1)) / 6;
    const bombStreak = Math.min(6, this._streakCount(h => h.meta && h.meta.bomb === 1)) / 6;

    const hpLow = (e.playerHp != null && e.playerHp <= 0.32) ? 1 : 0;
    const feverOn = e.feverOn ? 1 : 0;
    const phase = Math.max(1, Math.min(3, e.bossPhase || 1)) / 3;
    const diffHard = (e.diffKey === 'hard') ? 1 : 0;

    const x = new Float32Array(8);
    x[0] = 1; // bias
    x[1] = this._normRt(e.rtMs);
    x[2] = missStreak;
    x[3] = bombStreak;
    x[4] = hpLow;
    x[5] = feverOn;
    x[6] = phase;
    x[7] = diffHard;

    const z = this._dot(this.w, x);
    const p = this._sigmoid(z);
    this.lastP = p;

    // SGD update: w = w - lr * (p - y) * x  + L2
    const err = (p - y);
    const lr = this.cfg.lr;

    for (let i = 0; i < this.w.length; i++) {
      const grad = err * x[i] + this.cfg.l2 * this.w[i];
      this.w[i] = this.w[i] - lr * grad;
    }

    this._pushHist({
      y,
      x: Array.from(x),
      meta: { bomb: (e.grade === 'bomb') ? 1 : 0 }
    });
  }

  /**
   * Predict probability of near-future miss (0..1)
   */
  predict() {
    // smooth with short history miss rate
    if (!this.hist.length) return this.lastP;

    let miss = 0;
    for (const h of this.hist) miss += h.y;
    const missRate = miss / this.hist.length;

    // blend model p with empirical missRate
    const p = 0.65 * this.lastP + 0.35 * missRate;
    return Math.max(0.02, Math.min(0.98, p));
  }

  debugSnapshot() {
    return {
      pMiss: this.predict(),
      w: Array.from(this.w).map(v => +v.toFixed(3)),
      n: this.hist.length
    };
  }
}