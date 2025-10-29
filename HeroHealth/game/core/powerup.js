// === Hero Health Academy — core/powerup.js (v2: onChange hooks + freeze helper + safe ticker) ===
export class PowerUpSystem {
  constructor() {
    // Runtime multipliers
    this.timeScale = 1;    // (reserved for future use in spawn speed, etc.)
    this.scoreBoost = 0;   // flat bonus per scoring event (temporary "boost")

    // Timers (seconds left)
    this.timers = { x2: 0, freeze: 0, sweep: 0 };

    // Internals
    this._boostTimeout = 0;
    this._tickerId = null;
    this._onChange = null;

    // Provide a boost function to ScoreSystem
    this._boostFn = (base) => {
      const b = Number(base) || 0;
      const x2Extra = this.timers.x2 > 0 ? b : 0;   // ×2 → add base again
      const flat    = this.scoreBoost | 0;          // flat +N
      return x2Extra + flat;
    };

    // Visibility awareness (optional QoL: slow down UI spam when tab is unfocused)
    this._blurred = false;
    try {
      window.addEventListener('blur',  () => { this._blurred = true;  }, { passive:true });
      window.addEventListener('focus', () => { this._blurred = false; }, { passive:true });
    } catch {}
  }

  /* ======================== Public API ======================== */

  /** Subscribe to timer changes (HUD can bind here). */
  onChange(cb) { this._onChange = (typeof cb === 'function') ? cb : null; }

  /** Attach score boost function to an external ScoreSystem instance. */
  attachToScore(score) {
    if (!score || typeof score.setBoostFn !== 'function') return;
    score.setBoostFn((n) => this._boostFn(n));
  }

  /** Apply a power-up by kind. Seconds default: x2=8, freeze=3, sweep=2, boost=7s. */
  apply(kind, seconds) {
    if (kind === 'boost') {
      // flat +7 for ~7s
      this.scoreBoost = 7;
      clearTimeout(this._boostTimeout);
      this._boostTimeout = setTimeout(() => { this.scoreBoost = 0; this._emitChange(); }, 7000);
      this._emitChange();
      return;
    }
    if (kind === 'x2')     { this._startTimer('x2',     Number.isFinite(seconds) ? seconds|0 : 8); return; }
    if (kind === 'freeze') { this._startTimer('freeze', Number.isFinite(seconds) ? seconds|0 : 3); return; }
    if (kind === 'sweep' || kind === 'magnet') {
      this._startTimer('sweep', Number.isFinite(seconds) ? seconds|0 : 2); return;
    }
  }

  /** Read-only snapshot of timers. */
  getTimers() { return { x2: this.timers.x2|0, freeze: this.timers.freeze|0, sweep: this.timers.sweep|0 }; }

  /** Convenience flags. */
  isX2()     { return (this.timers.x2|0)     > 0; }
  isFrozen() { return (this.timers.freeze|0) > 0; }

  /** Optional global time scale for callers (0.1..2). */
  setTimeScale(v = 1) { this.timeScale = Math.max(0.1, Math.min(2, Number(v)||1)); }
  getTimeScale() { return this.timeScale; }

  /** Clean up (call at endGame). */
  dispose() {
    clearTimeout(this._boostTimeout);
    this._boostTimeout = 0;
    this.scoreBoost = 0;

    this._stopTicker();
    this.timers.x2 = this.timers.freeze = this.timers.sweep = 0;

    this._emitChange();
  }

  /* ======================== Internals ======================== */

  _emitChange() {
    try { this._onChange?.(this.getTimers()); } catch {}
  }

  _startTimer(key, sec) {
    const s = Math.max(0, sec|0);
    // Extend if the new duration is longer than remaining
    this.timers[key] = Math.max(this.timers[key]|0, s);
    this._emitChange();
    this._ensureTicker();
  }

  _ensureTicker() {
    if (this._tickerId) return;
    // Tick once per second (simple, deterministic)
    this._tickerId = setInterval(() => this._tick1s(), 1000);
  }

  _stopTicker() {
    if (!this._tickerId) return;
    clearInterval(this._tickerId);
    this._tickerId = null;
  }

  _tick1s() {
    // If the tab is blurred, we still count down but this hook could be adapted if needed.
    let anyChange = false;

    for (const k of Object.keys(this.timers)) {
      const cur = this.timers[k]|0;
      const next = Math.max(0, cur - 1);
      if (next !== cur) {
        this.timers[k] = next;
        anyChange = true;
      }
    }

    if (anyChange) this._emitChange();

    if (!this.timers.x2 && !this.timers.freeze && !this.timers.sweep) {
      this._stopTicker();
    }
  }
}
