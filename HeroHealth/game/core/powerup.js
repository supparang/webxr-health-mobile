// core/powerup.js
// ระบบพลังเสริม: score boost, freeze, timeScale

export class PowerUpSystem {
  constructor() {
    this.timeScale = 1;
    this.scoreBoost = 0;
    this._boostTimeout = 0;
    this.timers = { freeze: 0 };  // วินาทีคงเหลือ
    this._freezeTimerId = null;
  }

  // ใช้แบบสั้นในโหมด (เดิม): 'boost' -> เพิ่มคะแนนเสริมชั่วคราว
  apply(kind) {
    if (kind === 'boost') {
      // boost 7 แต้มทุกรอบ add() เป็นเวลา 7 วินาที
      this.scoreBoost = 7;
      clearTimeout(this._boostTimeout);
      this._boostTimeout = setTimeout(() => { this.scoreBoost = 0; }, 7000);
    }
  }

  // ตัวช่วยให้คะแนนพิเศษกับ ScoreSystem
  attachToScore(score) {
    if (!score || typeof score.setBoostFn !== 'function') return;
    score.setBoostFn((n) => (this.scoreBoost|0));
  }

  // Freeze การสแปวน์ชั่วคราว (main.js จะตรวจ timers.freeze > 0)
  freeze(ms = 2000) {
    const sec = Math.ceil(ms / 1000);
    this.timers.freeze = Math.max(this.timers.freeze|0, sec);
    if (this._freezeTimerId) return; // กำลังนับอยู่แล้ว

    this._freezeTimerId = setInterval(() => {
      this.timers.freeze = Math.max(0, (this.timers.freeze|0) - 1);
      if (this.timers.freeze <= 0) {
        clearInterval(this._freezeTimerId);
        this._freezeTimerId = null;
      }
    }, 1000);
  }
}
