// === /HeroHealth/vr/difficulty.js ===
// ระบบปรับความยากสำหรับ Good vs Junk VR (PC/Mobile/VR)

'use strict';

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function mergeConfig(base, custom) {
  const out = clone(base);
  const lvls = Object.keys(base);

  for (const lv of lvls) {
    if (custom && typeof custom[lv] === 'object') {
      const c = custom[lv];

      if (Number.isFinite(c.size)) {
        out[lv].size = clamp(+c.size, 0.2, 1.5);
      }
      if (Number.isFinite(c.rate)) {
        out[lv].rate = Math.max(120, Math.round(+c.rate));
      }
      if (Number.isFinite(c.life)) {
        out[lv].life = Math.max(300, Math.round(+c.life));
      }
    }
  }
  return out;
}

// ค่าพื้นฐาน:
// - size  = ขนาด emoji (ยิ่งเล็กยิ่งยาก)
// - rate  = ระยะห่างเวลาการ spawn เป้า (ms) ยิ่งน้อยยิ่งถี่/ยาก
// - life  = อายุของเป้าก่อนหาย (ms) ยิ่งน้อยยิ่งยาก
export class Difficulty {
  constructor(custom = {}) {
    const base = {
      easy: {
        size: 0.80,
        rate: 700,
        life: 2500
      },
      normal: {
        size: 0.60,
        rate: 520,
        life: 2000
      },
      hard: {
        size: 0.40,
        rate: 380,
        life: 1400
      }
    };

    this.config  = mergeConfig(base, custom);
    this.levels  = ['easy', 'normal', 'hard'];
    this._current = 'normal';
  }

  _sanitize(level) {
    const lv = String(level || '').toLowerCase();
    return this.levels.includes(lv) ? lv : 'normal';
  }

  set(level) {
    this._current = this._sanitize(level);
    return this._current;
  }

  get(level = this._current) {
    const lv = this._sanitize(level);
    // คืนเป็น clone เพื่อกันการแก้ค่าโดยตรง
    return clone(this.config[lv]);
  }
}

// เผื่ออยาก import แบบ default
export default Difficulty;
