// === Hero Health Academy — core/powerup.js
// ระบบพลังเสริมแบบรวมศูนย์: x2, freeze, sweep(magnet), boost(flat)
// - Back-compat: apply('boost'), attachToScore(score), timers.freeze > 0
// - ใหม่: apply('x2'|'freeze'|'sweep', seconds), getTimers(), isX2(), dispose()

export class PowerUpSystem {
  constructor() {
    this.timeScale = 1;

    // flat bonus (เพิ่มแต้มคงที่ต่อครั้งที่ให้คะแนน)
    this.scoreBoost = 0;
    this._boostTimeout = 0;

    // ตัวนับถอยหลังของพลัง (วินาที)
    this.timers = { x2: 0, freeze: 0, sweep: 0 };

    // ticker รวม (1s)
    this._tickerId = null;

    // ให้ ScoreSystem เรียกเพื่อคำนวณแต้มเพิ่ม (รับ base score n)
    this._boostFn = (n) => {
      const base = Number(n) || 0;
      // x2 = ให้แต้มเพิ่มเท่ากับ base (เพื่อ “คูณสอง”)
      const x2Extra = this.timers.x2 > 0 ? base : 0;
      // flat boost (เช่น +7 ต่อครั้ง)
      const flat = this.scoreBoost | 0;
      return x2Extra + flat;
    };
  }

  /* ============== Public API ============== */

  // ใช้แบบเดิม: 'boost' = flat bonus ชั่วคราว
  apply(kind, seconds) {
    if (kind === 'boost') {
      // boost 7 แต้มทุกรอบ add() เป็นเวลา 7 วินาที (คงเดิม)
      this.scoreBoost = 7;
      clearTimeout(this._boostTimeout);
      this._boostTimeout = setTimeout(() => { this.scoreBoost = 0; }, 7000);
      return;
    }
    // แบบใหม่: x2 / freeze / sweep (magnet next)
    if (kind === 'x2') {
      this._startTimer('x2', Number.isFinite(seconds) ? seconds|0 : 8);
      return;
    }
    if (kind === 'freeze') {
      this._startTimer('freeze', Number.isFinite(seconds) ? seconds|0 : 3);
      return;
    }
    if (kind === 'sweep' || kind === 'magnet') {
      this._startTimer('sweep', Number.isFinite(seconds) ? seconds|0 : 2);
      return;
    }
  }

  // ตัวช่วยสำหรับ ScoreSystem (เข้ากันกับเดิม)
  attachToScore(score) {
    if (!score || typeof score.setBoostFn !== 'function') return;
    score.setBoostFn((n) => this._boostFn(n));
  }

  // main สามารถเรียกทุก ~เฟรม/วิ เพื่อนำค่าไปแสดง HUD (หรือจะปล่อยให้ ticker ทำหน้าที่เองก็ได้)
  getTimers() {
    return { x2: this.timers.x2|0, freeze: this.timers.freeze|0, sweep: this.timers.sweep|0 };
  }

  isX2() { return (this.timers.x2|0) > 0; }

  // ตั้ง/อ่าน timeScale (เผื่อใช้กับระบบสแปวน์หรือเอฟเฟกต์อื่นนอกคลาสนี้)
  setTimeScale(v=1){ this.timeScale = Math.max(0.1, Math.min(2, Number(v)||1)); }
  getTimeScale(){ return this.timeScale; }

  // ล้างตัวจับเวลา/บูสต์ทั้งหมด (ตอนเปลี่ยนฉากหรือออกเกม)
  dispose() {
    clearTimeout(this._boostTimeout);
    this._boostTimeout = 0;
    this.scoreBoost = 0;
    this._stopTicker();
    this.timers.x2 = this.timers.freeze = this.timers.sweep = 0;
  }

  /* ============== Internals ============== */

  _startTimer(key, sec){
    const s = Math.max(0, sec|0);
    this.timers[key] = Math.max(this.timers[key]|0, s);
    this._ensureTicker();
  }

  _ensureTicker(){
    if (this._tickerId) return;
    this._tickerId = setInterval(()=>this._tick1s(), 1000);
  }

  _stopTicker(){
    if (this._tickerId){
      clearInterval(this._tickerId);
      this._tickerId = null;
    }
  }

  _tick1s(){
    let any = false;
    // ลดเวลาทีละ 1 วินาที (ไม่ผูกกับ timeScale เพื่อให้ UI/ข้อตกลงง่าย)
    for (const k of Object.keys(this.timers)){
      const v = Math.max(0, (this.timers[k]|0) - 1);
      if (v !== (this.timers[k]|0)) { this.timers[k] = v; any = true; }
    }
    // ถ้าทุกตัวเป็น 0 แล้ว ให้หยุด ticker เพื่อลดภาระ
    if (!this.timers.x2 && !this.timers.freeze && !this.timers.sweep) {
      this._stopTicker();
    }
  }
}
