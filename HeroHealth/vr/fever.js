// === vr/fever.js (2025-11-06, adaptive + pooled FX) ===
import { SFX } from './sfx.js';

/**
 * Fever System
 * - เติมเกจด้วย add(v) / fill()
 * - decay อัตโนมัติ (ปรับได้) และหยุด decay ชั่วคราวหลังโดน +add (grace)
 * - ครบลูปชีวิต: start() → end() พร้อม SFX และสีฉาก
 * - pause()/resume() ป้องกันวิ่งต่อเวลาแท็บหลุดโฟกัส
 * - UI hook: ส่ง selector ของ progress bar หรือ callback อัปเดตมาใน opts.ui
 * - Aura FX: สร้างครั้งเดียว (pooled) แล้วเปิด/ปิด เพื่อประหยัดแรง
 * - ส่งอีเวนต์: hha:fever ({state:'change'|'start'|'end', level, count})
 */
export class Fever {
  constructor(scene, ui, opts = {}) {
    this.scene = scene;
    this.ui = ui || null;
    this.sfx = new SFX();

    // -------- Config (override ได้ผ่าน opts) --------
    const cfg = this.cfg = {
      max: 100,
      threshold: 100,          // ถึงค่านี้แล้ว start()
      durationMs: 10000,       // ระยะเวลา Fever
      decayIdlePerSec: 4,      // ลดต่อวินาที ตอนไม่ active
      decayActivePerSec: 12,   // ลดต่อวินาที ตอนกำลัง Fever (หลัง start)
      graceAfterAddMs: 800,    // หลัง add จะไม่ decay ชั่วคราว
      skyColorNormal: '#0b1324',
      skyColorFever:  '#3b0f0f',
      auraCount: 18,           // จำนวนชิ้นออร่า
      auraRadius: 0.7,         // รัศมีวงออร่า
      auraW: 0.12,             // ขนาดแผ่นออร่า
      auraH: 0.28,
      ui: {
        // เลือกอย่างใดอย่างหนึ่ง:
        // 1) selectors: { bar:'#feverBar', wrap:'#feverBarWrap', label:'#feverLabel' }
        // 2) callback:  (state)=>{}  // {level, active, count}
        selectors: null,
        callback: null
      },
      ...opts
    };

    // -------- State --------
    this.level = 0;          // 0..max
    this.active = false;
    this.count = 0;          // จำนวนครั้งที่เข้า Fever
    this._paused = false;
    this._graceUntil = 0;
    this._endTimer = null;
    this._raf = 0;
    this._lastTick = performance.now();

    // FX pooled
    this._auraRoot = null;
    this._skyAnimating = false;

    // UI refs
    this._ui = { bar: null, wrap: null, label: null };
    this._resolveUI();

    // Boot status
    this._ensureAura(); // เตรียม FX ไว้เลย (ซ่อน)
    this._applySky(this.cfg.skyColorNormal, false);
    this._updateUI();

    // เริ่มวงจร tick
    this._loop();
  }

  // ---------- Public API ----------
  add(v) {
    const prev = this.level;
    this.level = clamp(prev + Number(v || 0), 0, this.cfg.max);

    // ให้เวลาผู้เล่น: หลัง add จะไม่ decay ชั่วคราว
    this._graceUntil = performance.now() + this.cfg.graceAfterAddMs;

    if (!this.active && this.level >= this.cfg.threshold) this.start();
    else this._emitChange();

    this._updateUI();
  }

  fill() {
    this.level = this.cfg.max;
    if (!this.active) this.start();
    this._updateUI();
  }

  reset() {
    this._clearTimers();
    this.active = false;
    this.level = 0;
    this.count = 0;
    this._hideAura();
    this._applySky(this.cfg.skyColorNormal, true);
    this._emitChange();
    this._updateUI();
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.count++;
    this.level = this.cfg.max; // เข้าช่วง Fever เติมเต็มเลย

    this._applySky(this.cfg.skyColorFever, true);
    this._showAura();

    try { this.sfx.feverStart(); } catch {}

    this._clearTimers();
    this._endTimer = setTimeout(() => this.end(), this.cfg.durationMs);

    this._emit('start');
    this._updateUI();
  }

  end() {
    if (!this.active) return;
    this.active = false;
    this.level = 0;

    this._hideAura();
    this._applySky(this.cfg.skyColorNormal, true);

    try { this.sfx.feverEnd(); } catch {}

    this._emit('end');
    this._updateUI();
  }

  pause() {
    if (this._paused) return;
    this._paused = true;
    this._clearTimers(false); // เก็บ endTimer ไว้แต่หยุด tick
    this._stopLoop();
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    // ไม่ยุ่ง endTimer เพื่อให้เวลายังเดินต่อ
    this._lastTick = performance.now();
    this._loop();
  }

  // ---------- Internals ----------
  _loop() {
    this._raf = requestAnimationFrame((t) => {
      const dt = Math.max(0, t - this._lastTick);
      this._lastTick = t;

      if (!this._paused) this._tick(dt);
      this._loop();
    });
  }
  _stopLoop() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _tick(dtMs) {
    const now = performance.now();
    // ยังอยู่ในช่วง grace? → ไม่ decay
    if (now < this._graceUntil) return;

    const decPerSec = this.active ? this.cfg.decayActivePerSec : this.cfg.decayIdlePerSec;
    if (decPerSec > 0 && this.level > 0) {
      const dec = (decPerSec * dtMs) / 1000;
      const prev = this.level;
      this.level = clamp(prev - dec, 0, this.cfg.max);
      if (!this.active && prev !== this.level) this._emitChange();
      this._updateUI();
    }
  }

  _clearTimers(clearEnd = true) {
    if (clearEnd && this._endTimer) { clearTimeout(this._endTimer); this._endTimer = null; }
  }

  // ----- UI -----
  _resolveUI() {
    const u = this.cfg.ui || {};
    if (u.selectors) {
      const { bar, wrap, label } = u.selectors;
      this._ui.bar   = bar   ? document.querySelector(bar)   : null;
      this._ui.wrap  = wrap  ? document.querySelector(wrap)  : null;
      this._ui.label = label ? document.querySelector(label) : null;
    }
    this._cb = (typeof u.callback === 'function') ? u.callback : null;
  }

  _updateUI() {
    const p = this.level / this.cfg.max;
    // Progress bar (ถ้ามี)
    if (this._ui.bar) {
      // สมมติใช้ style width (%) สำหรับ bar ภายใน wrap
      this._ui.bar.style.width = `${Math.round(p * 100)}%`;
      // เปลี่ยนสีเบา ๆ ตามสถานะ
      if (this.active) this._ui.bar.style.background = 'linear-gradient(90deg,#ffb703,#fb5607)';
      else this._ui.bar.style.background = 'linear-gradient(90deg,#37d67a,#06d6a0)';
    }
    if (this._ui.label) {
      this._ui.label.textContent = this.active ? `FEVER! (${Math.round(p*100)}%)` : `Fever ${Math.round(p*100)}%`;
    }
    if (this._cb) {
      this._cb({ level: this.level, active: this.active, count: this.count });
    }
  }

  // ----- Scene color tween -----
  _applySky(hex, tween = true) {
    const sky = this.scene?.querySelector?.('a-sky');
    if (!sky) return;
    if (!tween) { sky.setAttribute('color', hex); return; }

    // ป้องกันสแปม tween
    if (this._skyAnimating) { sky.setAttribute('color', hex); return; }
    this._skyAnimating = true;

    // ใช้ animation component ของ A-Frame (ไม่ต้องพึ่งไลบรารี)
    sky.removeAttribute('animation__color'); // reset เดิม
    sky.setAttribute('animation__color', {
      property: 'color',
      to: hex,
      dur: 250,
      easing: 'easeOutQuad'
    });
    // ปลดธงหลังจบ
    setTimeout(() => (this._skyAnimating = false), 260);
  }

  // ----- Aura FX (pooled) -----
  _ensureAura() {
    if (this._auraRoot) return;
    const fx = document.createElement('a-entity');
    fx.id = 'feverAura';
    fx.setAttribute('visible', false);

    const { auraCount:c, auraRadius:r, auraW:w, auraH:h } = this.cfg;
    for (let i = 0; i < c; i++) {
      const p = document.createElement('a-plane');
      p.setAttribute('width', w);
      p.setAttribute('height', h);
      p.setAttribute('material', 'color:#ff6600; opacity:0.9; side:double');

      const angle = (i / c) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = 0.1 + Math.random() * 0.2;

      p.setAttribute('position', `${x} ${y} ${z}`);
      p.setAttribute('rotation', `0 ${-(angle*180/Math.PI)} 0`);
      // ตั้ง animation ไว้ (แต่จะเล่นเมื่อ visible เท่านั้น)
      p.setAttribute('animation__rise', `property: position; to: ${x} ${y + 1.4} ${z}; dur: 900; dir: alternate; loop: true; easing: easeInOutSine`);
      p.setAttribute('animation__fade', `property: material.opacity; to: 0.5; dur: 900; dir: alternate; loop: true; easing: easeInOutSine`);

      fx.appendChild(p);
    }

    this.scene.appendChild(fx);
    this._auraRoot = fx;
  }

  _showAura() {
    this._ensureAura();
    this._auraRoot.setAttribute('visible', true);
  }

  _hideAura() {
    if (!this._auraRoot) return;
    this._auraRoot.setAttribute('visible', false);
  }

  // ----- Events -----
  _emitChange() { this._emit('change'); }
  _emit(state) {
    try {
      window.dispatchEvent(new CustomEvent('hha:fever', {
        detail: { state, level: this.level, count: this.count }
      }));
    } catch {}
  }
}

// ---------- helpers ----------
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
