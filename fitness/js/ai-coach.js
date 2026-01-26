// === /fitness/js/ai-coach.js ===
// AI Coach — explainable micro-tips (rate-limited)
'use strict';

export class AICoach {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      minIntervalMs: 2100,
      maxPerRun: 10
    }, opts);
    this.reset();
  }

  reset(){
    this.lastTipAt = 0;
    this.sent = 0;
    this.lastId = '';
  }

  shouldTip(now){
    if (this.sent >= this.cfg.maxPerRun) return false;
    if (now - this.lastTipAt < this.cfg.minIntervalMs) return false;
    return true;
  }

  makeTip(now, ctx){
    // ctx: {riskLabel, rtAvg, missRate, bias, phase, feverOn}
    if (!this.shouldTip(now)) return null;

    const risk = ctx.riskLabel || 'MED';
    const miss = ctx.missRate ?? 0;
    const rt = ctx.rtAvg ?? 0;
    const bias = ctx.bias ?? 0; // + = left worse

    let id = 'tip_generic';
    let msg = 'คุมจังหวะให้สม่ำเสมอ แล้วค่อยเพิ่มความเร็วทีละนิดนะ';

    if (risk === 'HIGH' && miss > 0.25) {
      id = 'tip_focus';
      msg = 'เริ่มพลาดถี่ขึ้นแล้วนะ 👀 ลอง “ชะลอ 1 จังหวะ” แล้วตีให้แม่นก่อน';
    } else if (risk === 'HIGH' && rt > 560) {
      id = 'tip_fast';
      msg = 'Reaction ช้าลงนิดนึง! ลอง “เตรียมมือค้างไว้” และตีทันทีที่เห็นเป้า';
    } else if (Math.abs(bias) > 0.10) {
      id = 'tip_zone';
      msg = bias > 0
        ? 'ฝั่งซ้ายพลาดมากกว่า ลองเล็งซ้ายให้ชัดขึ้น 2–3 ครั้งติดนะ'
        : 'ฝั่งขวาพลาดมากกว่า ลองเล็งขวาให้ชัดขึ้น 2–3 ครั้งติดนะ';
    } else if (ctx.phase >= 3 && risk !== 'LOW') {
      id = 'tip_phase3';
      msg = 'Phase 3 เร็วขึ้น! ให้ “ตีเป้าเล็กก่อน” แล้วค่อยเก็บเป้าอื่น';
    } else if (ctx.feverOn) {
      id = 'tip_fever';
      msg = 'FEVER ON! 🔥 ตอนนี้ตีรัวได้ แต่ยังต้อง “ไม่โดนระเบิด” นะ';
    }

    // avoid same tip spam
    if (id === this.lastId) return null;

    this.lastTipAt = now;
    this.lastId = id;
    this.sent++;
    return { id, msg };
  }
}