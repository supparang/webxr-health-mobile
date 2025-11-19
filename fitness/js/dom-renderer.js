// === fitness/js/dom-renderer.js (2025-11-19 — hit effect + safe bounds) ===
'use strict';

export class DomRenderer {
  constructor(engine, host, opts = {}) {
    this.engine  = engine || null;
    this.host    = host;
    this.sizePx  = opts.sizePx || 96;
    this.targets = new Map();
    this.bounds  = { w: 0, h: 0, left: 0, top: 0 };

    if (this.host) {
      this.updateBounds();
      window.addEventListener('resize', () => this.updateBounds());
      window.addEventListener('orientationchange', () => {
        setTimeout(() => this.updateBounds(), 300);
      });
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

  /**
   * สร้างเป้าใหม่ในกรอบ #target-layer
   * ใช้ class .target ให้ตรงกับ CSS
   */
  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'target' + (t.decoy ? ' decoy' : '');
    const size = this.sizePx;

    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.textContent  = t.emoji || '⭐';

    // safe area: ให้ "จุดศูนย์กลาง" อยู่ในกรอบทั้งหมด
    const safeW = Math.max(0, this.bounds.w - size);
    const safeH = Math.max(0, this.bounds.h - size);

    const cx = (t.x ?? Math.random()) * safeW + size / 2;
    const cy = (t.y ?? Math.random()) * safeH + size / 2;

    el.style.position = 'absolute';
    el.style.left     = cx + 'px';
    el.style.top      = cy + 'px';
    el.dataset.id     = String(t.id);

    // แตะที่เป้า → ส่งพิกัดจอให้ engine.registerTouch
    el.addEventListener(
      'pointerdown',
      (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (this.engine && typeof this.engine.registerTouch === 'function') {
          this.engine.registerTouch(ev.clientX, ev.clientY);
        }
      },
      { passive: false }
    );

    this.host.appendChild(el);
    this.targets.set(t.id, el);
    t.dom = el;
  }

  /**
   * เอฟเฟกต์คะแนนเด้งจากจุดที่ตี (ใช้ .particle ตาม CSS)
   */
  spawnHitEffect(t, info = {}) {
    if (!this.host || !t || !t.dom) return;

    const rect     = t.dom.getBoundingClientRect();
    const hostRect = this.host.getBoundingClientRect();

    const cx = rect.left + rect.width / 2 - hostRect.left;
    const cy = rect.top  + rect.height / 2 - hostRect.top;

    const el = document.createElement('div');
    el.className = 'particle';

    el.style.position = 'absolute';
    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';

    const gain = info.score ?? 0;
    el.textContent = gain > 0 ? `+${gain}` : '+0';

    this.host.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 450);
  }

  removeTarget(t) {
    const id = t && t.id;
    const el = (t && t.dom) || this.targets.get(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (id != null) this.targets.delete(id);
    if (t) t.dom = null;
  }
}
