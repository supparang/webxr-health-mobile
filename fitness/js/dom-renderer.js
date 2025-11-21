// === js/dom-renderer.js (2025-11-22b — strong FX) ===
'use strict';

import { spawnHitParticle } from './particle.js';

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
    el.dataset.type = t.decoy ? 'bad' : 'good';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🎯';
    el.appendChild(inner);

    const size = this.sizePx;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    const margin = 40;
    const x = margin + Math.random() * Math.max(1, this.bounds.w - margin * 2);
    const y = margin + Math.random() * Math.max(1, this.bounds.h - margin * 2);
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

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

  /* เรียกทุกครั้งที่ HIT / MISS / DECOY */
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const el = t.dom || this.targets.get(t.id);
    const isMiss  = !!opts.miss;
    const isDecoy = !!opts.decoy;
    const grade   = opts.grade || (isMiss ? 'miss' : 'good');
    const score   = opts.score != null ? opts.score : 0;

    const hostRect = this.host.getBoundingClientRect();
    let cx = hostRect.width / 2;
    let cy = hostRect.height / 2;

    if (el) {
      const r = el.getBoundingClientRect();
      cx = r.left - hostRect.left + r.width / 2;
      cy = r.top  - hostRect.top  + r.height / 2;
      el.classList.add(isMiss ? 'sb-miss' : 'sb-hit');
    }

    // score popup
    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    let text = '';
    if (isMiss) {
      text = 'MISS';
      fx.classList.add('sb-miss');
    } else if (isDecoy && score < 0) {
      text = String(score);
      fx.classList.add('sb-bad');
    } else {
      text = score > 0 ? '+' + score : '';
      if (grade === 'perfect') fx.classList.add('sb-perfect');
      else fx.classList.add('sb-good');
    }

    fx.textContent = text;
    fx.style.left = cx + 'px';
    fx.style.top  = cy + 'px';

    this.host.appendChild(fx);

    // particle 💥 / 💣
    spawnHitParticle(this.host, cx, cy, isDecoy ? '💣' : '💥');

    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
      if (el) {
        el.removeEventListener('pointerdown', this.handleClick);
        if (el.parentNode === this.host) this.host.removeChild(el);
      }
      this.targets.delete(t.id);
    }, 260);
  }

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();
  }
}