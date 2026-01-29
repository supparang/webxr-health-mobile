// === /fitness/js/ai-director.js — Adaptive Director (A-37) ===
// Fair + smooth difficulty adaptation using risk score (0..1)
// - High risk => assist (less hazards, more help, slower spawn, bigger targets, longer TTL)
// - Low risk  => challenge (more hazards, faster spawn, smaller targets, shorter TTL)
// - EMA smoothing + cooldown + bounded adjustments
'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp  = (a, b, t) => a + (b - a) * t;

export class AIDirector {
  constructor(opts = {}) {
    this.enabled = !!opts.enabled;

    // smooth + limiter
    this.riskEma = 0.25;
    this.emaAlpha = opts.emaAlpha ?? 0.18; // 0.1..0.25
    this.lastAdjustAt = 0;
    this.cooldownMs = opts.cooldownMs ?? 700; // prevent jitter

    // director output multipliers
    this.spawnMul = 1.0;
    this.ttlMul   = 1.0;
    this.sizeMul  = 1.0;

    // hazard weights multipliers
    this.wBomb  = 1.0;
    this.wDecoy = 1.0;
    this.wHeal  = 1.0;
    this.wShield= 1.0;

    // bounds (fairness)
    this.bounds = {
      spawnMulMin: 0.75,  // slower
      spawnMulMax: 1.35,  // faster
      ttlMulMin:   0.82,
      ttlMulMax:   1.25,
      sizeMulMin:  0.88,
      sizeMulMax:  1.18,
      wHazMin:     0.55,
      wHazMax:     1.55,
      wHelpMin:    0.70,
      wHelpMax:    1.70
    };

    // for debugging/UI
    this.debug = {
      lastRisk: 0.25,
      mode: 'neutral'
    };
  }

  setEnabled(v) {
    this.enabled = !!v;
  }

  // risk: 0..1 (higher => more likely to fail soon)
  tick(nowMs, risk) {
    if (!this.enabled) return;

    const r = clamp(Number(risk) || 0, 0, 1);
    this.debug.lastRisk = r;

    // EMA smoothing
    this.riskEma = lerp(this.riskEma, r, this.emaAlpha);

    // cooldown gate
    if ((nowMs - this.lastAdjustAt) < this.cooldownMs) return;
    this.lastAdjustAt = nowMs;

    // convert riskEma -> assist/challenge factor
    // assistT: 0 (risk low) .. 1 (risk high)
    const assistT = clamp((this.riskEma - 0.25) / 0.55, 0, 1);
    const challT  = 1 - assistT;

    // outputs: assistance when risk high
    // spawnMul <1 => slower spawn ; >1 => faster spawn
    this.spawnMul = clamp(lerp(1.25, 0.85, assistT), this.bounds.spawnMulMin, this.bounds.spawnMulMax);
    this.ttlMul   = clamp(lerp(0.90, 1.18, assistT), this.bounds.ttlMulMin,   this.bounds.ttlMulMax);
    this.sizeMul  = clamp(lerp(0.94, 1.12, assistT), this.bounds.sizeMulMin,  this.bounds.sizeMulMax);

    // hazards: bomb/decoy (assist => reduce)
    this.wBomb  = clamp(lerp(1.35, 0.70, assistT), this.bounds.wHazMin, this.bounds.wHazMax);
    this.wDecoy = clamp(lerp(1.25, 0.75, assistT), this.bounds.wHazMin, this.bounds.wHazMax);

    // helps: heal/shield (assist => increase)
    this.wHeal  = clamp(lerp(0.85, 1.55, assistT), this.bounds.wHelpMin, this.bounds.wHelpMax);
    this.wShield= clamp(lerp(0.90, 1.45, assistT), this.bounds.wHelpMin, this.bounds.wHelpMax);

    // debug mode label
    this.debug.mode =
      assistT > 0.75 ? 'assist++' :
      assistT > 0.45 ? 'assist+'  :
      assistT < 0.15 ? 'challenge++' :
      assistT < 0.30 ? 'challenge+'  :
      'neutral';
  }

  // apply to spawn interval range
  applySpawnDelay(minMs, maxMs) {
    const mul = this.enabled ? this.spawnMul : 1.0;
    // mul <1 => slower (longer delay), so invert for delay
    const delayMul = 1 / mul;
    return [
      Math.round(minMs * delayMul),
      Math.round(maxMs * delayMul),
    ];
  }

  // apply to ttl and size
  applyTtl(ttlMs) {
    return Math.round(ttlMs * (this.enabled ? this.ttlMul : 1.0));
  }
  applySize(px) {
    return Math.round(px * (this.enabled ? this.sizeMul : 1.0));
  }

  // reweight spawn pick weights
  applyWeights(baseWeights) {
    if (!this.enabled) return baseWeights;

    // baseWeights = [{v,w}, ...]
    return baseWeights.map(it => {
      let m = 1.0;
      if (it.v === 'bomb')   m = this.wBomb;
      if (it.v === 'decoy')  m = this.wDecoy;
      if (it.v === 'heal')   m = this.wHeal;
      if (it.v === 'shield') m = this.wShield;
      return { v: it.v, w: Math.max(0.0001, it.w * m) };
    });
  }
}