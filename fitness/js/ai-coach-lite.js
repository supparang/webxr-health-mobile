// === /fitness/js/ai-coach-lite.js ===
// AI Coach (Explainable, rate-limited, non-annoying)
// ✅ giveTip(event, context) => {text, tone} | null

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class AICoachLite {
  constructor(opts = {}) {
    this.enabled = opts.enabled ?? true;
    this.cooldownMs = opts.cooldownMs ?? 2600;
    this.maxTipsPerRun = opts.maxTipsPerRun ?? 10;

    this._lastTipAt = 0;
    this._tips = 0;

    this._missStreak = 0;
    this._lateStreak = 0;
    this._bombStreak = 0;
    this._phaseLast = 1;
  }

  reset() {
    this._lastTipAt = 0;
    this._tips = 0;
    this._missStreak = 0;
    this._lateStreak = 0;
    this._bombStreak = 0;
    this._phaseLast = 1;
  }

  canTip(now){
    if (!this.enabled) return false;
    if (this._tips >= this.maxTipsPerRun) return false;
    return (now - this._lastTipAt) >= this.cooldownMs;
  }

  tip(now, text, tone='good'){
    if (!this.canTip(now)) return null;
    this._lastTipAt = now;
    this._tips++;
    return { text, tone };
  }

  /**
   * @param {string} ev - 'hit'|'timeout'|'bomb'|'phase'|'storm'
   * @param {Object} c  - context
   */
  giveTip(ev, c = {}) {
    const now = performance.now();

    const phase = clamp(c.phase ?? 1, 1, 3) | 0;
    const feverOn = !!c.feverOn;
    const hp = clamp(c.playerHp ?? 1, 0, 1);
    const rt = c.rtMs != null ? Number(c.rtMs) : null;
    const weakZone = c.weakZone != null ? Number(c.weakZone) : -1;

    if (phase !== this._phaseLast) {
      this._phaseLast = phase;
      return this.tip(now, `⚔️ Phase ${phase} เร็วขึ้น! โฟกัส “เป้ากลาง” ก่อน แล้วค่อยเก็บขอบ`, 'good');
    }

    if (ev === 'storm') {
      return this.tip(now, `🌪️ Storm มาแล้ว! เลือก “ตีให้ชัวร์” มากกว่า “รีบมั่ว”`, 'good');
    }

    if (ev === 'timeout') {
      this._missStreak++;
      if (this._missStreak >= 2) {
        const ztxt = (weakZone >= 0) ? ` (โซน ${weakZone+1})` : '';
        return this.tip(now, `👀 พลาดติดกัน${ztxt} ลอง “รอเป้าโผล่เต็มวง” แล้วค่อยตี`, 'miss');
      }
      if (hp < 0.35) {
        return this.tip(now, `🧠 HP ต่ำแล้ว! เลือกเก็บ 🩹/🛡️ ก่อน เพื่ออยู่ให้ครบเวลา`, 'miss');
      }
      return null;
    }

    if (ev === 'bomb') {
      this._bombStreak++;
      if (this._bombStreak >= 2) {
        return this.tip(now, `💣 ระวังเป้าแดง/ลวง! ถ้าไม่มั่นใจ “ปล่อยผ่าน” ยังดีกว่าตีผิด`, 'bad');
      }
      return null;
    }

    if (ev === 'hit') {
      this._missStreak = 0;

      if (rt != null && rt > 520) {
        this._lateStreak++;
        if (this._lateStreak >= 2) {
          const ztxt = (weakZone >= 0) ? ` โซน ${weakZone+1}` : '';
          return this.tip(now, `⏱️ ช้าไปนิด ลอง “ย้ายสายตาล่วงหน้า” ไป${ztxt} แล้วค่อยตี`, 'bad');
        }
      } else {
        this._lateStreak = 0;
      }

      if (feverOn && Math.random() < 0.25) {
        return this.tip(now, `🔥 FEVER ON! ตอนนี้ “ตีต่อเนื่อง” จะคุ้มที่สุด`, 'perfect');
      }

      return null;
    }

    return null;
  }
}