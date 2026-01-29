// === /fitness/js/metrics-window.js — Rolling window + EWMA helpers (A-38) ===
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

export class RollingWindow {
  constructor(cap = 40) {
    this.cap = Math.max(5, cap|0);
    this.arr = [];
  }
  push(v) {
    const x = Number(v);
    if (!Number.isFinite(x)) return;
    this.arr.push(x);
    if (this.arr.length > this.cap) this.arr.shift();
  }
  clear(){ this.arr.length = 0; }
  get n(){ return this.arr.length; }
  mean() {
    if (!this.arr.length) return 0;
    let s = 0;
    for (const x of this.arr) s += x;
    return s / this.arr.length;
  }
  sd() {
    const n = this.arr.length;
    if (n < 2) return 0;
    const m = this.mean();
    let s2 = 0;
    for (const x of this.arr) {
      const d = x - m;
      s2 += d*d;
    }
    return Math.sqrt(s2 / (n - 1));
  }
}

export function ewma(prev, x, alpha = 0.18) {
  const v = Number(x);
  if (!Number.isFinite(v)) return prev ?? 0;
  const p = Number(prev);
  if (!Number.isFinite(p)) return v;
  const a = clamp(Number(alpha) || 0.18, 0.05, 0.45);
  return p + a * (v - p);
}