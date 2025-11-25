// === js/dom-renderer.js — Shadow Breaker DOM target renderer (2025-11-25 v4) ===
'use strict';

import { spawnHitParticle } from './particle.js';

const rand = (min, max) => min + Math.random() * (max - min);

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;
    this.sizePx = opts.sizePx || 100;

    if (this.host) {
      // ให้เลเยอร์เป้า “กินเต็มสนาม” เสมอ
      const s = this.host.style;
      if (!s.position || s.position === 'static') s.position = 'relative';
      s.width = '100%';
      s.height = '100%';
      s.touchAction = 'manipulation';

      this.host.addEventListener('pointerdown', (ev) => {
        this.handlePointer(ev);
      });
    }
  }

  setGame(game) {
    this.game = game;
  }

  clear() {
    if (!this.host) return;
    this.host.innerHTML = '';
  }

  spawnTarget(target) {
    if (!this.host) return;

    // ถ้า host ตัวเองเล็กผิดปกติ ให้ fallback ไปใช้ parent (.sb-field)
    let fieldEl = this.host;
    let fieldRect = fieldEl.getBoundingClientRect();
    if (fieldRect.height < 40 || fieldRect.width < 40) {
      if (fieldEl.parentElement) {
        fieldEl = fieldEl.parentElement;
        fieldRect = fieldEl.getBoundingClientRect();
      }
    }

    const margin = 40;
    const w = Math.max(fieldRect.width, margin * 2 + 10);
    const h = Math.max(fieldRect.height, margin * 2 + 10);

    const x = rand(margin, w - margin);
    const y = rand(margin, h - margin);

    const size =
      (this.game && this.game.config && this.game.config.sizePx) ||
      this.sizePx ||
      100;

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(target.id);
    if (target.decoy) el.dataset.type = 'bad';
    if (target.bossFace) el.dataset.bossFace = '1';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = target.emoji || '🥊';
    el.appendChild(inner);

    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.left   = x + 'px';
    el.style.top    = y + 'px';

    // เก็บตำแหน่งล่าสุดไว้ให้ engine ใช้คำนวณ x_norm/y_norm
    target.lastPos = { x, y };
    target.size_px = size;

    // ให้เป้าถูกวาดภายใน host
    this.host.appendChild(el);
    target._el = el;
  }

  handlePointer(ev) {
    if (!this.game || !this.game.running) return;
    if (!this.host) return;

    const rect = this.host.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    const targetEl = ev.target.closest('.sb-target');
    let targetId = null;
    if (targetEl && targetEl.dataset.id) {
      targetId = Number(targetEl.dataset.id);
    }

    // FX ตอนแตะหน้าจอ
    spawnHitParticle(this.host, {
      x,
      y,
      emoji: '✨',
      count: 6,
      spread: 42,
      lifeMs: 420,
      className: 'sb-hit-particle'
    });

    if (targetId != null) {
      this.game.registerTouch(x, y, targetId);
    }
  }
}