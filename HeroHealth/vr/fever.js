// === vr/fever.js (2025-11-06, production: no optional chaining, pooled FX, safe scene) ===
import { SFX } from './sfx.js';

/**
 * Fever System
 * - เติมเกจด้วย add(v) / fill()
 * - decay อัตโนมัติ (ปรับได้) และหยุด decay ชั่วคราวหลัง add (grace)
 * - start()/end() พร้อม SFX + เปลี่ยนสีฉาก
 * - pause()/resume()
 * - UI: ส่ง selector ของ progress bar หรือ callback ใน opts.ui
 * - Aura FX: pooled (สร้างครั้งเดียว เปิด/ปิด)
 * - อีเวนต์: hha:fever ({state:'change'|'start'|'end', level, count})
 */
export class Fever {
  constructor(scene, ui, opts = {}) {
    // scene ที่ปลอดภัย
    this.scene = scene || document.querySelector('a-scene') || document.body;
    this.ui = ui || null;
    this.sfx = new SFX();

    // -------- Config --------
    const cfg = this.cfg = {
      max: 100,
      threshold: 100,
      durationMs: 10000,
      decayIdlePerSec: 4,
      decayActivePerSec: 12,
      graceAfterAddMs: 800,
      skyColorNormal: '#0b1324',
      skyColorFever:  '#3b0f0f',
      auraCount: 18,
      auraRadius: 0.7,
      auraW: 0.12,
      auraH: 0.28,
      ui: {
        // 1) selectors: { bar:'#feverBar', wrap:'#feverBarWrap', label:'#feverLabel' }
        // 2) callback: (state)=>{}  // {level, active, count}
        selectors: null,
        callback: null
      },
      ...opts
    };

    // -------- State --------
    this.level = 0;          // 0..max
    this.active = false;
    this.count = 0;
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

    // Boot
    this._ensureAura(); // เตรียม FX (ซ่อน)
    this._applySky(this.cfg.skyColorNormal, false);
    this._updateUI();

    // loop
    this._loop();
  }

  // ---------- Public API ----------
  add(v) {
    const prev = this.level;
    const addv = Number(v || 0);
    const maxv = this.cfg.max;
    this.level = clamp(prev + addv, 0, maxv);

    // grace
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
    this.level = this.cfg.max;

    this._applySky(this.cfg.skyColorFever, true);
    this._showAura();

    try { this.sfx.feverStart(); } catch (e) {}

    this._clearTimers();
    const self = this;
    this._endTimer = setTimeout(function(){ self.end(); }, this.cfg.durationMs);

    this._emit('start');
    this._updateUI();
  }

  end() {
    if (!this.active) return;
    this.active = false;
    this.level = 0;

    this._hideAura();
    this._applySky(this.cfg.skyColorNormal, true);

    try { this.sfx.feverEnd(); } catch (e) {}

    this._emit('end');
    this._updateUI();
  }

  pause() {
    if (this._paused) return;
    this._paused = true;
    this._clearTimers(false); // คง endTimer
    this._stopLoop();
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._lastTick = performance.now();
    this._loop();
  }

  // ---------- Internals ----------
  _loop() {
    const self = this;
    this._raf = requestAnimationFrame(function(t){
      const dt = Math.max(0, t - self._lastTick);
      self._lastTick = t;

      if (!self._paused) self._tick(dt);
      self._loop();
    });
  }
  _stopLoop() {
    try { cancelAnimationFrame(this._raf); } catch(e) {}
    this._raf = 0;
  }

  _tick(dtMs) {
    const now = performance.now();
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
      const barSel   = u.selectors.bar;
      const wrapSel  = u.selectors.wrap;
      const labelSel = u.selectors.label;
      this._ui.bar   = barSel   ? document.querySelector(barSel)   : null;
      this._ui.wrap  = wrapSel  ? document.querySelector(wrapSel)  : null;
      this._ui.label = labelSel ? document.querySelector(labelSel) : null;
    }
    this._cb = (typeof u.callback === 'function') ? u.callback : null;
  }

  _updateUI() {
    const p = this.cfg.max > 0 ? (this.level / this.cfg.max) : 0;
    if (this._ui.bar) {
      this._ui.bar.style.width = String(Math.round(p * 100)) + '%';
      if (this.active) this._ui.bar.style.background = 'linear-gradient(90deg,#ffb703,#fb5607)';
      else this._ui.bar.style.background = 'linear-gradient(90deg,#37d67a,#06d6a0)';
    }
    if (this._ui.label) {
      this._ui.label.textContent = this.active ? ('FEVER! (' + Math.round(p*100) + '%)') : ('Fever ' + Math.round(p*100) + '%');
    }
    if (this._cb) {
      try { this._cb({ level: this.level, active: this.active, count: this.count }); } catch(e) {}
    }
  }

  // ----- Scene color tween -----
  _applySky(hex, tween) {
    const sky = (this.scene && this.scene.querySelector) ? this.scene.querySelector('a-sky') : null;
    if (!sky) return;
    if (!tween) { sky.setAttribute('color', hex); return; }

    if (this._skyAnimating) { sky.setAttribute('color', hex); return; }
    this._skyAnimating = true;

    try { sky.removeAttribute('animation__color'); } catch(e) {}
    sky.setAttribute('animation__color',
      'property: color; to: ' + hex + '; dur: 250; easing: easeOutQuad');
    const self = this;
    setTimeout(function(){ self._skyAnimating = false; }, 260);
  }

  // ----- Aura FX (pooled) -----
  _ensureAura() {
    if (this._auraRoot) return;
    const fx = document.createElement('a-entity');
    fx.id = 'feverAura';
    fx.setAttribute('visible', false);

    const c = this.cfg.auraCount;
    const r = this.cfg.auraRadius;
    const w = this.cfg.auraW;
    const h = this.cfg.auraH;

    for (let i = 0; i < c; i++) {
      const p = document.createElement('a-plane');
      p.setAttribute('width', w);
      p.setAttribute('height', h);
      p.setAttribute('material', 'color:#ff6600; opacity:0.9; side:double');
      const angle = (i / c) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = 0.1 + Math.random() * 0.2;

      p.setAttribute('position', x + ' ' + y + ' ' + z);
      p.setAttribute('rotation', '0 ' + (-(angle*180/Math.PI)) + ' 0');
      p.setAttribute('animation__rise',
        'property: position; to: ' + x + ' ' + (y + 1.4) + ' ' + z + '; dur: 900; dir: alternate; loop: true; easing: easeInOutSine');
      p.setAttribute('animation__fade',
        'property: material.opacity; to: 0.5; dur: 900; dir: alternate; loop: true; easing: easeInOutSine');

      fx.appendChild(p);
    }

    try { this.scene.appendChild(fx); } catch(e) {}
    this._auraRoot = fx;
  }

  _showAura() {
    this._ensureAura();
    if (this._auraRoot) this._auraRoot.setAttribute('visible', true);
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
        detail: { state: state, level: this.level, count: this.count }
      }));
    } catch (e) {}
  }
}

// ---------- helpers ----------
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export default Fever;
