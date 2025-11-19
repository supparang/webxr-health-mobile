// === fitness/js/dom-renderer.js (2025-11-19 big target + center) ===
'use strict';

export class DomRenderer {
  constructor(engine, host, opts = {}) {
    this.engine  = engine;
    this.host    = host;
    this.sizePx  = opts.sizePx || 96;
    this.targets = new Map();
    this.bounds  = { w: 0, h: 0, left: 0, top: 0 };

    if (this.host) {
      this.updateBounds();
      window.addEventListener('resize', () => this.updateBounds());
    }
  }

  setEngine(engine) {
    this.engine = engine;
  }

  updateBounds() {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.bounds.w    = rect.width;
    this.bounds.h    = rect.height;
    this.bounds.left = rect.left;
    this.bounds.top  = rect.top;
  }

  clear() {
    this.targets.forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    this.targets.clear();
  }

  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target' + (t.decoy ? ' sb-target-decoy' : '');
    el.style.width  = this.sizePx + 'px';
    el.style.height = this.sizePx + 'px';
    // ส่งค่าขนาดเข้า CSS
    el.style.setProperty('--sb-target-size', this.sizePx + 'px');
    el.textContent  = t.emoji || '⭐';

    // safe area สำหรับ "จุดกึ่งกลาง" ของเป้า
    const margin   = 6;
    const safeW    = Math.max(0, this.bounds.w - this.sizePx - margin * 2);
    const safeH    = Math.max(0, this.bounds.h - this.sizePx - margin * 2);
    const centerX  = (t.x || Math.random()) * safeW + this.sizePx / 2 + margin;
    const centerY  = (t.y || Math.random()) * safeH + this.sizePx / 2 + margin;

    el.style.position = 'absolute';
    el.style.left  = centerX + 'px';
    el.style.top   = centerY + 'px';
    // ให้ CSS ใช้ translate(-50%, -50%) เพื่อให้จุดที่เราคำนวณเป็น "กลางดวง"
    el.style.transform = 'translate(-50%, -50%)';

    el.dataset.id = String(t.id);

    // แตะเป้า → ส่งตำแหน่งให้ engine
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.engine && typeof this.engine.registerTouch === 'function') {
        this.engine.registerTouch(ev.clientX, ev.clientY);
      }
    }, { passive: false });

    this.host.appendChild(el);
    this.targets.set(t.id, el);
    t.dom = el;
  }

  removeTarget(t) {
    const id = t && t.id;
    const el = (t && t.dom) || this.targets.get(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (id != null) this.targets.delete(id);
    if (t) t.dom = null;
  }

  // optional hook สำหรับเอฟเฟกต์แตกกระจาย
  spawnHitEffect(t, info) {
    const el = (t && t.dom) || this.targets.get(t.id);
    if (!el || !this.host) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;

    const hostRect = this.host.getBoundingClientRect();
    const localX = cx - hostRect.left;
    const localY = cy - hostRect.top;

    const particle = document.createElement('div');
    particle.className = 'sb-particle';
    particle.textContent = info && info.fever ? '+FEVER' : '+' + (info?.score ?? '');
    particle.style.left = localX + 'px';
    particle.style.top  = localY + 'px';

    this.host.appendChild(particle);
    setTimeout(() => {
      if (particle.parentNode) particle.parentNode.removeChild(particle);
    }, 420);
  }
}
