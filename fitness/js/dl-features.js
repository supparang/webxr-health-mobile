// === fitness/js/dl-features.js ===
// Shadow Breaker — lightweight "DL-style" feature tracker (online, no training)
// Purpose: stable, smoothed features for AI Predictor/Director/Coach.
//
// This is NOT a heavy deep-learning model; it is a feature pipeline inspired by
// online-learning setups: EMAs, volatility, streaks, and workload signals.

'use strict';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function ema(prev, next, alpha){
  if (!Number.isFinite(prev)) return next;
  return prev + alpha * (next - prev);
}

function safeDiv(a,b, fallback=0){
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return fallback;
  return a / b;
}

export class FeatureTracker {
  constructor(opts = {}) {
    const cfg = Object.assign({
      // smoothing
      alphaFast: 0.22,
      alphaSlow: 0.08,
      // normalization anchors (ms)
      rtGoodMs: 380,
      rtBadMs: 650
    }, opts);

    this.cfg = cfg;
    this.reset();
  }

  reset(){
    // time
    this.tMs = 0;
    this.actions = 0;

    // hit/miss counts
    this.hits = 0;
    this.misses = 0;
    this.realMisses = 0;

    // streaks
    this.hitStreak = 0;
    this.missStreak = 0;

    // RT tracking (normal/bossface only)
    this.emaRtFast = NaN;
    this.emaRtSlow = NaN;

    // volatility (EMA of abs deviation)
    this.emaRtDev = NaN;

    // workload / cadence
    this.emaAps = NaN;           // actions per second
    this._apsWindowMs = 0;
    this._apsWindowActions = 0;

    // pressure/control indicators (0..1)
    this.emaPressure = NaN;
    this.emaControl = NaN;

    // last outcomes
    this.lastGrade = '';
    this.lastTargetType = '';
  }

  tick(dtMs, ctx = null){
    if (!Number.isFinite(dtMs) || dtMs < 0) return;
    this.tMs += dtMs;

    // update APS window
    this._apsWindowMs += dtMs;
    if (this._apsWindowMs >= 600) { // ~0.6s window
      const aps = safeDiv(this._apsWindowActions, this._apsWindowMs/1000, 0);
      this.emaAps = ema(this.emaAps, aps, this.cfg.alphaSlow);
      this._apsWindowMs = 0;
      this._apsWindowActions = 0;
    }

    // update pressure/control from game context
    if (ctx) {
      const phase = Number(ctx.bossPhase || 1);
      const hp = Number(ctx.playerHp ?? 1);
      const timeLeft = Number(ctx.timeLeftMs ?? 0);
      const duration = Number(ctx.durationSec ?? 60) * 1000;

      const timePressure = duration > 0 ? (1 - clamp(timeLeft / duration, 0, 1)) : 0;
      const lowHp = hp <= 0.35 ? (0.35 - hp) / 0.35 : 0; // 0..1

      const streak = clamp(this.missStreak / 4, 0, 1);
      const phasePressure = phase === 1 ? 0.10 : phase === 2 ? 0.25 : 0.45;

      const rawP = clamp(0.40*streak + 0.35*lowHp + 0.25*timePressure + phasePressure, 0, 1);
      this.emaPressure = ema(this.emaPressure, rawP, this.cfg.alphaSlow);

      // control is higher when RT stable and misses low
      const rtNorm = this.getRtNorm(); // 0..1 (higher means slower)
      const rtStability = 1 - clamp(this.emaRtDev / 220, 0, 1);
      const rawC = clamp(0.55*(1-rawP) + 0.25*rtStability + 0.20*(1-rtNorm), 0, 1);
      this.emaControl = ema(this.emaControl, rawC, this.cfg.alphaSlow);
    }
  }

  onAction(){
    this.actions++;
    this._apsWindowActions++;
  }

  onHit({ rtMs, targetType, grade } = {}){
    this.onAction();
    this.hits++;
    this.hitStreak++;
    this.missStreak = 0;
    this.lastGrade = grade || '';
    this.lastTargetType = targetType || '';

    if (Number.isFinite(rtMs) && (targetType === 'normal' || targetType === 'bossface')) {
      const r = clamp(rtMs, 80, 1500);
      this.emaRtFast = ema(this.emaRtFast, r, this.cfg.alphaFast);
      this.emaRtSlow = ema(this.emaRtSlow, r, this.cfg.alphaSlow);

      const mu = Number.isFinite(this.emaRtSlow) ? this.emaRtSlow : r;
      const dev = Math.abs(r - mu);
      this.emaRtDev = ema(this.emaRtDev, dev, this.cfg.alphaSlow);
    }
  }

  onMiss({ targetType, realMiss = true } = {}){
    this.onAction();
    this.misses++;
    if (realMiss) this.realMisses++;
    this.missStreak++;
    this.hitStreak = 0;
    this.lastGrade = realMiss ? 'miss' : 'skip';
    this.lastTargetType = targetType || '';
  }

  // --- normalized feature helpers ---
  getRtNorm(){
    const mu = Number.isFinite(this.emaRtFast) ? this.emaRtFast : 520;
    const { rtGoodMs, rtBadMs } = this.cfg;
    const v = (mu - rtGoodMs) / Math.max(1, (rtBadMs - rtGoodMs));
    return clamp(v, 0, 1);
  }

  getVolNorm(){
    const dev = Number.isFinite(this.emaRtDev) ? this.emaRtDev : 120;
    return clamp(dev / 260, 0, 1);
  }

  getMissRateNorm(){
    const total = this.hits + this.realMisses;
    const rate = total > 0 ? (this.realMisses / total) : 0;
    return clamp(rate * 2.2, 0, 1);
  }

  getApsNorm(){
    const aps = Number.isFinite(this.emaAps) ? this.emaAps : 1.2;
    return clamp((aps - 0.6) / 2.4, 0, 1);
  }

  getStreakNorm(){
    return clamp(this.missStreak / 4, 0, 1);
  }

  // returns a stable feature object (mostly 0..1)
  snapshot(ctx = null){
    const rt = this.getRtNorm();
    const vol = this.getVolNorm();
    const miss = this.getMissRateNorm();
    const streak = this.getStreakNorm();
    const aps = this.getApsNorm();

    const phase = ctx ? Number(ctx.bossPhase || 1) : 1;
    const phaseN = phase === 1 ? 0.0 : phase === 2 ? 0.5 : 1.0;

    const hp = ctx ? Number(ctx.playerHp ?? 1) : 1;
    const lowHp = hp <= 0.35 ? (0.35 - hp) / 0.35 : 0; // 0..1

    const timeLeft = ctx ? Number(ctx.timeLeftMs ?? 0) : 0;
    const duration = ctx ? (Number(ctx.durationSec ?? 60) * 1000) : 60000;
    const timeP = duration > 0 ? (1 - clamp(timeLeft / duration, 0, 1)) : 0;

    const pressure = Number.isFinite(this.emaPressure)
      ? this.emaPressure
      : clamp(0.45*streak + 0.35*lowHp + 0.20*timeP + 0.15*phaseN, 0, 1);

    const control = Number.isFinite(this.emaControl)
      ? this.emaControl
      : clamp(1 - pressure, 0, 1);

    return {
      rt, vol, miss, streak, aps,
      phase: phaseN,
      lowHp: clamp(lowHp, 0, 1),
      timeP: clamp(timeP, 0, 1),
      pressure: clamp(pressure, 0, 1),
      control: clamp(control, 0, 1),

      // raw extras (for coach/explainability)
      missStreak: this.missStreak,
      hitStreak: this.hitStreak,
      emaRtFast: Number.isFinite(this.emaRtFast) ? this.emaRtFast : '',
      emaRtDev: Number.isFinite(this.emaRtDev) ? this.emaRtDev : ''
    };
  }
}