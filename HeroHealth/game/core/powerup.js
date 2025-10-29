// === Hero Health Academy — core/powerup.js
// v2.3: drift-free timers + pause/resume + stacking modes + freeze hook + flexible boost
// Backward compatible with v2 API

export class PowerUpSystem {
  /**
   * @param {Object} opts
   *  - tickMs: number (default 250)   // smoother countdown & HUD updates
   *  - pauseOnBlur: boolean (default true) // auto-pause when tab blurred
   *  - emitThrottleMs: number (default 120) // throttle onChange during heavy updates
   */
  constructor(opts = {}) {
    // Config
    this._tickMs        = Math.max(60, opts.tickMs || 250);
    this._pauseOnBlur   = (opts.pauseOnBlur ?? true);
    this._emitThrottle  = Math.max(60, opts.emitThrottleMs || 120);

    // Runtime multipliers
    this.timeScale  = 1;   // reserved for future use (affects spawn speeds externally)
    this.scoreBoost = 0;   // flat bonus per scoring event

    // Timers (seconds left) — store as ms internally for drift-free countdown
    this.timers = { x2: 0, freeze: 0, sweep: 0 };           // public (secs)
    this._timersMs = { x2: 0, freeze: 0, sweep: 0 };        // internal (ms)

    // Internals
    this._boostTimeout   = 0;
    this._tickerId       = null;
    this._onChange       = null;
    this._lastTickAt     = 0;   // perf.now baseline
    this._emitPending    = false;
    this._emitGuard      = 0;
    this._isPaused       = false;

    // Freeze transition hook (to let game freeze spawns/logic)
    this._freezeHook = null;
    this._wasFrozen  = false;

    // Provide a boost function to ScoreSystem
    this._boostFn = (base) => {
      const b = Number(base) || 0;
      const x2Extra = (this._timersMs.x2 > 0) ? b : 0; // ×2 → add base again
      const flat    = this.scoreBoost | 0;             // +N flat for the window
      return x2Extra + flat;
    };

    // Visibility awareness
    this._blurred = false;
    try {
      window.addEventListener('blur',  () => {
        this._blurred = true;
        if (this._pauseOnBlur) this.pause();
      }, { passive:true });
      window.addEventListener('focus', () => {
        this._blurred = false;
        if (this._pauseOnBlur) this.resume();
      }, { passive:true });
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

  /**
   * Apply a power-up by kind.
   * @param {'x2'|'freeze'|'sweep'|'magnet'|'boost'} kind
   * @param {number} seconds (optional)
   * @param {Object} options (optional)
   *  - mode: 'max'|'extend'|'add'   (default 'max')
   *      'max'    → keep the longer of (remain, new)
   *      'extend' → set remain = max(remain, 0) + new
   *      'add'    → alias of 'extend'
   *  - boostFlat: number (for kind==='boost'), default 7
   *  - boostMs: number (for kind==='boost'), default 7000
   */
  apply(kind, seconds, options = {}) {
    if (kind === 'boost') {
      const flat = Number.isFinite(options.boostFlat) ? (options.boostFlat|0) : 7;
      const ms   = Number.isFinite(options.boostMs)   ? (options.boostMs|0)   : 7000;
      this.setBoost(flat, ms);
      return;
    }
    if (kind === 'magnet') kind = 'sweep'; // alias

    const key = (kind === 'x2' || kind === 'freeze' || kind === 'sweep') ? kind : null;
    if (!key) return;

    const sec = Number.isFinite(seconds) ? Math.max(0, seconds|0) : (
      key === 'x2' ? 8 : key === 'freeze' ? 3 : 2
    );
    const mode = (options.mode === 'extend' || options.mode === 'add') ? 'extend'
               : (options.mode === 'max' || !options.mode) ? 'max'
               : 'max';

    const addMs = sec * 1000;

    if (mode === 'extend') {
      this._timersMs[key] = Math.max(0, this._timersMs[key]) + addMs;
    } else { // 'max'
      this._timersMs[key] = Math.max(this._timersMs[key], addMs);
    }

    this._ensureTicker();
    this._emitNow(); // reflect immediately
  }

  /** Set flat boost for duration (ms). */
  setBoost(amount = 7, durationMs = 7000) {
    this.scoreBoost = Number(amount) | 0;
    clearTimeout(this._boostTimeout);
    this._boostTimeout = setTimeout(() => {
      this.scoreBoost = 0;
      this._emitNow();
    }, Math.max(0, durationMs|0));
    this._emitNow();
  }

  /** Read-only snapshot (integers in seconds). */
  getTimers() {
    return {
      x2:     Math.max(0, Math.ceil(this._timersMs.x2 / 1000)),
      freeze: Math.max(0, Math.ceil(this._timersMs.freeze / 1000)),
      sweep:  Math.max(0, Math.ceil(this._timersMs.sweep / 1000)),
    };
  }

  /** Convenience flags. */
  isX2()     { return (this._timersMs.x2 > 0); }
  isFrozen() { return (this._timersMs.freeze > 0); }

  /** Optional global time scale for callers (0.1..2). */
  setTimeScale(v = 1) { this.timeScale = Math.max(0.1, Math.min(2, Number(v)||1)); }
  getTimeScale()      { return this.timeScale; }

  /** Bind a hook to be notified when freeze turns on/off. (bool active) */
  bindFreezeHook(fn) { this._freezeHook = (typeof fn === 'function') ? fn : null; }

  /** Manually set a timer value (seconds). */
  setTimer(kind, seconds = 0) {
    if (!['x2','freeze','sweep'].includes(kind)) return;
    this._timersMs[kind] = Math.max(0, (seconds|0) * 1000);
    this._ensureTicker();
    this._emitNow();
  }

  /** Clear a specific timer. */
  clear(kind) {
    if (!['x2','freeze','sweep'].includes(kind)) return;
    this._timersMs[kind] = 0;
    this._emitNow();
  }

  /** Pause/resume countdowns (HUD can still render last state). */
  pause()  { this._isPaused = true;  }
  resume() { if (this._isPaused){ this._isPaused = false; this._lastTickAt = 0; this._ensureTicker(); } }
  isPaused(){ return !!this._isPaused; }

  /** Clean up (call at endGame). */
  dispose() {
    clearTimeout(this._boostTimeout);
    this._boostTimeout = 0;
    this.scoreBoost = 0;

    this._stopTicker();
    this._timersMs.x2 = this._timersMs.freeze = this._timersMs.sweep = 0;

    this._emitNow();
  }

  /* ======================== Internals ======================== */

  _emitNow() {
    try {
      // Mirror _timersMs to public seconds before emitting
      const snap = this.getTimers();
      this.timers.x2     = snap.x2;
      this.timers.freeze = snap.freeze;
      this.timers.sweep  = snap.sweep;
      this._onChange?.(snap);
    } catch {}
  }

  _emitThrottled() {
    const now = performance?.now?.() || Date.now();
    if (!this._emitGuard || (now - this._emitGuard) >= this._emitThrottle) {
      this._emitGuard = now;
      this._emitNow();
    } else {
      if (this._emitPending) return;
      this._emitPending = true;
      const delay = Math.max(0, this._emitThrottle - (now - this._emitGuard));
      setTimeout(() => {
        this._emitPending = false;
        this._emitNow();
      }, delay);
    }
  }

  _ensureTicker() {
    if (this._tickerId) return;
    this._lastTickAt = performance?.now?.() || Date.now();
    this._tickerId = setInterval(() => this._tick(), this._tickMs);
  }

  _stopTicker() {
    if (!this._tickerId) return;
    clearInterval(this._tickerId);
    this._tickerId = null;
  }

  _tick() {
    if (this._isPaused) return;

    const now = performance?.now?.() || Date.now();
    let dt = now - (this._lastTickAt || now);
    this._lastTickAt = now;

    // Guard against huge jumps (tab sleep) but still make progress
    dt = Math.max(0, Math.min(dt, 2000));

    let anyChange = false;

    // countdown
    for (const k of Object.keys(this._timersMs)) {
      const cur = this._timersMs[k] | 0;
      if (cur <= 0) { this._timersMs[k] = 0; continue; }
      const next = Math.max(0, cur - dt);
      if (next !== cur) {
        this._timersMs[k] = next;
        anyChange = true;
      }
    }

    // Freeze transition hook
    const frozen = this._timersMs.freeze > 0;
    if (frozen !== this._wasFrozen) {
      this._wasFrozen = frozen;
      try { this._freezeHook?.(frozen); } catch {}
    }

    if (anyChange) this._emitThrottled();

    // stop ticker when all done and no boost
    if (!this._timersMs.x2 && !this._timersMs.freeze && !this._timersMs.sweep) {
      this._stopTicker();
    }
  }
}
