// === Hero Health Academy — core/score.js (drop-in upgrade; back-compat) ===
// คุณยังใช้ API เดิมได้เหมือนเดิม:
//   new ScoreSystem().reset(); .add(n); .setBoostFn(fn); .setHandlers({change})
// เพิ่มเติม: .addKind('good'|'perfect'|'ok'|'bad', meta)
//          .setComboGetter(fnComboInt)  // ให้คะแนน scale ตามคอมโบ
//          .setFeverGetter(fnFever01)   // เสริมแต้มเล็กน้อยเมื่อเข้าช่วง FEVER
//          .getGrade() -> {grade:'S/A/B/C', stars:0..5, score}

export class ScoreSystem {
  constructor(opts = {}) {
    this.score = 0;

    // ค่าเริ่มต้นต่อเหตุการณ์ (ปรับได้ผ่าน opts.base)
    this.base = {
      ok: 4,
      good: 10,
      perfect: 18,
      bad: -6,
      ...(opts.base || {})
    };

    // ตัวคูณตามคอมโบ (คอมโบ 1..N) — ใช้ได้ทันทีถ้ามีตัวอ่านคอมโบ
    // 1.00, 1.03, 1.06, 1.09, … capped ~1.30
    this.comboMulCap = 1.30;
    this.comboStep = 0.03;

    // เสริมเล็กน้อยเมื่ออยู่ FEVER (0..1 จาก getter) → + up to 10% ของ base
    this.feverBonusMax = 0.10;

    // เกณฑ์ดาว/เกรด
    this.gradeBreaks = opts.gradeBreaks || [120, 240, 360, 480, 600]; // 0–5 ดาว
    this.gradeLetters = opts.gradeLetters || { S: 520, A: 380, B: 260, C: 160 };

    // hooks
    this._handlers = { change: null };
    this._boostFn = null;       // จาก PowerUpSystem.attachToScore()
    this._comboGetter = null;   // -> integer (เช่น comboNow)
    this._feverGetter = null;   // -> 0..1 (เช่น feverProgress หรือ 1 เมื่อ FEVER on)

    // ป้องกันบั๊ก: จำกัดค่าเพิ่ม/ลดต่อครั้ง (กันค่าหลุด)
    this._deltaClamp = { min: -100, max: 200 };
  }

  // ===== Back-compat API =====
  reset() {
    this.score = 0;
    this._emit();
  }

  add(n, meta = {}) {
    // base delta
    let delta = (n | 0);

    // boost จากระบบพลัง (x2/flat bonus) — ควรส่ง base n ให้ boostFn คำนวณเพิ่ม
    const extra = this._boostFn ? (this._boostFn(n) | 0) : 0;
    delta += extra;

    // ปักหมุดความปลอดภัย
    delta = Math.max(this._deltaClamp.min, Math.min(this._deltaClamp.max, delta));

    this.score = (this.score | 0) + delta;
    this._emit({ delta, meta });
  }

  setBoostFn(fn) { this._boostFn = (typeof fn === 'function') ? fn : null; }

  setHandlers(h = {}) { this._handlers = { ...this._handlers, ...h }; }

  // ===== ใหม่แบบไม่บังคับใช้ =====
  // ใช้คะแนนตามชนิดผลลัพธ์ที่ main/โหมดส่งมา (ลดโค้ดซ้ำ)
  addKind(kind, meta = {}) {
    // 1) เลือก base ตามชนิด
    let base = this.base[kind];
    if (typeof base !== 'number') base = 0;

    // 2) คูณตามคอมโบ (ถ้ามีตัวอ่านคอมโบ)
    const combo = this._comboGetter ? (this._comboGetter() | 0) : 0;
    let mul = 1;
    if (combo > 1 && base > 0) {
      mul = Math.min(this.comboMulCap, 1 + (Math.max(0, combo - 1) * this.comboStep));
    }

    // 3) โบนัสช่วง FEVER (0..1) → +0..10% ของ base (ก่อน boost x2)
    const fever01 = this._feverGetter ? Math.max(0, Math.min(1, +this._feverGetter() || 0)) : 0;
    const feverBonus = base > 0 ? Math.round(base * this.feverBonusMax * fever01) : 0;

    const raw = Math.round(base * mul) + feverBonus;

    // ไปต่อขั้น boost/x2 ผ่าน add()
    this.add(raw, { kind, combo, mul, fever01 });
  }

  // ให้ main บอกว่าอ่านคอมโบ/FEVER จากไหน (ไม่บังคับใช้)
  setComboGetter(fn) { this._comboGetter = (typeof fn === 'function') ? fn : null; }
  setFeverGetter(fn) { this._feverGetter = (typeof fn === 'function') ? fn : null; }

  // เกรด/ดาว (ใช้ตอนสรุปผล)
  getGrade() {
    const s = this.score | 0;
    const stars =
      (s >= this.gradeBreaks[4]) ? 5 :
      (s >= this.gradeBreaks[3]) ? 4 :
      (s >= this.gradeBreaks[2]) ? 3 :
      (s >= this.gradeBreaks[1]) ? 2 :
      (s >= this.gradeBreaks[0]) ? 1 : 0;

    const letter =
      (s >= this.gradeLetters.S) ? 'S' :
      (s >= this.gradeLetters.A) ? 'A' :
      (s >= this.gradeLetters.B) ? 'B' :
      (s >= this.gradeLetters.C) ? 'C' : 'D';

    return { score: s, stars, grade: letter };
  }

  get() { return this.score | 0; }

  // ===== Internals =====
  _emit(payload = {}) {
    try { this._handlers.change?.(this.score, payload); } catch {}
  }
}
