// === fitness/js/dom-renderer.js (2025-11-20 — SIMPLE DOM RENDERER) ===
'use strict';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;
    this.sizePx = opts.sizePx || 96;
    this.targets = new Map();

    this.handleClick = this.handleClick.bind(this);
    this.updateBounds = this.updateBounds.bind(this);

    this.updateBounds();
    window.addEventListener('resize', this.updateBounds);
  }

  updateBounds() {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.bounds = { w: rect.width || 1, h: rect.height || 1 };
  }

  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(t.id);
    el.textContent = t.emoji || '🎯';

    const size = this.sizePx;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.marginLeft = -(size / 2) + 'px';
    el.style.marginTop = -(size / 2) + 'px';

    // สุ่มตำแหน่งในกรอบเล่น (กันขอบ 32px)
    const margin = 32;
    const x = margin + Math.random() * (this.bounds.w - margin * 2);
    const y = margin + Math.random() * (this.bounds.h - margin * 2);
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    el.addEventListener('pointerdown', this.handleClick);
    this.host.appendChild(el);

    t.dom = el;
    this.targets.set(t.id, el);
  }

  handleClick(ev) {
    const el = ev.currentTarget;
    if (!el || !this.host) return;

    const id = parseInt(el.dataset.id || '0', 10);
    if (!id) return;

    const rect = this.host.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    this.game.registerTouch(x, y, id);
  }

  removeTarget(t) {
    const el = t && t.dom;
    if (el) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.delete(t.id);
  }

  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    // ทำให้เป้าเด้ง/จางเล็กน้อย
    if (t.dom) {
      t.dom.classList.add('sb-target-hit');
      setTimeout(() => {
        if (t.dom) t.dom.classList.remove('sb-target-hit');
      }, 180);
    }

    // คะแนนลอยขึ้น
    const fx = document.createElement('div');
    fx.className = 'sb-hit';

    const score = opts.score || 0;
    let text = score === 0 ? '' : (score > 0 ? '+' + score : String(score));
    if (opts.miss) text = 'MISS';
    if (opts.decoy && score < 0) text = String(score);

    fx.textContent = text;

    const hostRect = this.host.getBoundingClientRect();
    let x = hostRect.width / 2;
    let y = hostRect.height / 2;

    if (t.dom) {
      const r = t.dom.getBoundingClientRect();
      x = r.left - hostRect.left + r.width / 2;
      y = r.top - hostRect.top + r.height / 2;
    }

    fx.style.left = x + 'px';
    fx.style.top = y + 'px';

    this.host.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
    }, 700);
  }

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();
  }
}
