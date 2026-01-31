// === /fitness/js/ai-director.js ===
// Shadow Breaker — AI Difficulty Director (pack A)
//
// Responsibilities:
// - Turn predictor output into smooth difficulty assistance
// - Adjust: spawn interval multiplier + target-type weights
// - Keep it fair: bounded, gradual, explainable

'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b,v));

function ema(prev, next, alpha){
  if (!Number.isFinite(prev)) return next;
  return prev + alpha*(next-prev);
}

// Backward-compatible helper used by engine.js
export function computeAssist(state){
  // base heuristic (fallback if AI not available)
  const hp = Number(state?.playerHp ?? 1);
  const miss = Number(state?.miss ?? 0);
  const streak = Number(state?.missStreak ?? 0);

  // spawnMul > 1 = slower spawn
  let spawnMul = 1.0;
  if (hp < 0.4) spawnMul *= 1.12;
  if (miss >= 10) spawnMul *= 1.06;
  if (streak >= 3) spawnMul *= 1.08;

  // ttlMul > 1 = longer time-to-live
  let ttlMul = 1.0;
  if (hp < 0.45) ttlMul *= 1.10;
  if (streak >= 3) ttlMul *= 1.08;

  // sizeMul > 1 = larger targets
  let sizeMul = 1.0;
  if (hp < 0.4) sizeMul *= 1.07;
  if (streak >= 4) sizeMul *= 1.08;

  const out = {
    spawnMul: clamp(spawnMul, 0.75, 1.35),
    ttlMul: clamp(ttlMul, 0.90, 1.35),
    sizeMul: clamp(sizeMul, 0.90, 1.25),
    targetWeights: null,
    prediction: null,
  };

  // AI-powered override if available (play + ?ai=1 only)
  if (state?.aiEnabled && state?.ai?.director && state?.ai?.lastFeatures) {
    const dir = state.ai.director;
    const f = state.ai.lastFeatures;

    const pred = dir.predict(f);
    out.prediction = pred;

    // Blend spawn multiplier (keep bounded)
    const aiSpawnMul = dir.getSpawnMul(f);
    out.spawnMul = clamp(out.spawnMul * aiSpawnMul, 0.75, 1.35);

    // Dynamic target weights
    out.targetWeights = dir.getWeights(f);
  }

  return out;
}

export class AIDirector {
  constructor(predictor, opts={}){
    this.predictor = predictor;
    this.cfg = Object.assign({
      // strength: 0..1
      strength: 0.85,
      emaAlpha: 0.20
    }, opts);

    this._emaMiss = NaN;
    this._emaOver = NaN;
    this.lastPred = null;
  }

  predict(features){
    const raw = this.predictor.predict(features);
    this._emaMiss = ema(this._emaMiss, raw.pMiss, this.cfg.emaAlpha);
    this._emaOver = ema(this._emaOver, raw.pOverwhelm, this.cfg.emaAlpha);

    const pMiss = clamp(this._emaMiss, 0.05, 0.95);
    const pOverwhelm = clamp(this._emaOver, 0.05, 0.95);

    const out = { ...raw, pMiss, pOverwhelm };
    this.lastPred = out;
    return out;
  }

  getSpawnMul(features){
    const pred = this.predict(features);
    const pO = pred.pOverwhelm;

    // struggle: higher => slow down spawns
    const struggle = clamp((pO - 0.58) / 0.32, 0, 1);
    // hot: lower overwhelm => can speed up a bit
    const hot = clamp((0.48 - pO) / 0.22, 0, 1);

    let mul = 1.0;
    mul *= (1 + this.cfg.strength * 0.22 * struggle);
    mul *= (1 - this.cfg.strength * 0.10 * hot);

    return clamp(mul, 0.75, 1.35);
  }

  getWeights(features){
    const pred = this.predict(features);
    const pO = pred.pOverwhelm;

    // base weights (sum doesn't need to be 100; relative only)
    let wNormal = 64, wDecoy = 10, wBomb = 8, wHeal = 9, wShield = 9;

    const struggle = clamp((pO - 0.58) / 0.32, 0, 1);
    const hot = clamp((0.48 - pO) / 0.22, 0, 1);

    // If struggling: fewer bombs/decoys, more heal/shield, slightly more normal
    wBomb  *= (1 - 0.55*struggle);
    wDecoy *= (1 - 0.35*struggle);
    wHeal  *= (1 + 0.55*struggle);
    wShield*= (1 + 0.40*struggle);
    wNormal*= (1 + 0.12*struggle);

    // If doing great: nudge challenge (more bomb/decoy)
    wBomb  *= (1 + 0.35*hot);
    wDecoy *= (1 + 0.25*hot);
    wHeal  *= (1 - 0.18*hot);
    wShield*= (1 - 0.12*hot);

    // keep sane bounds
    wBomb = clamp(wBomb, 3, 20);
    wDecoy = clamp(wDecoy, 5, 18);
    wHeal = clamp(wHeal, 4, 18);
    wShield = clamp(wShield, 4, 18);
    wNormal = clamp(wNormal, 45, 85);

    return [
      { v:'normal', w:wNormal },
      { v:'decoy',  w:wDecoy },
      { v:'bomb',   w:wBomb },
      { v:'heal',   w:wHeal },
      { v:'shield', w:wShield }
    ];
  }
}