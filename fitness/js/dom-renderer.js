// === dom-renderer.js (2025-11-19 tap wiring + safe bounds) ===
'use strict';

export class DomRenderer {
  constructor(engine, host, opts = {}) {
    this.engine = engine;
    this.host   = host;
    this.sizePx = opts.sizePx || 96;
    this.targets = new Map();

    this.updateBounds();
    window.addEventListener('resize', () => this.updateBounds());
  }

  setEngine(engine){
    this.engine = engine;
  }

  updateBounds() {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.bounds = {
      w: rect.width,
      h: rect.height,
      left: rect.left,
      top: rect.top
    };
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
    el.textContent  = t.emoji || '⭐';

    // คำนวณ safe area กันหลุดกรอบ (ทั้งดวงอยู่ในเฟรม)
    const safeW = Math.max(0, this.bounds.w - this.sizePx);
    const safeH = Math.max(0, this.bounds.h - this.sizePx);

    const x = (t.x || 0) * safeW;
    const y = (t.y || 0) * safeH;

    // วางโดยใช้ translate จากมุมซ้ายบนของ host
    el.style.transform = `translate(${x}px, ${y}px)`;

    el.dataset.id = String(t.id);

    // === สำคัญ: ผูก event แตะเป้า → ส่งกลับเข้า engine ===
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.engine && typeof this.engine.handleTargetTap === 'function') {
        this.engine.handleTargetTap(t.id, ev);
      }
    }, { passive: false });

    this.host.appendChild(el);
    this.targets.set(t.id, el);
    t.dom = el;
  }

  removeTarget(t) {
    const id = t && t.id;
    const el = (t && t.dom) || this.targets.get(id);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    if (id != null) this.targets.delete(id);
    if (t) t.dom = null;
  }
}