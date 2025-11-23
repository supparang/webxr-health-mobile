// === js/dom-renderer.js — DOM renderer for Shadow Breaker (2025-11-24 v3) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game    = game;
    this.host    = host;
    this.sizePx  = opts.sizePx || 100;
    this.targets = new Map();
    this.bounds  = null;

    this._onResize = () => this.cacheBounds();
    window.addEventListener('resize', this._onResize);
    this.cacheBounds();
  }

  cacheBounds() {
    if (!this.host) return;
    this.bounds = this.host.getBoundingClientRect();
  }

  clear() {
    if (!this.host) return;
    this.host.innerHTML = '';
    this.targets.clear();
  }

  /**
   * สร้างเป้าใหม่บนจอ
   * t: { id, emoji, decoy, bossFace, size_px, ... }  (object จาก engine.js)
   */
  spawnTarget(t) {
    if (!this.host) return;
    if (!this.bounds || !this.bounds.width || !this.bounds.height) {
      this.cacheBounds();
      if (!this.bounds || !this.bounds.width || !this.bounds.height) return;
    }

    const el    = document.createElement('div');
    const inner = document.createElement('div');
    el.className    = 'sb-target';
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🥊';
    el.appendChild(inner);

    if (t.decoy)    el.dataset.type = 'bad';
    if (t.bossFace) el.dataset.bossFace = '1';

    const size = t.size_px || this.sizePx;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    // สุ่มตำแหน่ง (เก็บ x_norm / y_norm กลับไปที่ t ด้วย)
    const margin = size * 0.6;
    const w = Math.max(10, this.bounds.width  - margin * 2);
    const h = Math.max(10, this.bounds.height - margin * 2);

    const xNorm = Math.random();
    const yNorm = Math.random();
    const x = margin + xNorm * w;
    const y = margin + yNorm * h;

    t.x_norm = xNorm;
    t.y_norm = yNorm;

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // pointer handler — ใช้ t.id (number) ตรง ๆ ไม่ผ่าน dataset
    const handlePointer = (ev) => {
      if (!this.game || !this.game.running) return;

      ev.preventDefault();
      ev.stopPropagation();

      // เช็คว่าคลิกในวงกลมจริง ๆ
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = ev.clientX - cx;
      const dy = ev.clientY - cy;
      const r  = rect.width / 2;

      if ((dx * dx + dy * dy) > (r * r)) {
        // แตะด้านนอกเป้า → ไม่ถือว่า hit
        return;
      }

      // ส่ง id แบบ number ให้ engine.js
      this.game.registerTouch(ev.clientX, ev.clientY, t.id);
    };

    el.addEventListener('pointerdown', handlePointer, { passive: false });

    // เก็บ reference กลับไปที่ target object
    t._el    = el;
    t._onPtr = handlePointer;

    this.targets.set(t.id, { el, t });
    this.host.appendChild(el);
  }

  /**
   * ลบเป้า (มี animation ยุบหายไป)
   */
  removeTarget(t) {
    const entry = this.targets.get(t.id);
    const el = entry ? entry.el : t._el;
    if (!el || el._removed) return;
    el._removed = true;

    if (t._onPtr) {
      el.removeEventListener('pointerdown', t._onPtr);
      t._onPtr = null;
    }

    el.classList.add('sb-hit');

    // รอ animation แล้วค่อยถอดออกจาก DOM
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 230);

    this.targets.delete(t.id);
  }

  /**
   * เอฟเฟกต์คะแนน + ข้อความ PERFECT / GOOD / MISS / Bomb
   */
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const entry = this.targets.get(t.id);
    const refEl = entry ? entry.el : t._el;
    if (!refEl) return;

    const fieldRect = this.host.getBoundingClientRect();
    const rect      = refEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 - fieldRect.left;
    const cy = rect.top  + rect.height / 2 - fieldRect.top;

    // popup คะแนน
    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    let text = '';
    if (opts.decoy) {
      text = (opts.score ?? -60) + ' Bomb!';
      fx.classList.add('sb-decoy');
    } else if (opts.miss) {
      text = 'MISS';
      fx.classList.add('sb-miss');
    } else {
      const base = opts.score ?? 0;
      if (opts.grade === 'perfect') {
        text = base + ' PERFECT!';
        fx.classList.add('sb-perfect');
      } else if (opts.grade === 'good') {
        text = base + ' GOOD';
        fx.classList.add('sb-good');
      } else {
        text = String(base);
      }
    }

    fx.textContent = text;
    fx.style.left  = cx + 'px';
    fx.style.top   = cy + 'px';
    this.host.appendChild(fx);

    setTimeout(() => {
      if (fx.parentNode) fx.parentNode.removeChild(fx);
    }, 600);

    // particle emoji 💥 บนจุดเดียวกัน
    try {
      spawnHitParticle(this.host, cx, cy, opts.decoy ? '💣' : '💥');
    } catch (e) {
      // เงียบ ๆ ถ้า particle ล้มเหลว
    }
  }
}
