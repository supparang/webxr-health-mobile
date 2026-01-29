// === /fitness/js/pattern-generator.js — Boss patterns + micro-burst (A-38) ===
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

function lcg(seed){
  let s = (seed >>> 0) || 123456789;
  return {
    next(){
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    },
    int(a,b){
      const r = this.next();
      return Math.floor(a + r * (b - a + 1));
    }
  };
}

function pickWeighted(rng, weights){
  let total = 0;
  for (const it of weights) total += it.w;
  let r = rng.next() * total;
  for (const it of weights) {
    if (r < it.w) return it.v;
    r -= it.w;
  }
  return weights[weights.length - 1].v;
}

export class PatternGenerator {
  constructor(opts = {}) {
    const seed = opts.seed ?? Date.now();
    this.rng = lcg(seed);
    this.step = 0;
    this.sideFlip = 0;

    // burst scheduler
    this.nextBurstAt = 0;
    this.burstUntil = 0;

    // tune
    this.burstEveryMin = opts.burstEveryMin ?? 9500;   // ms
    this.burstEveryMax = opts.burstEveryMax ?? 14000;  // ms
    this.burstDuration = opts.burstDuration ?? 2800;   // ms
  }

  reset(now){
    this.step = 0;
    this.sideFlip = 0;
    this.nextBurstAt = now + this.rng.int(this.burstEveryMin, this.burstEveryMax);
    this.burstUntil = 0;
  }

  isBurst(now){
    return now < this.burstUntil;
  }

  maybeStartBurst(now){
    if (this.burstUntil && now < this.burstUntil) return;
    if (now >= this.nextBurstAt) {
      this.burstUntil = now + this.burstDuration;
      this.nextBurstAt = now + this.rng.int(this.burstEveryMin, this.burstEveryMax);
    }
  }

  // returns: { kind, posHint?, weightPreset?, spawnBias? }
  nextSpawnPlan(now, state, baseWeights){
    this.maybeStartBurst(now);

    const phase = state?.bossPhase || 1;
    const inBurst = this.isBurst(now);

    // --- weights ---
    // burst => mostly normal + a bit heal/shield (สะใจ + ไม่โหดเกิน)
    let weights = baseWeights;

    if (inBurst) {
      weights = [
        { v:'normal', w: 78 },
        { v:'heal',   w: 9 },
        { v:'shield', w: 9 },
        { v:'decoy',  w: 3 },
        { v:'bomb',   w: 1 }
      ];
    }

    // phase 3 เพิ่ม decoy/bomb บ้าง (ท้าทาย)
    if (!inBurst && phase >= 3) {
      weights = [
        { v:'normal', w: 58 },
        { v:'decoy',  w: 14 },
        { v:'bomb',   w: 10 },
        { v:'heal',   w: 9 },
        { v:'shield', w: 9 }
      ];
    }

    const kind = pickWeighted(this.rng, weights);

    // --- position hint (normalized 0..1) ---
    // NOTE: renderer ต้องรองรับ posHint ถึงจะ “ล็อกตำแหน่ง” ได้
    let posHint = null;

    if (phase === 2) {
      // left-right alternation
      this.sideFlip ^= 1;
      posHint = {
        x: this.sideFlip ? 0.25 : 0.75,
        y: 0.28 + 0.55 * this.rng.next()
      };
    } else if (phase >= 3) {
      // triangle / ring-ish cycle
      const t = (this.step++ % 6);
      const pts = [
        {x:0.25,y:0.30},{x:0.75,y:0.30},{x:0.50,y:0.62},
        {x:0.32,y:0.48},{x:0.68,y:0.48},{x:0.50,y:0.36}
      ];
      const p = pts[t] || pts[0];
      posHint = {
        x: clamp(p.x + (this.rng.next()-0.5)*0.06, 0.12, 0.88),
        y: clamp(p.y + (this.rng.next()-0.5)*0.08, 0.14, 0.86)
      };
    } else {
      // phase 1: mild random
      posHint = {
        x: 0.18 + 0.64 * this.rng.next(),
        y: 0.18 + 0.68 * this.rng.next()
      };
    }

    return { kind, posHint, inBurst };
  }

  // burst feels faster: reduce delay range
  spawnDelayMultiplier(now){
    return this.isBurst(now) ? 0.72 : 1.0;
  }
}