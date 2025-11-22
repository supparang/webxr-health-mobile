// === js/dom-renderer.js — DOM Target Renderer + FX (2025-11-24 Research Edition) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;

    this.sizePx = opts.sizePx || 100;
    this._rect  = null;

    this.updateRect();
    window.addEventListener('resize', () => this.updateRect(), { passive: true });
  }

  updateRect() {
    if (!this.host) return;
    this._rect = this.host.getBoundingClientRect();
  }

  /* --------------------------------------------------------------- */
  /*  SPAWN TARGET                                                   */
  /* --------------------------------------------------------------- */

  spawnTarget(t) {
    if (!this.host) return;
    if (!this._rect) this.updateRect();

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.style.width  = this.sizePx + 'px';
    el.style.height = this.sizePx + 'px';
    el.style.lineHeight = this.sizePx + 'px';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🥊';

    el.appendChild(inner);
    el.dataset.id = t.id;
    if (t.decoy) el.dataset.type = 'bad';
    if (t.bossFace) el.dataset.bossFace = '1';

    /* Random position but NOT touching edge */
    const PAD = 20 + this.sizePx * 0.5;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;

    const x = PAD + Math.random() * (w - PAD * 2);
    const y = PAD + Math.random() * (h - PAD * 2);

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // Save for fallback
    t.lastPos = { x, y };

    const onPointer = (ev) => {
      ev.preventDefault();
      const r = this.host.getBoundingClientRect();
      const cx = ev.clientX - r.left;
      const cy = ev.clientY - r.top;
      this.game.registerTouch(cx, cy, t.id);
    };

    t._el = el;
    t._onPtr = onPointer;

    el.addEventListener('pointerdown', onPointer, { passive: false });

    this.host.appendChild(el);
  }

  /* --------------------------------------------------------------- */
  /*  REMOVE TARGET                                                  */
  /* --------------------------------------------------------------- */

  removeTarget(t) {
    const el = t._el;
    if (!el) return;

    try {
      if (t._onPtr) el.removeEventListener('pointerdown', t._onPtr);
    } catch (e) {}

    if (el.parentNode) el.parentNode.removeChild(el);

    t._el = null;
    t._onPtr = null;
  }

  /* --------------------------------------------------------------- */
  /*  HIT / MISS FX                                                  */
  /* --------------------------------------------------------------- */

  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    let x, y;
    const hostRect = this.host.getBoundingClientRect();

    if (t._el && t._el.parentNode) {
      const r = t._el.getBoundingClientRect();
      x = r.left + r.width / 2 - hostRect.left;
      y = r.top  + r.height / 2 - hostRect.top;

      /* hit animation shrink */
      t._el.classList.add('sb-hit');

      setTimeout(() => {
        if (t._el && t._el.parentNode) t._el.parentNode.removeChild(t._el);
      }, 200);
    } else if (t.lastPos) {
      x = t.lastPos.x;
      y = t.lastPos.y;
    } else {
      x = hostRect.width / 2;
      y = hostRect.height / 2;
    }

    /* ---- particle (emoji) ---- */
    const emo =
      opts.miss ? '💢'
    : opts.decoy ? '💥'
    : opts.grade === 'perfect' ? '⭐'
    : '✨';

    spawnHitParticle(this.host, x, y, emo);

    /* ---- score popup ---- */
    const popup = document.createElement('div');
    popup.className = 'sb-fx-score';

    let text = '';
    let cls  = '';

    if (opts.miss) {
      text = 'MISS';
      cls  = 'sb-miss';
    } else if (opts.decoy) {
      text = `-${Math.abs(opts.score)} Bomb`;
      cls  = 'sb-decoy';
    } else if (opts.grade === 'perfect') {
      text = `+${opts.score} PERFECT`;
      cls  = 'sb-perfect';
    } else {
      text = `+${opts.score}`;
      cls  = 'sb-good';
    }

    popup.textContent = text;
    popup.classList.add(cls);

    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';

    this.host.appendChild(popup);

    // Remove fx
    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 650);
  }

  /* --------------------------------------------------------------- */
  /*  CLEAR ALL                                                      */
  /* --------------------------------------------------------------- */

  clear() {
    if (!this.host) return;
    this.host.innerHTML = '';
  }
}
