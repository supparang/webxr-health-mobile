// === fitness/js/dom-renderer.js (2025-11-19 — match .target CSS + score popup) ===
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

    // ❗ให้ตรงกับ CSS: .target / .target-hit / .target.decoy
    el.className =
      'target' + (t.decoy ? ' target-decoy' : '');

    // ขนาดเป้า (renderer ได้จาก config.sizePx)
    el.style.width  = this.sizePx + 'px';
    el.style.height = this.sizePx + 'px';
    el.textContent  = t.emoji || '⭐';

    // safe area กันหลุดเฟรม
    const safeW = Math.max(0, this.bounds.w - this.sizePx);
    const safeH = Math.max(0, this.bounds.h - this.sizePx);

    const x = (t.x ?? Math.random()) * safeW;
    const y = (t.y ?? Math.random()) * safeH;

    el.style.position  = 'absolute';
    el.style.left      = '0';
    el.style.top       = '0';
    el.style.transform = `translate(${x}px, ${y}px)`;

    el.dataset.id = String(t.id);

    // แตะตรงเป้า → ส่งพิกัดจริงเข้า engine.registerTouch (มือถือ / เมาส์ใช้ได้หมด)
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

  removeTarget(t) {
    const id = t && t.id;
    const el = (t && t.dom) || this.targets.get(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (id != null) this.targets.delete(id);
    if (t) t.dom = null;
  }

  // effect คะแนน / แตกกระจายตรงกลางเป้า
  spawnHitEffect(t, opts = {}) {
    if (!this.host || !t || !t.dom) return;

    const hostRect = this.host.getBoundingClientRect();
    const rect     = t.dom.getBoundingClientRect();

    const cx = rect.left + rect.width  / 2 - hostRect.left;
    const cy = rect.top  + rect.height / 2 - hostRect.top;

    const el = document.createElement('div');
    el.className = 'particle';

    const score = opts.score ?? 0;
    const fever = !!opts.fever;

    if (score > 0) {
      el.textContent = '+' + score + (fever ? '🔥' : '');
    } else if (score < 0) {
      el.textContent = String(score);
    } else {
      el.textContent = '💥';
    }

    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';

    this.host.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 420);
  }
}