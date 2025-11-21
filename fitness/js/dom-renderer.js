// === fitness/js/dom-renderer.js — hit effect at target center (2025-11-21c) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;
    this.sizePx = opts.sizePx || 104;
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
    const x = margin + Math.random() * (this.bounds.w - margin * 2);
    const y = margin + Math.random() * (this.bounds.h - margin * 2);
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
    if (!el) return;
    el.removeEventListener('pointerdown', this.handleClick);
    if (el.parentNode === this.host) this.host.removeChild(el);
    this.targets.delete(t.id);
  }

  // ให้ effect คะแนน + particle โผล่ “กลางเป้า” จริง ๆ
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const hostRect = this.host.getBoundingClientRect();
    let x = hostRect.width / 2;
    let y = hostRect.height / 2;

    if (t.dom) {
      const r = t.dom.getBoundingClientRect();
      x = r.left - hostRect.left + r.width / 2;
      y = r.top  - hostRect.top  + r.height / 2;

      t.dom.classList.add('sb-hit');
      setTimeout(() => {
        if (t.dom) t.dom.classList.remove('sb-hit');
      }, 220);
    }

    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    const score = opts.score || 0;
    let text = '';

    if (opts.miss) {
      text = 'MISS';
      fx.classList.add('sb-miss');
    } else if (opts.decoy && score < 0) {
      text = String(score);
      fx.classList.add('sb-decoy');
    } else if (score > 0) {
      text = '+' + score;
      if (opts.grade === 'perfect') fx.classList.add('sb-perfect');
      else fx.classList.add('sb-good');
    }

    fx.textContent = text;
    fx.style.left = x + 'px';
    fx.style.top  = y + 'px';

    this.host.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
    }, 650);

    const emo = opts.decoy
      ? '💥'
      : (opts.miss ? '💨' : (opts.grade === 'perfect' ? '✨' : '⭐'));
    spawnHitParticle(this.host, x, y, emo);
  }

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();
  }
}