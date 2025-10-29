// === Hero Health Academy — core/score.js (unified v2; back-compat + upgrades) ===
// ใช้แทนเวอร์ชันก่อนหน้าได้ทันที (ลบไฟล์/คลาสซ้ำออกให้เหลืออันนี้อันเดียว)
//
// API ที่รองรับ:
//   const score = new ScoreSystem({ base?, gradeBreaks?, gradeLetters? });
//   score.reset();
//   score.add(n, meta?);
//   score.addPenalty(n=8, meta?);
//   score.get();                         // -> integer
//   score.getGrade();                    // -> { score, stars, grade }
//
// เพิ่มแบบอัปเกรด (ไม่บังคับใช้):
//   score.addKind('good'|'perfect'|'ok'|'bad', meta?);
//   score.setBoostFn(fnBaseToExtra);     // ใช้ร่วมกับ PowerUpSystem.attachToScore()
//   score.setHandlers({ change:(score,{delta,meta})=>{} });
//   score.setComboGetter(()=> comboInt); // ให้คะแนน scale ตามคอมโบปัจจุบัน (ถ้าต้องการ)
//   score.setFeverGetter(()=> fever01);  // โบนัสเล็กน้อยเมื่ออยู่ FEVER 0..1
//
// หมายเหตุ:
// - รักษาฟิลด์ combo / bestCombo ไว้สำหรับ HUD/Coach/Quests
// - การให้คะแนนแบบ addKind จะคูณคอมโบและบวกโบนัส FEVER ให้ก่อนส่งเข้า add()

export class ScoreSystem {
  constructor(opts = {}) {
    // ค่าคะแนนพื้นฐานต่อเหตุการณ์
    this.base = {
      ok: 4,
      good: 10,
      perfect: 18,
      bad: -6,
      ...(opts.base || {})
    };

    // คะแนนรวม
    this.value = 0;

    // คอมโบ
    this.combo = 0;
    this.bestCombo = 0;

    // การสเกลด้วยคอมโบ (เมื่อมี comboGetter)
    this.comboStep = 0.03;     // +3% ต่อคอมโบถัดไป
    this.comboMulCap = 1.30;   // เพดาน 1.30×

    // โบนัส FEVER (0..1) → +ถึง 10% ของ base ก่อน boost
    this.feverBonusMax = 0.10;

    // เกณฑ์ดาว/เกรด
    this.gradeBreaks  = opts.gradeBreaks  || [120, 240, 360, 480, 600]; // 0..5 ดาว
    this.gradeLetters = opts.gradeLetters || { S: 520, A: 380, B: 260, C: 160 };

    // ความปลอดภัยต่อครั้ง
    this._deltaClamp = { min: -100, max: 200 };

    // hooks
    this._handlers = { change: null };
    this._boostFn = null;
    this._comboGetter = null;  // -> int
    this._feverGetter = null;  // -> 0..1
  }

  /* ================= Back-compat core ================= */
  reset() {
    this.value = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this._emit();
  }

  /** เพิ่มคะแนนดิบ (ใช้โดยระบบเดิม) */
  add(n = 10, meta = {}) {
    let delta = n | 0;

    // boost จาก PowerUpSystem (x2/flat)
    const extra = this._boostFn ? (this._boostFn(n) | 0) : 0;
    delta += extra;

    // clamp ต่อครั้ง
    delta = Math.max(this._deltaClamp.min, Math.min(this._deltaClamp.max, delta));

    // ปรับคอมโบ: เพิ่มเมื่อเป็นบวก, ติดลบจะถือว่าเป็นโทษ (คอมโบรีเซ็ต)
    if (delta > 0) {
      this.combo += 1;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo | 0;
    } else if (delta < 0) {
      this.combo = 0;
    }

    this.value = (this.value | 0) + delta;
    this._emit({ delta, meta });
  }

  /** หักคะแนนพร้อมรีเซ็ตคอมโบ (เดิมใช้กับ “bad”) */
  addPenalty(n = 8, meta = {}) {
    const dec = Math.max(0, n | 0);
    const before = this.value | 0;
    this.value = Math.max(0, before - dec);
    this.combo = 0;
    this._emit({ delta: (this.value - before), meta: { ...meta, penalty: true } });
  }

  get() { return this.value | 0; }

  /* ================= Upgrades (optional) ================= */
  /** ให้คะแนนตามชนิดผลลัพธ์ */
  addKind(kind, meta = {}) {
    const k = String(kind || '').toLowerCase();
    let base = this.base[k];
    if (typeof base !== 'number') base = 0;

    // “bad” → ใช้โทษมาตรฐาน (และรีเซ็ตคอมโบ)
    if (k === 'bad' || base < 0) {
      this.addPenalty(Math.abs(base) || 8, { kind: k, ...meta });
      return;
    }

    // คูณคอมโบ (ถ้าให้ตัวอ่านมา)
    const comboNow = this._comboGetter ? (this._comboGetter() | 0) : this.combo | 0;
    let mul = 1;
    if (comboNow > 1 && base > 0) {
      mul = Math.min(this.comboMulCap, 1 + (Math.max(0, comboNow - 1) * this.comboStep));
    }

    // โบนัส FEVER (ถ้ามี)
    const fever01 = this._feverGetter ? Math.max(0, Math.min(1, +this._feverGetter() || 0)) : 0;
    const feverBonus = base > 0 ? Math.round(base * this.feverBonusMax * fever01) : 0;

    const raw = Math.round(base * mul) + feverBonus;
    this.add(raw, { kind: k, comboNow, mul, fever01, ...meta });
  }

  /** ให้ PowerUpSystem ผูกฟังก์ชันเพิ่มแต้ม (x2/flat) */
  setBoostFn(fn) { this._boostFn = (typeof fn === 'function') ? fn : null; }

  /** เปลี่ยน handler (เช่นอัปเดต HUD ทันที) */
  setHandlers(h = {}) { this._handlers = { ...this._handlers, ...h }; }

  /** ส่งฟังก์ชันอ่านคอมโบจากระบบหลัก (ถ้ามี) */
  setComboGetter(fn) { this._comboGetter = (typeof fn === 'function') ? fn : null; }

  /** ส่งฟังก์ชันอ่านสถานะ FEVER 0..1 (ถ้ามี) */
  setFeverGetter(fn) { this._feverGetter = (typeof fn === 'function') ? fn : null; }

  /** เกรด/ดาว ใช้ตอน result summary */
  getGrade() {
    const s = this.value | 0;
    const br = this.gradeBreaks;
    const stars =
      (s >= br[4]) ? 5 :
      (s >= br[3]) ? 4 :
      (s >= br[2]) ? 3 :
      (s >= br[1]) ? 2 :
      (s >= br[0]) ? 1 : 0;

    const gl = this.gradeLetters;
    const letter =
      (s >= gl.S) ? 'S' :
      (s >= gl.A) ? 'A' :
      (s >= gl.B) ? 'B' :
      (s >= gl.C) ? 'C' : 'D';

    return { score: s, stars, grade: letter };
  }

  /* ================= Internals ================= */
  _emit(payload = {}) {
    try { this._handlers.change?.(this.value | 0, payload); } catch {}
  }
}
