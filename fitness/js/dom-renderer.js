// === fitness/js/dom-renderer.js (2025-11-21 — TARGET + SCORE FX) ===
'use strict';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game   = game;
    this.host   = host;
    this.sizePx = opts.sizePx || 96;
    this.targets = new Map();

    this.handleClick  = this.handleClick.bind(this);
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

    const outer = document.createElement('div');
    outer.className = 'sb-target';
    outer.dataset.id   = String(t.id);
    outer.dataset.type = t.decoy ? 'bad' : 'good';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🎯';
    outer.appendChild(inner);

    const size = this.sizePx;
    outer.style.width  = size + 'px';
    outer.style.height = size + 'px';
    outer.style.marginLeft = -(size / 2) + 'px';
    outer.style.marginTop  = -(size / 2) + 'px';

    // random position inside field (margin 32px)
    const margin = 32;
    const x = margin + Math.random() * (this.bounds.w - margin * 2);
    const y = margin + Math.random() * (this.bounds.h - margin * 2);
    outer.style.left = x + 'px';
    outer.style.top  = y + 'px';

    outer.addEventListener('pointerdown', this.handleClick);
    this.host.appendChild(outer);

    t.dom = outer;
    this.targets.set(t.id, outer);
  }

  handleClick(ev) {
    const el = ev.currentTarget;
    if (!el || !this.host) return;

    const id = parseInt(el.dataset.id || '0', 10);
    if (!id) return;

    const hostRect = this.host.getBoundingClientRect();
    const x = ev.clientX - hostRect.left;
    const y = ev.clientY - hostRect.top;

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

  // effect: target “แตก” + score popup
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    if (t.dom) {
      const cls = opts.miss ? 'sb-miss' : 'sb-hit';
      t.dom.classList.add(cls);
      setTimeout(() => {
        if (t.dom) t.dom.classList.remove(cls);
      }, 220);
    }

    const hostRect = this.host.getBoundingClientRect();
    let x = hostRect.width / 2;
    let y = hostRect.height / 2;

    if (t.dom) {
      const r = t.dom.getBoundingClientRect();
      x = r.left - hostRect.left + r.width / 2;
      y = r.top  - hostRect.top  + r.height / 2;
    }

    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    let txt = '';
    if (opts.miss) {
      txt = 'MISS';
    } else if (typeof opts.score === 'number') {
      txt = opts.score > 0 ? '+' + opts.score : String(opts.score);
    }

    fx.textContent = txt;

    if (opts.decoy || opts.miss) {
      fx.classList.add('sb-miss');
    } else if (opts.grade === 'perfect') {
      fx.classList.add('sb-perfect');
    } else {
      fx.classList.add('sb-good');
    }

    fx.style.left = x + 'px';
    fx.style.top  = y + 'px';

    this.host.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
    }, 600);
  }

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();
  }
}