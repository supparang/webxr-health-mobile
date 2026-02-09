// === /fitness/js/ai-predictor.js ===
// Shadow Breaker — AI Predictor (DL-lite stub + robust exports)
// ✅ FIX: provide named exports used by engine.js
// Exports: AIPredictor, RB_AI (optional compat), default

'use strict';

// DL-lite แบบเบา ๆ (ไม่ใช้ lib) — ใช้ feature ง่าย ๆ เพื่อคาดการณ์ “ความเสี่ยงพลาด”
export class AIPredictor {
  constructor(opts = {}) {
    this.enabled = opts.enabled ?? true;
    this.last = {
      risk: 0,
      fatigue: 0,
      pace: 0,
      note: ''
    };
  }

  setEnabled(v){ this.enabled = !!v; }
  isEnabled(){ return this.enabled; }

  // snapshot: { missRate, combo, avgRtMs, streakMiss, timeLeftMs, fever, phase, diff }
  predict(snapshot = {}) {
    if (!this.enabled) return { ...this.last, note:'disabled' };

    const missRate = Number(snapshot.missRate ?? 0);        // 0..1
    const avgRt    = Number(snapshot.avgRtMs ?? 0);         // ms
    const streakM  = Number(snapshot.streakMiss ?? 0);      // int
    const combo    = Number(snapshot.combo ?? 0);           // int
    const phase    = Number(snapshot.phase ?? 1);           // 1..
    const diff     = String(snapshot.diff ?? 'normal');

    // normalize
    const rtScore = clamp((avgRt - 350) / 550, 0, 1);       // 350..900ms
    const missScore = clamp(missRate / 0.28, 0, 1);         // 0..28% missRate
    const streakScore = clamp(streakM / 4, 0, 1);

    // fatigue (0..1)
    const fatigue = clamp(0.45*rtScore + 0.35*missScore + 0.20*streakScore, 0, 1);

    // risk of next miss (0..1)
    const diffBoost = diff === 'hard' ? 0.10 : diff === 'easy' ? -0.06 : 0;
    const phaseBoost = clamp((phase-1) * 0.05, 0, 0.15);

    let risk = clamp(0.55*missScore + 0.30*rtScore + 0.15*streakScore + diffBoost + phaseBoost, 0, 1);

    // combo ลด risk นิดหน่อย (คนกำลังเข้าจังหวะ)
    risk = clamp(risk - clamp(combo/40, 0, 0.18), 0, 1);

    // pace suggestion (spawn interval multiplier)
    // >1 = ช้าลง, <1 = เร็วขึ้น
    const pace = clamp(1.0 + (fatigue - 0.5) * 0.35, 0.78, 1.28);

    const note =
      risk >= 0.72 ? 'high-risk' :
      risk >= 0.48 ? 'mid-risk'  :
      'low-risk';

    this.last = { risk, fatigue, pace, note };
    return this.last;
  }

  // micro-tip แบบอธิบายได้ (ไม่ spam)
  tip(snapshot = {}) {
    const p = this.predict(snapshot);
    if (p.note === 'high-risk') {
      return { code:'reset', text:'จังหวะเริ่มหลุดแล้ว—พักครึ่งวิ แล้วกลับไปตี “Normal” ให้ตรงก่อน', why:'miss/RT สูงขึ้น' };
    }
    if (p.note === 'mid-risk') {
      return { code:'focus', text:'โฟกัสเป้าใหญ่ก่อน แล้วค่อยเก็บเป้าอื่น', why:'เสถียรภาพยังแกว่ง' };
    }
    return { code:'keep', text:'ดีมาก! รักษาจังหวะไว้', why:'ความเสี่ยงพลาดต่ำ' };
  }
}

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// ===== compat exports =====
// บางไฟล์เคยเรียก RB_AI มาก่อน: ให้มีไว้ไม่พัง
export const RB_AI = {
  _inst: new AIPredictor(),
  isAssistEnabled(){ return true; },
  predict(s){ return this._inst.predict(s); },
  tip(s){ return this._inst.tip(s); }
};

// default export เผื่อ import แบบ default
export default AIPredictor;
