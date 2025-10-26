// core/score.js — ตัวนับคะแนนแบบเบา ๆ
export class ScoreSystem {
  constructor() {
    this.score = 0;
    this._listeners = { change: [] };
  }
  reset() {
    this.score = 0;
    this._emit('change', this.score);
  }
  add(n) {
    const v = (n|0);
    this.score += v;
    if (this.score < 0) this.score = 0;
    this._emit('change', this.score);
  }
  on(event, fn) {
    (this._listeners[event] || (this._listeners[event] = [])).push(fn);
  }
  _emit(event, ...args) {
    const ls = this._listeners[event]; if (!ls) return;
    for (const f of ls) { try { f(...args); } catch {} }
  }
}
