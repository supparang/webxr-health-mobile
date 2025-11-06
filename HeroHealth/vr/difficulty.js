// === vr/difficulty.js (2025-11-06) ===
// - Backward compatible: easy/normal/hard → {size, rate, life}
// - เพิ่ม get(level), pick(levels), clamp, next/prev
// - เพิ่ม adaptive(): ปรับระดับตาม performance (acc/fps/streak)
// - เพิ่ม scaleForFPS(): ชดเชยเรต spawn เมื่อ fps ตก
// - ปลอดภัย: กัน input เพี้ยน, มีค่า default เสมอ

export class Difficulty {
  constructor(custom = {}) {
    // ค่าเริ่มต้น: size (อัตราส่วน hitbox/เป้า), rate (ms ต่อ 1 spawn), life (ms อายุเป้า)
    const base = {
      easy:   { size: 0.80, rate: 700, life: 2500 },
      normal: { size: 0.60, rate: 520, life: 2000 },
      hard:   { size: 0.40, rate: 380, life: 1400 }
    };
    // อนุญาต override เฉพาะฟิลด์ที่ถูกต้อง
    this.config = mergeConfig(base, custom);
    this.levels = ['easy', 'normal', 'hard'];
    this._current = 'normal';
  }

  // คืนคอนฟิกของระดับ (กันชื่อเพี้ยน)
  get(level = this._current) {
    const lv = this._sanitize(level);
    return clone(this.config[lv]);
  }

  // ตั้งค่าระดับปัจจุบัน (คืนระดับที่ถูกตั้งจริง)
  set(level) {
    this._current = this._sanitize(level);
    return this._current;
  }

  // เลือกจากรายการหลายระดับ (เหมาะกับโหมดส่งมาหลายแหล่ง)
  // e.g. ['easy','hard',null] → median → 'normal'
  pick(levels = []) {
    if (!Array.isArray(levels) || levels.length === 0) return this._current;
    const idx = this._medianIndex(levels.map(lv => this._toIndex(lv)));
    return this.levels[idx];
  }

  // เสนอระดับถัดไป/ก่อนหน้า (ใช้กับปุ่มปรับความยาก)
  next(level = this._current) {
    const i = this._toIndex(level);
    return this.levels[Math.min(this.levels.length - 1, i + 1)];
  }
  prev(level = this._current) {
    const i = this._toIndex(level);
    return this.levels[Math.max(0, i - 1)];
  }

  // สรุปค่าระดับจาก levels[] (ชื่อเดิมของคุณ: resolve)
  resolve(levels = []) {
    const chosen = this.pick(levels);
    this._current = chosen;
    return chosen;
  }

  // ปรับคอนฟิกสำหรับเฟรมเรตจริง (เช่น fps ตก → เพิ่ม rate เพื่อลดความถี่ spawn)
  // usage: const cfg = diff.scaleForFPS(diff.get(), measuredFPS, 60);
  scaleForFPS(cfg, measuredFPS, targetFPS = 60) {
    const c = clone(cfg);
    const fps = Math.max(10, Number(measuredFPS) || targetFPS);
    const tfps = Math.max(10, Number(targetFPS) || 60);

    // ตัวคูณอย่างนุ่มนวล: ถ้า fps < target → เพิ่ม rate/life ตามสัดส่วน 0.7–1.4 เท่า
    const ratio = clamp(tfps / fps, 0.7, 1.4);
    c.rate = Math.round(c.rate * ratio);
    c.life = Math.round(c.life * ratio);
    return c;
  }

  // ปรับระดับอัตโนมัติจากผลการเล่นช่วงสั้น ๆ
  // metrics: { accuracy:0..1, streakMax:int, avgReactionMs:int, fps:float }
  // options: { upAtAcc=0.9, downAtAcc=0.55, coolDown=3000 }
  // คืน { level, changed:boolean, reason:string }
  adaptive(metrics = {}, options = {}) {
    const {
      accuracy = 0.0,         // สัดส่วนคลิก/ตีโดน
      streakMax = 0,          // คอมโบสูงสุดช่วงหลัง
      avgReactionMs = 500,    // ปฏิกิริยาเฉลี่ย
      fps = 60
    } = metrics;

    const {
      upAtAcc = 0.90,
      downAtAcc = 0.55,
      streakForUp = 12,
      reactForDownMs = 900,
      coolDown = 3000
    } = options;

    const now = Date.now();
    this._lastTune = this._lastTune || 0;
    if (now - this._lastTune < coolDown) {
      return { level: this._current, changed: false, reason: 'cooldown' };
    }

    const i = this._toIndex(this._current);
    let next = i;
    let reason = 'steady';

    // เงื่อนไข “ยากขึ้น”
    if (accuracy >= upAtAcc || streakMax >= streakForUp) {
      next = Math.min(this.levels.length - 1, i + 1);
      if (next !== i) reason = 'skill_up';
    }
    // เงื่อนไข “ง่ายลง”
    if (accuracy <= downAtAcc || avgReactionMs >= reactForDownMs || fps < 35) {
      next = Math.max(0, Math.min(next, i - 1)); // ถ้าเงื่อนไขขัดแย้ง ให้คงเดิม/ผ่อนลง
      if (next !== i) reason = (fps < 35 ? 'low_fps' : 'assist');
    }

    const newLevel = this.levels[next];
    const changed = newLevel !== this._current;
    if (changed) {
      this._current = newLevel;
      this._lastTune = now;
    }
    return { level: this._current, changed, reason };
  }

  // แอพพลายค่าความยากเข้ากับออปชัน spawn (ไม่แก้ของเดิม)
  // usage: const spawn = diff.applyToSpawn({radiusPx:50, lifetimeMs:1200});
  applyToSpawn(spawn = {}) {
    const cfg = this.get();
    const out = { ...spawn };
    // ขยาย/หดขนาดเป้า (รองรับทั้ง radiusPx และ scale3D)
    if (Number.isFinite(out.radiusPx)) out.radiusPx = Math.round(out.radiusPx * (cfg.size / 0.6));
    if (Number.isFinite(out.scale3D)) out.scale3D = +(out.scale3D * (cfg.size / 0.6)).toFixed(3);
    // อายุเป้า (override ถ้าไม่ได้กำหนดเฉพาะเจาะจง)
    if (!Number.isFinite(out.lifetimeMs)) out.lifetimeMs = cfg.life;
    // ความถี่สปอน ผูกไว้ให้ผู้เรียกใช้เองข้างนอก (ใช้ cfg.rate)
    out._difficulty = this._current;
    out._rateMs = cfg.rate;
    return out;
  }

  // ---------- ภายใน ----------
  _sanitize(level) {
    const lv = String(level || '').toLowerCase();
    return this.levels.includes(lv) ? lv : 'normal';
    }

  _toIndex(level) {
    const lv = this._sanitize(level);
    return this.levels.indexOf(lv); // 0..2
  }

  _medianIndex(list) {
    const a = list
      .map(n => Number.isFinite(n) ? n : 1) // ปกติ=1
      .sort((x, y) => x - y);
    if (a.length === 0) return this._toIndex('normal');
    const mid = Math.floor(a.length / 2);
    return clamp(a[mid], 0, this.levels.length - 1);
  }
}

// ---------- utilities ----------
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function mergeConfig(base, custom) {
  const out = clone(base);
  const lvls = Object.keys(base);
  for (const lv of lvls) {
    if (custom && typeof custom[lv] === 'object') {
      const c = custom[lv];
      if (Number.isFinite(c.size)) out[lv].size = clamp(+c.size, 0.2, 1.5);
      if (Number.isFinite(c.rate)) out[lv].rate = Math.max(120, Math.round(+c.rate));
      if (Number.isFinite(c.life)) out[lv].life = Math.max(300, Math.round(+c.life));
    }
  }
  return out;
}

export default Difficulty;
