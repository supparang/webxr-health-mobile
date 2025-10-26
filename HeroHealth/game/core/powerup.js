// core/powerup.js — ระบบพาวเวอร์แบบมินิมอล
// ใช้ร่วมกับ main.js/goodjunk: มี score boost (x2 ชั่วคราว) และ timeScale เผื่ออนาคต
export class PowerUpSystem {
  constructor() {
    this.timeScale = 1;
    this._boostUntil = 0; // timestamp (ms) ที่ boost ยังทำงาน
  }

  // ใช้จากโหมด: apply('boost') -> คูณคะแนน 2x ~7s (ฝั่งคะแนนจริงดำเนินที่โหมด/เมน ถ้าต้องการ)
  apply(kind, opts = {}) {
    const now = performance?.now?.() || Date.now();
    if (kind === 'boost') {
      const ms = opts.ms ?? 7000;
      this._boostUntil = Math.max(this._boostUntil, now + ms);
      return true;
    }
    if (kind === 'slow') {
      // ตัวอย่าง: timeScale เพิ่มระยะ spawn (ยังไม่ใช้ในชุดหลักนี้)
      this.timeScale = 1.25;
      setTimeout(()=> this.timeScale = 1, 3000);
      return true;
    }
    return false;
  }

  // เผื่อโหมดอยากตรวจเอง
  get isBoosting() {
    const now = performance?.now?.() || Date.now();
    return now < this._boostUntil;
  }
}
