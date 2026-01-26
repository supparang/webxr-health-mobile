// === /fitness/js/seeded-rng.js ===
// Tiny deterministic RNG (LCG) for research/play reproducibility
'use strict';

export function makeRng(seed) {
  let s = (Number(seed) >>> 0) || 123456789;
  return {
    next() {
      // LCG: Numerical Recipes
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    },
    int(min, max) {
      const r = this.next();
      return Math.floor(min + r * (max - min + 1));
    },
    pick(arr) {
      if (!arr || !arr.length) return undefined;
      return arr[this.int(0, arr.length - 1)];
    }
  };
}