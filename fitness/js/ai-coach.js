// === /fitness/js/ai-coach.js ===
// A-63 AI Coach: rule-based micro-tips (explainable + rate-limited)

'use strict';

function nowMs(){ return performance.now(); }

export class AICoach {
  constructor(opts){
    const o = opts || {};
    this.cooldownMs = typeof o.cooldownMs === 'number' ? o.cooldownMs : 3800;
    this.lastTipAt = 0;
  }

  canTip(){
    return (nowMs() - this.lastTipAt) >= this.cooldownMs;
  }

  tip(state){
    if (!state) return null;
    if (!this.canTip()) return null;

    const p = state.ml?.lastPMiss ?? 0.12;
    const fatigue = state.perf?.fatigue ?? 0.0;
    const emaRt = state.perf?.emaRt ?? 420;
    const phase = state.bossPhase ?? 1;
    const lowHp = (state.playerHp ?? 1) < 0.42;

    // เงื่อนไขหลัก (เรียงความสำคัญ)
    if (lowHp && (p >= 0.55 || fatigue >= 0.65)) {
      return this._emit('HP ต่ำ + เสี่ยงพลาดสูง — เล่น “ชัวร์ก่อนเร็ว” โฟกัสเป้ากลาง 👀', 'miss');
    }

    if (fatigue >= 0.72) {
      return this._emit('AI ตรวจเจอเริ่มล้า (RT ช้าลงต่อเนื่อง) — หายใจลึก ๆ แล้วตีจังหวะเดิม 🔄', 'miss');
    }

    if (phase === 3 && emaRt > 520) {
      return this._emit('เฟส 3 เร็วขึ้นแล้ว — ลอง “แตะทันทีที่เห็น” ไม่ต้องรอเป้าใหญ่ 👍', 'good');
    }

    // ถ้าพลาดติด ๆ
    if ((state.perf?.missStreak ?? 0) >= 2) {
      return this._emit('พลาดติดกัน — ลดการสแกนทั้งจอ แล้วล็อกโซนกลางก่อน 🎯', 'miss');
    }

    // ถ้าโดน bomb บ่อย
    if ((state.perf?.bombHits ?? 0) >= 2 && (state.perf?.bombHits % 2 === 0)) {
      return this._emit('โดนระเบิดหลายครั้ง — อย่าตี “สีแดง” ถ้ามั่นใจไม่พอ ให้ผ่านไป ⛔', 'bad');
    }

    return null;
  }

  _emit(text, tone){
    this.lastTipAt = nowMs();
    return { text, tone: tone || 'good' };
  }
}