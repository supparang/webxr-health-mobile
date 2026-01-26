// === /fitness/js/ai-coach.js — PACK A: Explainable Micro-Tips (rate-limited) ===
'use strict';

export class AICoach {
  constructor(opts = {}) {
    this.cfg = Object.assign({
      tipEveryMs: 4200,
      minChangeToSpeak: 0.10 // ความเปลี่ยนแปลงของ delayMul/sizeMul ถึงจะคอมเมนต์
    }, opts);

    this.lastTipAt = 0;
    this.lastSnap = null;
  }

  maybeTip(now, state, directorSnap) {
    if (!state || !state.running) return null;
    if (!directorSnap) return null;

    if (now - this.lastTipAt < this.cfg.tipEveryMs) return null;

    const s = directorSnap;
    const prev = this.lastSnap;

    // เลือก tip ตามสถานการณ์
    let msg = null;
    let tone = 'good';

    // low hp warning
    if (state.playerHp <= 0.32) {
      msg = 'HP ใกล้หมด! โฟกัสเป้า ❤️/🛡️ เพื่อยื้อก่อน แล้วค่อยเร่งตี 🎯';
      tone = 'miss';
    }
    // bomb rate high
    else if (s.bombRate >= 12) {
      msg = `โดน 💣 บ่อย (${s.bombRate.toFixed(0)}%) ลอง “ช้าลงนิด” แล้วเล็งให้ชัดนะ 👀`;
      tone = 'bad';
    }
    // accuracy low
    else if (s.acc < 72) {
      msg = `ตอนนี้ Accuracy ${s.acc.toFixed(0)}% — ลองโฟกัสทีละเป้า ไม่ต้องรีบเกินไปนะ 🔄`;
      tone = 'bad';
    }
    // performance improving => warn speed-up
    else if (s.acc >= 88 && s.emaRt <= 360) {
      msg = `ดีมาก! RT เฉลี่ย ${s.emaRt}ms — บอสจะ “เร่งสปีด” ขึ้นนิดนึงนะ 💨`;
      tone = 'perfect';
    }
    // stability comment
    else if (s.stab >= 0.78) {
      msg = 'จังหวะนิ่งขึ้นแล้ว! รักษาความสม่ำเสมอ แล้วค่อยกดสปีดขึ้น 🚀';
      tone = 'good';
    }

    // ถ้าไม่มี message ตาม rules → ดู change ของ tuning แล้วคอมเมนต์แบบ explainable
    if (!msg && prev) {
      const dDelay = Math.abs(s.delayMul - prev.delayMul);
      const dSize  = Math.abs(s.sizeMul - prev.sizeMul);
      if (dDelay >= this.cfg.minChangeToSpeak) {
        msg = (s.delayMul < prev.delayMul)
          ? 'ทำได้ดี! ระบบจะปล่อยเป้า “ถี่ขึ้น” นิดนึงนะ 💥'
          : 'พักให้จับจังหวะก่อน ระบบจะปล่อยเป้า “ช้าลง” นิดนึงนะ 🙂';
        tone = s.delayMul < prev.delayMul ? 'perfect' : 'good';
      } else if (dSize >= this.cfg.minChangeToSpeak) {
        msg = (s.sizeMul < prev.sizeMul)
          ? 'เก่งขึ้นแล้ว! เป้าจะ “เล็กลง” เพื่อเพิ่มความท้าทาย 🎯'
          : 'โอเค! เป้าจะ “ใหญ่ขึ้น” ช่วยให้จับจังหวะได้ง่ายขึ้น 👍';
        tone = s.sizeMul < prev.sizeMul ? 'perfect' : 'good';
      }
    }

    if (!msg) return null;

    this.lastTipAt = now;
    this.lastSnap = Object.assign({}, s);
    return { msg, tone };
  }
}