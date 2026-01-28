// === /fitness/js/seeded-rng.js ===
// Deterministic RNG (fast, tiny) — mulberry32
'use strict';

export function makeRng(seed) {
  let a = (Number(seed) || Date.now()) >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}