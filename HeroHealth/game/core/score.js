// core/score.js
// เก็บคะแนน + hook เผื่อในอนาคต

export class ScoreSystem {
  constructor() {
    this.score = 0;
    this._handlers = { change: null };
    this._boostFn = null;
  }
  reset() {
    this.score = 0;
    this._emit();
  }
  add(n) {
    const extra = this._boostFn ? (this._boostFn(n)|0) : 0;
    this.score = (this.score|0) + (n|0) + extra;
    this._emit();
  }
  setBoostFn(fn) { this._boostFn = typeof fn === 'function' ? fn : null; }
  setHandlers(h = {}) { this._handlers = { ...this._handlers, ...h }; }
  _emit() { try { this._handlers.change?.(this.score); } catch {} }
}
