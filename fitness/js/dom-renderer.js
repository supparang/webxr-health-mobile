// === js/dom-renderer.js — DOM field + FX (2025-11-24 v4) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game   = game;
    this.host   = host;
    this.sizePx = opts.sizePx || 100;
    this.targets = new Map(); // id → { el, inner, onPtr }

    if (this.host) {
      // ให้เป็น relative เสมอ และปิด gesture scroll บนมือถือ
      if (!this.host.style.position || this.host.style.position === 'static') {
        this.host.style.position = 'relative';
      }
      this.host.style.touchAction = 'none';
      this.updateBounds();
      window.addEventListener('resize', () => this.updateBounds());
    }
  }

  /* ---------- utils ---------- */

  updateBounds() {
    if (!this.host) return;
    this.bounds = this.host.getBoundingClientRect();
  }

  clear() {
    if (!this.host) return;
    for (const { el, onPtr } of this.targets.values()) {
      if (onPtr) el.removeEventListener('pointerdown', onPtr);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();
  }

  /* ---------- spawn / remove target ---------- */

  spawnTarget(t) {
    if (!this.host) return;

    if (!this.bounds) this.updateBounds();
    const rect   = this.bounds;
    const margin = (this.sizePx / 2) + 8;
    const w      = Math.max(rect.width  - margin * 2, this.sizePx);
    const h      = Math.max(rect.height - margin * 2, this.sizePx);

    const x = margin + Math.random() * w;
    const y = margin + Math.random() * h;

    const outer = document.createElement('div');
    outer.className   = 'sb-target';
    outer.dataset.id  = String(t.id);
    outer.dataset.type = t.decoy ? 'bad' : 'good';
    if (t.bossFace) outer.dataset.bossFace = '1';

    outer.style.width  = this.sizePx + 'px';
    outer.style.height = this.sizePx + 'px';
    outer.style.left   = x + 'px';
    outer.style.top    = y + 'px';

    const inner = document.createElement('div');
    inner.className   = 'sb-target-inner';
    inner.textContent = t.emoji || '🥊';
    outer.appendChild(inner);

    const onPtr = (ev) => {
      if (!this.game || !this.game.running) return;
      ev.preventDefault();
      ev.stopPropagation();

      const r  = this.host.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      this.game.registerTouch(px, py, t.id);
    };
    outer.addEventListener('pointerdown', onPtr);

    this.host.appendChild(outer);

    // เก็บตำแหน่งแบบ normalized ไว้ใช้ตอนทำ effect
    t.x_norm  = rect.width  > 0 ? x / rect.width  : 0.5;
    t.y_norm  = rect.height > 0 ? y / rect.height : 0.5;
    t.size_px = this.sizePx;
    t._el     = outer;
    t._onPtr  = onPtr;

    this.targets.set(t.id, { el: outer, inner, onPtr });
  }

  // engine.handleHit / handleMiss / handleDecoyHit เรียกอันนี้ก่อน spawnHitEffect
  removeTarget(t) {
    const rec = this.targets.get(t.id);
    if (!rec) return;
    const { el, onPtr } = rec;

    el.classList.add('sb-hit');
    if (onPtr) el.removeEventListener('pointerdown', onPtr);

    // ยังไม่ลบจาก Map ทันที เพื่อให้ spawnHitEffect ใช้ตำแหน่งได้
    setTimeout(() => {
      if (el.parentNode === this.host) this.host.removeChild(el);
      this.targets.delete(t.id);
    }, 220);
  }

  /* ---------- score / particle effect ---------- */

  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const hostRect = this.host.getBoundingClientRect();
    let cx, cy;

    const rec = this.targets.get(t.id);
    if (rec && rec.el.isConnected) {
      const r = rec.el.getBoundingClientRect();
      cx = r.left + r.width  / 2 - hostRect.left;
      cy = r.top  + r.height / 2 - hostRect.top;
    } else if (t.x_norm != null && t.y_norm != null && this.bounds) {
      cx = t.x_norm * this.bounds.width;
      cy = t.y_norm * this.bounds.height;
    } else {
      cx = hostRect.width / 2;
      cy = hostRect.height / 2;
    }

    // 1) score popup (Perfect / Good / Miss / Bomb)
    if (typeof opts.score === 'number') {
      const badge = document.createElement('div');
      let cls  = 'sb-fx-score';
      let text = (opts.score > 0 ? '+' : '') + String(opts.score);

      if (opts.decoy)       cls += ' sb-decoy';
      else if (opts.miss)   cls += ' sb-miss';
      else if (opts.grade === 'perfect') cls += ' sb-perfect';
      else                  cls += ' sb-good';

      badge.className   = cls;
      badge.textContent = text;
      badge.style.left  = cx + 'px';
      badge.style.top   = cy + 'px';

      this.host.appendChild(badge);
      setTimeout(() => {
        if (badge.parentNode === this.host) this.host.removeChild(badge);
      }, 650);
    }

    // 2) emoji particle 💥 / ✨ / 💣 / 💢
    let emo = '💥';
    if (opts.decoy)         emo = '💣';
    else if (opts.miss)     emo = '💢';
    else if (opts.grade === 'perfect') emo = '✨';

    spawnHitParticle(this.host, cx, cy, emo);
  }
}
