// === fitness/js/dom-renderer.js (2025-11-24 — FULL SCORE FX READY) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;
    this.sizePx = opts.sizePx || 100;
    this.targets = new Map();
    this.handleClick = this.handleClick.bind(this);
    this.updateBounds = this.updateBounds.bind(this);
    this.updateBounds();
    window.addEventListener('resize', this.updateBounds);
  }

  updateBounds() {
    if (!this.host) return;
    const r = this.host.getBoundingClientRect();
    this.bounds = { w: r.width || 1, h: r.height || 1 };
  }

  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target';

    // data attributes (bomb / boss face)
    if (t.decoy) el.dataset.type = "bad";
    if (t.bossFace) el.dataset.bossFace = "1";

    // inner
    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || "🥊";
    el.appendChild(inner);

    // size
    const size = this.sizePx;
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    // random pos
    const M = 32;
    const x = M + Math.random() * (this.bounds.w - M * 2);
    const y = M + Math.random() * (this.bounds.h - M * 2);
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    t._x = x;
    t._y = y;

    el.dataset.id = String(t.id);
    el.addEventListener('pointerdown', this.handleClick);

    this.host.appendChild(el);
    t.dom = el;
    this.targets.set(t.id, el);
  }

  handleClick(ev) {
    const el = ev.currentTarget;
    if (!el) return;

    const id = Number(el.dataset.id || 0);
    if (!id) return;

    const rect = this.host.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    this.game.registerTouch(x, y, id);
  }

  removeTarget(t) {
    const el = t?.dom;
    if (!el) return;
    el.removeEventListener('pointerdown', this.handleClick);
    if (el.parentNode === this.host) el.remove();
    this.targets.delete(t.id);
  }

  // NEW: show popup score + pop animation + particle
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const el = t.dom;
    let cx = this.bounds.w / 2;
    let cy = this.bounds.h / 2;

    if (el) {
      const r = el.getBoundingClientRect();
      const base = this.host.getBoundingClientRect();
      cx = r.left - base.left + r.width / 2;
      cy = r.top - base.top + r.height / 2;

      // shrink animation
      el.classList.add('sb-hit');
      setTimeout(() => {
        if (el) el.classList.remove('sb-hit');
      }, 260);
    }

    // Score popup
    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    let label = "";
    if (opts.miss) {
      label = "MISS";
      fx.classList.add("sb-miss");
    } else if (opts.decoy && opts.score < 0) {
      label = String(opts.score);
      fx.classList.add("sb-decoy");
    } else {
      // perfect / good / bad
      if (opts.grade === 'perfect') {
        label = "PERFECT +"+opts.score;
        fx.classList.add("sb-perfect");
      } else if (opts.grade === 'good') {
        label = "GOOD +"+opts.score;
        fx.classList.add("sb-good");
      } else {
        label = "+"+opts.score;
      }
    }

    fx.textContent = label;

    fx.style.left = cx + 'px';
    fx.style.top  = cy + 'px';

    this.host.appendChild(fx);

    setTimeout(() => {
      if (fx.parentNode === this.host) fx.remove();
    }, 650);

    // particle explosion emoji 💥
    spawnHitParticle(this.host, cx, cy, "💥");
  }

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) el.remove();
    }
    this.targets.clear();
  }
}
