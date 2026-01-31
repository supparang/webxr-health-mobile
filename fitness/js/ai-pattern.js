// === fitness/js/ai-pattern.js ===
// Shadow Breaker — AI Pattern Generator (Pack D)
// Goals:
// 1) Make spawns feel "designed" (waves / zigzag / corners / center-bait)
// 2) Keep it fair and readable (no impossible clusters)
// 3) Deterministic per session if seed provided
//
// Usage:
//   const pat = new PatternGenerator(seed, { gridX: 5, gridY: 3 });
//   const p = pat.next({ t01, phase, diffKey, lastHitGrade, bias });
//   -> { xPct, yPct, tag }

'use strict';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class PatternGenerator {
  constructor(seed = Date.now(), opts = {}) {
    const s = Number.isFinite(seed) ? seed : Date.now();
    this.rng = mulberry32((s ^ 0x9E3779B9) >>> 0);
    this.gridX = clamp(opts.gridX || 5, 3, 8);
    this.gridY = clamp(opts.gridY || 3, 2, 5);

    this.step = 0;
    this.mode = 'wave';
    this.lastCell = null;

    // weights by phase: later phase = more motion across screen
    this.phaseMode = {
      1: [{ v: 'wave', w: 45 }, { v: 'center', w: 25 }, { v: 'zigzag', w: 20 }, { v: 'corners', w: 10 }],
      2: [{ v: 'zigzag', w: 35 }, { v: 'wave', w: 25 }, { v: 'corners', w: 20 }, { v: 'center', w: 20 }],
      3: [{ v: 'corners', w: 35 }, { v: 'zigzag', w: 30 }, { v: 'wave', w: 20 }, { v: 'center', w: 15 }]
    };
  }

  _pickWeighted(list) {
    const total = list.reduce((a, o) => a + o.w, 0);
    let r = this.rng() * total;
    for (const o of list) {
      if (r < o.w) return o.v;
      r -= o.w;
    }
    return list[list.length - 1].v;
  }

  _cellToPct(cx, cy) {
    // center of cell → pct
    const x = (cx + 0.5) / this.gridX;
    const y = (cy + 0.5) / this.gridY;
    // keep inside safe zone
    return { xPct: clamp(x, 0.06, 0.94), yPct: clamp(y, 0.12, 0.88) };
  }

  _chooseMode(phase = 1) {
    const list = this.phaseMode[phase] || this.phaseMode[1];
    // small chance to keep same mode for "theme"
    if (this.step % 8 !== 0 && this.rng() < 0.65) return this.mode;
    return this._pickWeighted(list);
  }

  next(ctx = {}) {
    const phase = Number(ctx.phase || 1);
    const diffKey = (ctx.diffKey || 'normal');
    const t01 = clamp(Number(ctx.t01 || 0), 0, 1);

    // difficulty nudges: hard = more cross-screen motion, easy = more center readability
    const hardBias = diffKey === 'hard' ? 1 : diffKey === 'easy' ? -1 : 0;

    this.mode = this._chooseMode(phase);

    // introduce occasional "teaching" patterns early in the run
    if (t01 < 0.18 && this.rng() < 0.55) this.mode = 'center';
    if (t01 > 0.80 && this.rng() < 0.55) this.mode = 'corners';

    let cx = 0, cy = 0;
    const sx = this.gridX - 1;
    const sy = this.gridY - 1;

    if (this.mode === 'center') {
      cx = Math.floor(this.gridX / 2);
      cy = Math.floor(this.gridY / 2);
      // tiny jitter inside neighbors
      if (this.rng() < 0.45) cx = clamp(cx + (this.rng() < 0.5 ? -1 : 1), 0, sx);
      if (this.rng() < 0.25) cy = clamp(cy + (this.rng() < 0.5 ? -1 : 1), 0, sy);
    } else if (this.mode === 'wave') {
      // left → right → left (wave), row chosen by phase
      const dir = (Math.floor(this.step / this.gridX) % 2) === 0 ? 1 : -1;
      const k = this.step % this.gridX;
      cx = dir === 1 ? k : (sx - k);
      cy = phase === 1 ? 1 : (phase === 2 ? (this.rng() < 0.6 ? 1 : 0) : (this.rng() < 0.6 ? 0 : 2));
      cy = clamp(cy, 0, sy);
      if (hardBias > 0 && this.rng() < 0.35) cy = clamp(cy + (this.rng() < 0.5 ? -1 : 1), 0, sy);
    } else if (this.mode === 'zigzag') {
      // jump across lanes
      const jump = hardBias > 0 ? 2 : 1;
      cx = (this.step * jump) % this.gridX;
      if (this.step % 2 === 1) cx = sx - cx;
      cy = (this.step % this.gridY);
    } else if (this.mode === 'corners') {
      // rotate corners + edges
      const corner = this.step % 4;
      if (corner === 0) { cx = 0; cy = 0; }
      else if (corner === 1) { cx = sx; cy = 0; }
      else if (corner === 2) { cx = sx; cy = sy; }
      else { cx = 0; cy = sy; }
      // sometimes pull slightly inwards for fairness
      if (this.rng() < 0.55) {
        if (cx === 0) cx = 1;
        else if (cx === sx) cx = sx - 1;
        if (cy === 0) cy = 1;
        else if (cy === sy) cy = sy - 1;
      }
    } else {
      // fallback random cell
      cx = Math.floor(this.rng() * this.gridX);
      cy = Math.floor(this.rng() * this.gridY);
    }

    // avoid repeating exact same cell too often
    const key = `${cx},${cy}`;
    if (this.lastCell === key && this.rng() < 0.85) {
      cx = clamp(cx + (this.rng() < 0.5 ? -1 : 1), 0, sx);
      cy = clamp(cy + (this.rng() < 0.5 ? -1 : 1), 0, sy);
    }
    this.lastCell = `${cx},${cy}`;

    const pct = this._cellToPct(cx, cy);
    this.step++;

    return {
      xPct: pct.xPct,
      yPct: pct.yPct,
      tag: this.mode
    };
  }
}