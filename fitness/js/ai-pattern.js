// === /fitness/js/ai-pattern.js ===
// Deterministic-ish pattern generator for fairness (seeded by stable inputs)

'use strict';

function hash32(a, b, c) {
  // simple integer mix
  let x = (a | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= (b | 0);
  x = Math.imul(x ^ (x >>> 16), 0x27d4eb2d);
  x ^= (c | 0);
  x = Math.imul(x ^ (x >>> 15), 0x165667b1);
  return x | 0;
}

export class PatternGen {
  next01(a, b, c) {
    const h = hash32(a | 0, b | 0, c | 0) >>> 0;
    return (h % 100000) / 100000;
  }
}