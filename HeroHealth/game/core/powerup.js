// === Hero Health Academy — core/powerup.js
// v3.0: stacked buffs + shield support + drift-free timers + freeze hook + smart decay

export class PowerUpSystem {
  constructor(opts = {}) {
    this._tickMs = Math.max(60, opts.tickMs || 250);
    this._pauseOnBlur = (opts.pauseOnBlur ?? true);
    this._emitThrottle = Math.max(60, opts.emitThrottleMs || 120);

    // Runtime multipliers
    this.timeScale  = 1;
    this.scoreBoost = 0;

    // Stacked timer containers
    this.buffers = { x2: [], freeze: [], sweep: [], shield: [] };
    this._tickerId = null;
    this._onChange = null;
    this._boostTimeout = 0;
    this._isPaused = false;
    this._blurred = false;
    this._lastTickAt = 0;
    this._emitGuard = 0;
    this._emitPending = false;

    // Freeze/Shield hook callbacks
    this._freezeHook = null;
    this._shieldHook = null;
    this._wasFrozen = false;
    this._wasShield = false;

    // Boost calculation
    this._boostFn = (base) => {
      const b = Number(base) || 0;
      const x2Active = this.buffers.x2.length > 0;
      const x2Extra = x2Active ? b : 0;
      const flat = this.scoreBoost | 0;
      return x2Extra + flat;
    };

    try {
      window.addEventListener('blur', () => {
        this._blurred = true;
        if (this._pauseOnBlur) this.pause();
      });
      window.addEventListener('focus', () => {
        this._blurred = false;
        if (this._pauseOnBlur) this.resume();
      });
    } catch {}
  }

  /* ======================== Public API ======================== */

  onChange(cb) { this._onChange = (typeof cb === 'function') ? cb : null; }

  attachToScore(score) {
    if (score && typeof score.setBoostFn === 'function')
      score.setBoostFn((n) => this._boostFn(n));
  }

  /** Apply a new buff (stackable). */
  apply(kind, seconds = 0, options = {}) {
    const keyMap = { magnet:'sweep', shield:'shield', x2:'x2', freeze:'freeze', sweep:'sweep' };
    const key = keyMap[kind] || kind;
    const sec = Math.max(1, seconds | 0) || (
      key === 'x2' ? 8 : key === 'freeze' ? 3 : key === 'sweep' ? 2 : key === 'shield' ? 6 : 4
    );
    const now = performance.now();
    const endAt = now + (sec * 1000);

    if (!this.buffers[key]) this.buffers[key] = [];
    this.buffers[key].push({ endAt });

    // sort ascending endAt (for easy pop)
    this.buffers[key].sort((a,b)=>a.endAt-b.endAt);

    if (key === 'boost') {
      const flat = Number.isFinite(options.boostFlat) ? (options.boostFlat|0) : 7;
      const ms   = Number.isFinite(options.boostMs)   ? (options.boostMs|0)   : 7000;
      this.setBoost(flat, ms);
      return;
    }

    this._ensureTicker();
    this._emitNow();
  }

  /** Boost +N for ms */
  setBoost(amount = 7, durationMs = 7000) {
    this.scoreBoost = Number(amount) | 0;
    clearTimeout(this._boostTimeout);
    this._boostTimeout = setTimeout(() => {
      this.scoreBoost = 0;
      this._emitNow();
    }, Math.max(0, durationMs|0));
    this._emitNow();
  }

  /** Return seconds left (max from stacked buffs). */
  getTimers() {
    const now = performance.now();
    const get = (k)=> Math.max(0, ...this.buffers[k].map(b=>Math.ceil((b.endAt - now)/1000)));
    return { x2:get('x2'), freeze:get('freeze'), sweep:get('sweep'), shield:get('shield') };
  }

  /** Checkers */
  isX2(){ return this.buffers.x2.length>0; }
  isFrozen(){ return this.buffers.freeze.length>0; }
  isShielded(){ return this.buffers.shield.length>0; }

  /** Hooks */
  bindFreezeHook(fn){ this._freezeHook = fn; }
  bindShieldHook(fn){ this._shieldHook = fn; }

  pause(){ this._isPaused = true; }
  resume(){ this._isPaused = false; this._lastTickAt = 0; this._ensureTicker(); }
  isPaused(){ return !!this._isPaused; }

  dispose(){
    this.buffers = { x2:[], freeze:[], sweep:[], shield:[] };
    this.scoreBoost = 0;
    clearTimeout(this._boostTimeout);
    this._stopTicker();
    this._emitNow();
  }

  /* ======================== Internals ======================== */

  _emitNow(){
    try {
      const t = this.getTimers();
      this._onChange?.(t);
    } catch {}
  }

  _emitThrottled(){
    const now = performance.now();
    if (!this._emitGuard || (now - this._emitGuard) >= this._emitThrottle){
      this._emitGuard = now;
      this._emitNow();
    } else if (!this._emitPending){
      this._emitPending = true;
      const delay = Math.max(0, this._emitThrottle - (now - this._emitGuard));
      setTimeout(()=>{ this._emitPending=false; this._emitNow(); }, delay);
    }
  }

  _ensureTicker(){
    if (this._tickerId) return;
    this._lastTickAt = performance.now();
    this._tickerId = setInterval(()=>this._tick(), this._tickMs);
  }

  _stopTicker(){
    clearInterval(this._tickerId);
    this._tickerId = null;
  }

  _tick(){
    if (this._isPaused) return;
    const now = performance.now();

    for (const k of Object.keys(this.buffers)){
      const buf = this.buffers[k];
      if (!buf.length) continue;
      this.buffers[k] = buf.filter(b => b.endAt > now);
    }

    // Hooks for transitions
    const frozen = this.isFrozen();
    const shielded = this.isShielded();
    if (frozen !== this._wasFrozen){ this._wasFrozen=frozen; this._freezeHook?.(frozen); }
    if (shielded !== this._wasShield){ this._wasShield=shielded; this._shieldHook?.(shielded); }

    this._emitThrottled();

    const allEmpty = Object.values(this.buffers).every(arr=>!arr.length);
    if (allEmpty && this.scoreBoost===0) this._stopTicker();
  }
}
