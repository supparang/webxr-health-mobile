// === dom-renderer.js (2025-11-19 fix: correct spawn bounds + center snap) ===
'use strict';

export class DomRenderer {
  constructor(engine, host, opts = {}) {
    this.engine = engine;
    this.host = host;
    this.sizePx = opts.sizePx || 96;

    // bounding box จริงที่ใช้ spawn
    const rect = host.getBoundingClientRect();
    this.bounds = {
      w: rect.width,
      h: rect.height,
      left: rect.left,
      top: rect.top
    };
  }

  updateBounds() {
    const rect = this.host.getBoundingClientRect();
    this.bounds.w = rect.width;
    this.bounds.h = rect.height;
    this.bounds.left = rect.left;
    this.bounds.top = rect.top;
  }

  spawnTarget(t) {
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.style.width = this.sizePx + 'px';
    el.style.height = this.sizePx + 'px';
    el.textContent = t.emoji || '⭐';

    // ป้องกัน spawn หลุดกรอบ
    const safeW = this.bounds.w - this.sizePx;
    const safeH = this.bounds.h - this.sizePx;

    const x = t.x * safeW;
    const y = t.y * safeH;

    el.style.transform = `translate(${x}px, ${y}px)`;

    el.dataset.id = t.id;
    this.host.appendChild(el);
    t.dom = el;
  }

  removeTarget(t) {
    if (t.dom && t.dom.parentNode) t.dom.parentNode.removeChild(t.dom);
  }
}