// === fitness/js/dom-renderer.js (2025-11-19 — targets + mobile tap + hit popup) ===
'use strict';

export class DomRenderer {
  constructor(engine, host, opts = {}) {
    this.engine  = engine;
    this.host    = host;          // ปกติเป็น #target-layer
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

  /* ---------- spawn / remove target ---------- */

  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target' + (t.decoy ? ' sb-target-decoy' : '');
    el.style.width  = this.sizePx + 'px';
    el.style.height = this.sizePx + 'px';
    el.textContent  = t.emoji || '⭐';

    const safeW = Math.max(0, this.bounds.w - this.sizePx);
    const safeH = Math.max(0, this.bounds.h - this.sizePx);

    const x = (t.x || Math.random()) * safeW;
    const y = (t.y || Math.random()) * safeH;

    el.style.position  = 'absolute';
    el.style.left      = '0';
    el.style.top       = '0';
    el.style.transform = `translate(${x}px, ${y}px)`;

    el.dataset.id = String(t.id);

    // แตะเป้า → ส่งพิกัดจอเข้า engine.registerTouch
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

  /* ---------- hit effect + score popup ---------- */

  spawnHitEffect(t, info = {}) {
    if (!this.host) return;
    this.updateBounds();

    const baseEl = t && t.dom ? t.dom : this.host;
    const rect   = baseEl.getBoundingClientRect();

    // center in host coordinates
    const cx = rect.left + rect.width  / 2 - this.bounds.left;
    const cy = rect.top  + rect.height / 2 - this.bounds.top;

    const emojiChar = info.miss
      ? '💨'
      : (info.decoy ? '💣' : (info.fever ? '💥' : '✨'));

    const particle = document.createElement('div');
    particle.className = 'sb-hit-particle';
    particle.textContent = emojiChar;
    particle.style.left = cx + 'px';
    particle.style.top  = cy + 'px';

    const label = document.createElement('div');
    label.className = 'sb-hit-score';
    label.style.left = cx + 'px';
    label.style.top  = (cy - 6) + 'px';

    if (info.miss) {
      label.textContent = 'MISS';
    } else {
      const grade = info.grade || 'Hit';
      const s     = info.score || 0;
      label.textContent = `${grade.toUpperCase()}  +${s}`;
    }

    this.host.appendChild(particle);
    this.host.appendChild(label);

    setTimeout(() => {
      if (particle.parentNode) particle.parentNode.removeChild(particle);
      if (label.parentNode)    label.parentNode.removeChild(label);
    }, 450);
  }
}