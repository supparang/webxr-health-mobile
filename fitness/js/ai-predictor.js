// === /fitness/js/ai-predictor.js ===
// Shadow Breaker — AI Predictor (DL-lite stub / simple heuristics)
// ✅ ESM export: AIPredictor (named) + default
// ✅ Safe: works even if you don't use ML yet

'use strict';

export class AIPredictor {
  constructor(opts = {}) {
    this.enabled = !!opts.enabled;   // default false
    this.state = {
      fatigue: 0,
      streak: 0,
      lastHitMs: 0,
      missBurst: 0,
    };
  }

  setEnabled(v){ this.enabled = !!v; }
  isEnabled(){ return !!this.enabled; }

  // optional: update from engine
  onEvent(ev = {}) {
    const t = Number(ev.tMs || 0);
    const type = ev.type || '';
    if (type === 'hit') {
      this.state.streak = Math.min(99, this.state.streak + 1);
      this.state.missBurst = Math.max(0, this.state.missBurst - 1);
      this.state.lastHitMs = t;
      this.state.fatigue = Math.max(0, this.state.fatigue - 0.02);
    } else if (type === 'miss') {
      this.state.streak = 0;
      this.state.missBurst = Math.min(10, this.state.missBurst + 1);
      this.state.fatigue = Math.min(1, this.state.fatigue + 0.05);
    }
  }

  // optional: prediction API (placeholder)
  predict(snapshot = {}) {
    // return something small and safe
    return {
      fatigue: this.state.fatigue,
      missBurst: this.state.missBurst,
      hint: this.state.missBurst >= 3 ? 'slow_down' : (this.state.fatigue >= 0.7 ? 'take_breath' : 'keep_rhythm')
    };
  }
}

export default AIPredictor;

// (optional) also expose global for debugging/back-compat
try { window.AIPredictor = AIPredictor; } catch {}