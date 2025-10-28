// === game/core/powerup.js (add small QoL hooks) ===
export class PowerUpSystem {
  constructor() {
    this.timeScale = 1;
    this.scoreBoost = 0;
    this._boostTimeout = 0;
    this.timers = { x2: 0, freeze: 0, sweep: 0 };
    this._tickerId = null;
    this._onChange = null; // <— NEW

    this._boostFn = (n) => {
      const base = Number(n) || 0;
      const x2Extra = this.timers.x2 > 0 ? base : 0;
      const flat = this.scoreBoost | 0;
      return x2Extra + flat;
    };
  }

  onChange(cb){ this._onChange = (typeof cb === 'function' ? cb : null); } // <— NEW
  _emitChange(){ try{ this._onChange?.(this.getTimers()); }catch{} }       // <— NEW

  apply(kind, seconds) {
    if (kind === 'boost') {
      this.scoreBoost = 7;
      clearTimeout(this._boostTimeout);
      this._boostTimeout = setTimeout(() => { this.scoreBoost = 0; }, 7000);
      this._emitChange(); // <— NEW
      return;
    }
    if (kind === 'x2')     { this._startTimer('x2',     Number.isFinite(seconds) ? seconds|0 : 8); return; }
    if (kind === 'freeze') { this._startTimer('freeze', Number.isFinite(seconds) ? seconds|0 : 3); return; }
    if (kind === 'sweep' || kind === 'magnet') {
      this._startTimer('sweep', Number.isFinite(seconds) ? seconds|0 : 2); return;
    }
  }

  attachToScore(score) {
    if (!score || typeof score.setBoostFn !== 'function') return;
    score.setBoostFn((n) => this._boostFn(n));
  }

  getTimers() { return { x2: this.timers.x2|0, freeze: this.timers.freeze|0, sweep: this.timers.sweep|0 }; }
  isX2() { return (this.timers.x2|0) > 0; }
  isFrozen(){ return (this.timers.freeze|0) > 0; } // <— NEW

  setTimeScale(v=1){ this.timeScale = Math.max(0.1, Math.min(2, Number(v)||1)); }
  getTimeScale(){ return this.timeScale; }

  dispose() {
    clearTimeout(this._boostTimeout);
    this._boostTimeout = 0;
    this.scoreBoost = 0;
    this._stopTicker();
    this.timers.x2 = this.timers.freeze = this.timers.sweep = 0;
    this._emitChange(); // <— NEW
  }

  _startTimer(key, sec){
    const s = Math.max(0, sec|0);
    this.timers[key] = Math.max(this.timers[key]|0, s);
    this._emitChange();     // <— NEW
    this._ensureTicker();
  }

  _ensureTicker(){
    if (this._tickerId) return;
    this._tickerId = setInterval(()=>this._tick1s(), 1000);
  }

  _stopTicker(){
    if (this._tickerId){
      clearInterval(this._tickerId);
      this._tickerId = null;
    }
  }

  _tick1s(){
    let any = false;
    for (const k of Object.keys(this.timers)){
      const v = Math.max(0, (this.timers[k]|0) - 1);
      if (v !== (this.timers[k]|0)) { this.timers[k] = v; any = true; }
    }
    if (any) this._emitChange(); // <— NEW
    if (!this.timers.x2 && !this.timers.freeze && !this.timers.sweep) {
      this._stopTicker();
    }
  }
}
