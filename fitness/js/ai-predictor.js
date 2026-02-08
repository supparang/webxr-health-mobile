// === /fitness/js/ai-predictor.js ===
// Shadow Breaker — AI Predictor (DL-lite stub / heuristic)
// ✅ Provides named export: AIPredictor  (แก้ error import ใน engine.js)
// ✅ Also default export for future flexibility
// ✅ Safe: ยังไม่ทำ ML จริงก็ไม่พัง

'use strict';

export class AIPredictor {
  constructor(opts = {}) {
    this.enabled = (opts.enabled === true); // default false
    this.state = {
      fatigue: 0,      // 0..1
      missBurst: 0,    // 0..10
      streak: 0,       // 0..99
      lastT: 0
    };
  }

  setEnabled(v){ this.enabled = !!v; }
  isEnabled(){ return !!this.enabled; }

  onEvent(ev = {}) {
    const type = ev.type || '';
    const t = Number(ev.tMs ?? ev.t ?? 0) || 0;
    this.state.lastT = t;

    if (type === 'hit') {
      this.state.streak = Math.min(99, this.state.streak + 1);
      this.state.missBurst = Math.max(0, this.state.missBurst - 1);
      this.state.fatigue = Math.max(0, this.state.fatigue - 0.02);
    } else if (type === 'miss') {
      this.state.streak = 0;
      this.state.missBurst = Math.min(10, this.state.missBurst + 1);
      this.state.fatigue = Math.min(1, this.state.fatigue + 0.05);
    } else if (type === 'tick') {
      // ฟื้นช้า ๆ
      this.state.fatigue = Math.max(0, this.state.fatigue - 0.002);
    }
  }

  // DL-lite prediction stub (ยังไม่ทำ ML จริง)
  predict(snapshot = {}) {
    const fatigue = this.state.fatigue;
    const missBurst = this.state.missBurst;

    let hint = 'keep_rhythm';
    if (missBurst >= 3) hint = 'slow_down';
    else if (fatigue >= 0.7) hint = 'take_breath';
    else if ((snapshot.fever ?? 0) >= 100) hint = 'go_fever';

    return { fatigue, missBurst, hint };
  }
}

export default AIPredictor;

// optional: expose global for debugging/back-compat
try { window.AIPredictor = AIPredictor; } catch {}