// === fitness/js/ai-coach.js ===
// Shadow Breaker — Explainable micro-coach (rate-limited)
// Uses predictor contributions to generate short tips (Thai) while keeping game readable.

'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b,v));

function topKContrib(contrib, k=2){
  // contrib: {key: weight*value}
  const arr = Object.entries(contrib || {})
    .map(([k,v])=>({k, v: Number(v)||0, a: Math.abs(Number(v)||0)}))
    .sort((a,b)=> b.a - a.a);
  return arr.slice(0,k).map(o=>o.k);
}

function tipFor(keys, f){
  // Keep tips short, actionable, kid-friendly (Grade 5)
  const has = (k)=> keys.includes(k);

  // Priority: streak/miss/pressure then RT/vol then cadence
  if (has('streak') || has('miss') || has('pressure')) {
    if ((f.missStreak||0) >= 3) {
      return { msg: 'เริ่มพลาดติดกันแล้วนะ 😵 ลอง “ชะลอ 1 จังหวะ” แล้วค่อยต่อยให้ตรงกลาง!', tone:'coach' };
    }
    if ((f.pressure||0) > 0.65) {
      return { msg: 'ตอนนี้เกมกดดันขึ้น 🔥 โฟกัส “เป้าปกติ” ก่อน แล้วค่อยหลบระเบิด!', tone:'coach' };
    }
    return { msg: 'ถ้าเริ่มพลาดบ่อย ให้เล็งกลางจอ + ต่อยให้ชัวร์ก่อนเร็ว 👍', tone:'coach' };
  }

  if (has('rt') || has('vol')) {
    if ((f.vol||0) > 0.65) {
      return { msg: 'จังหวะยังไม่นิ่งนะ 🎯 ลองหายใจเข้า-ออก 1 ครั้ง แล้วต่อยให้เสมอกัน', tone:'coach' };
    }
    if ((f.rt||0) > 0.65) {
      return { msg: 'ตอนนี้ตอบสนองช้าลงนิดนึง ⏱️ ลอง “เตรียมมือไว้กลางจอ” แล้วต่อยทันทีที่เห็นเป้า', tone:'coach' };
    }
    return { msg: 'ดีมาก! ความเร็วกำลังมา ✨ รักษาจังหวะเดิมแล้วคุมความแม่นต่อไป', tone:'coach' };
  }

  if (has('aps')) {
    if ((f.aps||0) > 0.75) {
      return { msg: 'ต่อยถี่มาก! 💥 ระวังหลุดเป้า—เน้น “แม่นก่อนเร็ว” นะ', tone:'coach' };
    }
    return { msg: 'เพิ่มจังหวะอีกนิดได้ 👊 แต่ยังต้อง “ตรงเป้า” ก่อนเสมอ', tone:'coach' };
  }

  // fallback
  return { msg: 'สุดยอด! ไปต่อเลย 🚀', tone:'coach' };
}

export class AICoach {
  constructor(opts={}) {
    this.cfg = Object.assign({
      cooldownMs: 6500,
      minScoreDelta: 0, // future hook
    }, opts);

    this._lastTipAt = 0;
    this._lastShownAt = 0;
  }

  noteFeedbackShown(){
    this._lastShownAt = performance.now();
  }

  maybeTip(pred, features, state){
    const now = performance.now();
    if (now - this._lastTipAt < this.cfg.cooldownMs) return null;

    // don't spam when other feedback just shown
    if (now - this._lastShownAt < 900) return null;

    // Only when AI enabled and game running
    if (!state?.aiEnabled || !state?.running) return null;

    const pO = Number(pred?.pOverwhelm);
    const pM = Number(pred?.pMiss);

    // Trigger conditions
    const trigger =
      (Number.isFinite(pO) && pO > 0.62) ||
      (Number.isFinite(pM) && pM > 0.62) ||
      ((features?.missStreak||0) >= 3);

    if (!trigger) return null;

    const keys = topKContrib(pred?.contrib, 2);
    const tip = tipFor(keys, features || {});
    this._lastTipAt = now;
    return tip;
  }
}