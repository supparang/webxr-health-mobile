(function (global) {
  'use strict';
  const exports = global.GAME_MODULES = global.GAME_MODULES || {};

  class Difficulty {
    constructor(custom = {}) {
      const base = {
        easy:   { size: 0.80, rate: 700, life: 2500 },
        normal: { size: 0.60, rate: 520, life: 2000 },
        hard:   { size: 0.40, rate: 380, life: 1400 }
      };
      this.config = mergeConfig(base, custom);
      this.levels = ['easy', 'normal', 'hard'];
      this._current = 'normal';
    }
    get(level = this._current) {
      const lv = this._sanitize(level);
      return clone(this.config[lv]);
    }
    set(level) {
      this._current = this._sanitize(level);
      return this._current;
    }
    _sanitize(level) {
      const lv = String(level || '').toLowerCase();
      return this.levels.includes(lv) ? lv : 'normal';
    }
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function mergeConfig(base, custom) {
    const out = clone(base);
    const lvls = Object.keys(base);
    for (const lv of lvls) {
      if (custom && typeof custom[lv] === 'object') {
        const c = custom[lv];
        if (Number.isFinite(c.size)) out[lv].size = clamp(+c.size, 0.2, 1.5);
        if (Number.isFinite(c.rate)) out[lv].rate = Math.max(120, Math.round(+c.rate));
        if (Number.isFinite(c.life)) out[lv].life = Math.max(300, Math.round(+c.life));
      }
    }
    return out;
  }

  exports.Difficulty = Difficulty;

})(window);
