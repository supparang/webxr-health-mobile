// === /fitness/js/ai-pattern.js ===
// Pattern Generator (seeded) for fun + fairness
// ✅ wave / burst / left-right / storm / weakpoint window
'use strict';

export class AIPatternGen {
  constructor(rng, opts = {}) {
    this.rng = rng;
    this.cfg = Object.assign({
      // zones: 0=TL,1=TR,2=CL,3=CR,4=BL,5=BR
      zones: [0,1,2,3,4,5],
      stormChance: 0.12,
      burstChance: 0.18,
      waveChance: 0.20,
      lrChance: 0.18,
      weakWindowMs: 2600,
      stormMs: 3400,
      stormRateMs: 220, // spawns faster inside storm
    }, opts);

    this.mode = 'idle'; // idle | wave | burst | lr | storm | weak
    this.until = 0;
    this.waveStep = 0;
    this.lrSide = 0; // 0 left, 1 right
  }

  _now() { return performance.now(); }

  // Called when boss phase changes / certain hp thresholds
  triggerWeakPoint() {
    this.mode = 'weak';
    this.until = this._now() + this.cfg.weakWindowMs;
  }

  maybeStartPattern(ctx) {
    const now = this._now();
    if (this.mode !== 'idle' && now < this.until) return;

    this.mode = 'idle';
    this.until = 0;

    // bossPhase 3 -> higher chance of patterns
    const phase = ctx?.bossPhase || 1;
    const pBoost = phase === 3 ? 0.10 : phase === 2 ? 0.05 : 0;

    const r = this.rng.next();
    if (r < this.cfg.stormChance + pBoost) {
      this.mode = 'storm';
      this.until = now + this.cfg.stormMs;
      return;
    }

    const r2 = this.rng.next();
    if (r2 < this.cfg.burstChance + pBoost) {
      this.mode = 'burst';
      this.until = now + 900;
      return;
    }

    const r3 = this.rng.next();
    if (r3 < this.cfg.waveChance + pBoost) {
      this.mode = 'wave';
      this.until = now + 1300;
      this.waveStep = 0;
      return;
    }

    const r4 = this.rng.next();
    if (r4 < this.cfg.lrChance + pBoost) {
      this.mode = 'lr';
      this.until = now + 1100;
      this.lrSide = this.rng.int(0,1);
      return;
    }
  }

  // returns spawn hints for renderer: {zone, biasX, biasY}
  nextHint(ctx) {
    const now = this._now();
    if (this.mode !== 'idle' && now >= this.until) this.mode = 'idle';

    // ensure a pattern sometimes
    this.maybeStartPattern(ctx);

    const phase = ctx?.bossPhase || 1;

    if (this.mode === 'weak') {
      // center-ish zones only
      const z = this.rng.pick([2,3]); // CL/CR
      return { zone: z, biasX: 0, biasY: -0.05, tag: 'weak' };
    }

    if (this.mode === 'storm') {
      // random but avoid bottom corners too often
      const z = this.rng.pick([0,1,2,3,4,5]);
      const by = (z === 4 || z === 5) ? -0.08 : 0;
      return { zone: z, biasX: 0, biasY: by, tag: 'storm' };
    }

    if (this.mode === 'burst') {
      // cluster in 2-3 zones for intensity
      const pool = phase === 3 ? [2,3,1,0] : [2,3,4,5];
      const z = this.rng.pick(pool);
      return { zone: z, biasX: 0, biasY: 0, tag: 'burst' };
    }

    if (this.mode === 'wave') {
      // TL -> TR -> CL -> CR -> BL -> BR
      const wave = [0,1,2,3,4,5];
      const z = wave[this.waveStep % wave.length];
      this.waveStep++;
      return { zone: z, biasX: 0, biasY: 0, tag: 'wave' };
    }

    if (this.mode === 'lr') {
      // left then right alternating
      const left = [0,2,4];
      const right = [1,3,5];
      const use = (this.lrSide === 0) ? left : right;
      this.lrSide = 1 - this.lrSide;
      return { zone: this.rng.pick(use), biasX: 0, biasY: 0, tag: 'lr' };
    }

    // idle: balanced random
    const z = this.rng.pick(this.cfg.zones);
    return { zone: z, biasX: 0, biasY: 0, tag: 'idle' };
  }

  // Storm rate override
  stormRateMs() {
    if (this.mode === 'storm') return this.cfg.stormRateMs;
    return null;
  }

  debug() {
    return { mode: this.mode, until: this.until };
  }
}