// === js/dom-renderer.js — DOM target renderer + FX (2025-11-28) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.targets = new Map();
  }

  setEngine(engine) {
    this.engine = engine;
  }

  clear() {
    for (const { el } of this.targets.values()) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
    this.targets.clear();
  }

  spawnTarget(t) {
    if (!this.host) return;
    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id   = String(t.id);
    el.dataset.diff = t.diffKey || 'normal';
    el.dataset.phase= String(t.bossPhase || t.phase || 1);
    el.dataset.boss = String(t.bossIndex ?? 0);
    el.dataset.type = t.type || (t.isBomb ? 'bomb' : t.isDecoy ? 'decoy' : 'normal');

    if (t.isBossFace) el.classList.add('sb-boss-face');
    if (t.isBomb)     el.classList.add('sb-target-bomb');
    if (t.isDecoy)    el.classList.add('sb-target-decoy');

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || (t.isBomb ? '💣' : t.isHeal ? '💚' : t.isShield ? '🛡️' : '🎯');
    el.appendChild(inner);

    const size = t.sizePx || 140;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    this._placeTarget(el, t);

    const onHit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = t.id;
      const pos = { x: ev.clientX, y: ev.clientY };
      if (this.opts.onTargetHit) {
        this.opts.onTargetHit(id, pos);
      }
    };

    el.addEventListener('pointerdown', onHit, { passive: false });
    el.addEventListener('click', onHit, { passive: false });

    this.host.appendChild(el);
    this.targets.set(t.id, { el, data: t });
  }

  _placeTarget(el, t) {
    const hostRect = this.host.getBoundingClientRect();
    const w = hostRect.width || window.innerWidth || 800;
    const h = hostRect.height || window.innerHeight || 600;

    let xn = typeof t.x_norm === 'number' ? t.x_norm : Math.random();
    let yn = typeof t.y_norm === 'number' ? t.y_norm : Math.random();

    const marginX = 0.08;
    const marginY = 0.12;
    xn = marginX + xn * (1 - 2 * marginX);
    yn = marginY + yn * (1 - 2 * marginY);

    const left = xn * w;
    const top  = yn * h;

    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
    el.style.transform = 'translate(-50%, -50%)';
  }

  removeTarget(id, reason = 'hit') {
    const rec = this.targets.get(id);
    if (!rec) return;
    const { el } = rec;
    if (!el) return;

    el.classList.add(reason === 'timeout' ? 'sb-target-timeout' : 'sb-target-hit');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);

    this.targets.delete(id);
  }

  playHitFx(id, info = {}) {
    const rec = this.targets.get(id);
    const el = rec?.el;
    if (!el || !this.host) return;

    const hostRect = this.host.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - hostRect.left;
    const cy = rect.top + rect.height / 2 - hostRect.top;

    const grade = info.grade || 'good';
    const scoreDelta = info.scoreDelta || 0;
    const fxEmoji = info.fxEmoji || '✨';

    // Score popup
    if (scoreDelta !== 0 || grade === 'miss') {
      const fx = document.createElement('div');
      fx.className = 'sb-scorefx ' + grade;
      fx.textContent = grade === 'miss' ? 'MISS' : (scoreDelta > 0 ? '+' + scoreDelta : scoreDelta);
      fx.style.left = cx + 'px';
      fx.style.top  = cy + 'px';
      this.host.appendChild(fx);
      setTimeout(() => fx.remove(), 480);
    }

    // Emoji spark
    const spark = document.createElement('div');
    spark.className = 'sb-hit-spark ' + grade;
    spark.textContent = fxEmoji;
    spark.style.left = cx + 'px';
    spark.style.top  = cy + 'px';
    this.host.appendChild(spark);
    setTimeout(() => spark.remove(), 420);

    // Particle burst (safe fallback)
    try {
      if (typeof spawnHitParticle === 'function') {
        spawnHitParticle(this.host, {
          screen: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          }
        });
      }
    } catch (e) {
      // ignore
    }

    // small shake of host
    this.host.classList.add('sb-hit-bump');
    setTimeout(() => this.host.classList.remove('sb-hit-bump'), 140);
  }
}