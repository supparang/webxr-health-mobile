// === /fitness/js/ai-predictor.js — Light AI Prediction HUD (A-40) ===
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
const lerp = (a,b,t)=>a+(b-a)*t;

// EWMA helper
function ewma(prev, x, alpha){
  if (prev == null || !isFinite(prev)) return x;
  return prev*(1-alpha) + x*alpha;
}

/**
 * Predictor outputs:
 * - focusScore 0..100
 * - missRisk 0..100
 * - pace 0..100
 * Explainable signals:
 * - rtEwma, missEwma, bombEwma, hitRateEwma
 */
export class AIPredictor {
  constructor(opts = {}) {
    this.enabled = !!opts.enabled;
    this.alphaRt = opts.alphaRt ?? 0.18;        // RT smoothing
    this.alphaRate = opts.alphaRate ?? 0.12;    // rate smoothing
    this.alphaMiss = opts.alphaMiss ?? 0.14;    // miss smoothing

    this.reset();
  }

  setEnabled(v){ this.enabled = !!v; }

  reset(){
    this.rtEwma = null;
    this.missEwma = 0;
    this.bombEwma = 0;
    this.hitRateEwma = 0; // hits per sec
    this.lastHitTs = 0;
    this.lastEventTs = 0;

    this.focusScore = 70;
    this.missRisk = 25;
    this.pace = 60;

    this.reason = '';
  }

  /**
   * @param {Object} state minimal needed: diffKey, bossPhase, shield, feverOn, playerHp
   * @param {Object} ev { type:'hit'|'miss'|'bomb'|'decoy'|'timeout', rtMs?, isNormal?, isBomb?, isDecoy? }
   * @param {number} now performance.now()
   */
  onEvent(state, ev, now){
    if (!this.enabled) return;

    const type = ev?.type || '';
    const rt = (typeof ev?.rtMs === 'number') ? ev.rtMs : null;

    // --- RT tracking (only when hit normal/bossface) ---
    if (type === 'hit' && rt != null) {
      this.rtEwma = ewma(this.rtEwma, rt, this.alphaRt);

      // hit rate (hits/sec) using dt since last hit
      if (this.lastHitTs > 0) {
        const dt = Math.max(80, now - this.lastHitTs);
        const instRate = 1000 / dt;
        this.hitRateEwma = ewma(this.hitRateEwma, instRate, this.alphaRate);
      }
      this.lastHitTs = now;

      // miss probability decays on good play
      this.missEwma = ewma(this.missEwma, 0, this.alphaMiss * 0.6);
      this.bombEwma = ewma(this.bombEwma, 0, this.alphaMiss * 0.6);
    }

    // --- Miss tracking ---
    if (type === 'miss' || type === 'timeout') {
      this.missEwma = ewma(this.missEwma, 1, this.alphaMiss);
    } else {
      this.missEwma = ewma(this.missEwma, 0, this.alphaMiss * 0.35);
    }

    // --- Bomb/decoy tracking ---
    if (type === 'bomb' || type === 'decoy') {
      this.bombEwma = ewma(this.bombEwma, 1, this.alphaMiss);
    } else {
      this.bombEwma = ewma(this.bombEwma, 0, this.alphaMiss * 0.35);
    }

    this.lastEventTs = now;

    this._compute(state);
  }

  /**
   * Periodic health check (low hp / fever / idle)
   */
  tick(state, now){
    if (!this.enabled) return;

    // idle -> risk rises a bit
    if (this.lastEventTs > 0 && now - this.lastEventTs > 1600) {
      this.missEwma = ewma(this.missEwma, 0.55, this.alphaMiss * 0.35);
      this._compute(state);
    }
  }

  _targetRtForDiff(diffKey){
    if (diffKey === 'easy') return 520;
    if (diffKey === 'hard') return 420;
    return 470; // normal
  }

  _targetRateForDiff(diffKey){
    // approximate hits/sec expectation
    if (diffKey === 'easy') return 0.90;
    if (diffKey === 'hard') return 1.25;
    return 1.05;
  }

  _compute(state){
    const diffKey = state?.diffKey || 'normal';
    const hp = clamp(state?.playerHp ?? 1, 0, 1);
    const shield = state?.shield ?? 0;
    const feverOn = !!state?.feverOn;
    const phase = state?.bossPhase ?? 1;

    const rtTarget = this._targetRtForDiff(diffKey);
    const rateTarget = this._targetRateForDiff(diffKey);

    const rt = (this.rtEwma == null) ? rtTarget : this.rtEwma;
    const rtBad = clamp((rt - rtTarget) / 260, 0, 1); // 0..1
    const miss = clamp(this.missEwma, 0, 1);
    const bomb = clamp(this.bombEwma, 0, 1);

    const rate = clamp(this.hitRateEwma, 0, 2.2);
    const paceRaw = clamp(rate / rateTarget, 0, 1.35);

    // risk combines: miss, bomb, slow rt, low hp
    let risk = 0;
    risk += miss * 0.45;
    risk += bomb * 0.22;
    risk += rtBad * 0.23;
    risk += (1 - hp) * 0.18;

    // shield reduces risk a bit, fever reduces risk (momentum)
    if (shield > 0) risk *= 0.90;
    if (feverOn) risk *= 0.88;

    // phase 3 is harder -> slight risk boost
    if (phase === 3) risk *= 1.08;

    risk = clamp(risk, 0, 1);

    // focus is inverse risk + pace alignment bonus
    const paceScore = clamp((paceRaw - 0.65) / 0.55, 0, 1); // 0..1
    let focus = 1 - risk;
    focus = focus * 0.78 + paceScore * 0.22;
    if (feverOn) focus = clamp(focus + 0.06, 0, 1);

    // pace output: 0..100 (centered at 100 when >= target)
    const paceOut = clamp(paceRaw / 1.0, 0, 1.25);

    this.missRisk = Math.round(risk * 100);
    this.focusScore = Math.round(clamp(focus, 0, 1) * 100);
    this.pace = Math.round(clamp(paceOut, 0, 1.25) * 80); // 0..100-ish

    // explainable reason (short)
    const parts = [];
    if (miss > 0.40) parts.push('missสูง');
    if (bomb > 0.35) parts.push('bomb/decoyบ่อย');
    if (rtBad > 0.45) parts.push('RTช้า');
    if (hp < 0.35) parts.push('HPต่ำ');
    if (!parts.length) parts.push('คุมจังหวะดี');
    this.reason = parts.join(' · ');
  }
}