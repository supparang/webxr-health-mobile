// === /HeroHealth/vr/difficulty.js (Good vs Junk VR — Production Ready) ===

/**
 * Difficulty
 * - ปรับขนาด, ความถี่การเกิด และอายุของเป้าตามระดับความยาก
 * - ค่าพื้นฐานนี้จูนสำหรับ VR + เด็ก ป.5 (เล็งด้วยหัว / gaze ได้ทัน)
 *
 * base:
 *   easy   → เป้าใหญ่สุด / ลอยนาน / spawn ช้า
 *   normal → ค่ากลาง ๆ
 *   hard   → เป้าเล็ก / ลอยสั้น / spawn เร็ว
 */

export class Difficulty {
  constructor(custom = {}) {
    const base = {
      easy:   { size: 0.95, rate: 950, life: 2600 },
      normal: { size: 0.75, rate: 780, life: 2200 },
      hard:   { size: 0.55, rate: 620, life: 1800 }
    };
    this.config = mergeConfig(base, custom);
    this.levels = ['easy', 'normal', 'hard'];
    this._current = 'normal';
  }

  get(level = this._current) {
    const lv = this._sanitize(level);
    return clone(this.config[lv]);
  }

  set(level) {
    this._current = this._sanitize(level);
    return this._current;
  }

  _sanitize(level) {
    const lv = String(level || '').toLowerCase();
    return this.levels.includes(lv) ? lv : 'normal';
  }
}

// ---- helpers ----
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
        out[lv].size = clamp(+c.size, 0.25, 1.5);
      }
      if (Number.isFinite(c.rate)) {
        out[lv].rate = Math.max(200, Math.round(+c.rate));
      }
      if (Number.isFinite(c.life)) {
        out[lv].life = Math.max(500, Math.round(+c.life));
      }
    }
  }
  return out;
}

export default Difficulty;
