// === fitness/js/dom-renderer.js — Shadow Breaker DOM renderer (2025-11-24 v3) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game   = game;
    this.host   = host;
    this.sizePx = opts.sizePx || 96;
    this.targets = new Map();
    this.bounds  = { w: 1, h: 1 };

    this.handleClick  = this.handleClick.bind(this);
    this.updateBounds = this.updateBounds.bind(this);

    this.updateBounds();
    window.addEventListener('resize', this.updateBounds);
    window.addEventListener('orientationchange', this.updateBounds);
  }

  updateBounds() {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.bounds = {
      w: rect.width  || 1,
      h: rect.height || 1
    };
  }

  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(t.id);

    // type + bossFace สำหรับใช้กับ CSS
    el.dataset.type      = t.decoy ? 'bad' : 'good';
    el.dataset.bossFace  = t.bossFace ? '1' : '0';

    // ขนาดเป้า
    const size = t.size_px || this.sizePx;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';

    // สุ่มตำแหน่งในกรอบเล่น (กันขอบ 24px)
    const margin = 24;
    const maxW = Math.max(this.bounds.w - margin * 2, 1);
    const maxH = Math.max(this.bounds.h - margin * 2, 1);

    const x = margin + Math.random() * maxW;
    const y = margin + Math.random() * maxH;

    // เก็บ normalized coord ให้ engine log เป็น x_norm / y_norm
    t.x_norm = this.bounds.w ? x / this.bounds.w : 0.5;
    t.y_norm = this.bounds.h ? y / this.bounds.h : 0.5;

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // inner (ตามดีไซน์ใน shadow-breaker.css)
    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🎯';
    el.appendChild(inner);

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

    // effect หด / fade ของตัวเป้าเอง
    if (t.dom) {
      t.dom.classList.add('sb-hit');
      setTimeout(() => {
        if (t.dom) t.dom.classList.remove('sb-hit');
      }, 220);
    }

    // หาตำแหน่งกลางของเป้า (หรือกลาง field ถ้าไม่มี dom)
    const hostRect = this.host.getBoundingClientRect();
    let x = hostRect.width / 2;
    let y = hostRect.height / 2;

    if (t.dom) {
      const r = t.dom.getBoundingClientRect();
      x = r.left - hostRect.left + r.width / 2;
      y = r.top  - hostRect.top  + r.height / 2;
    }

    // popup คะแนน
    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    const score = typeof opts.score === 'number' ? opts.score : 0;
    let text = '';

    if (opts.miss) {
      text = 'MISS';
      fx.classList.add('sb-miss');
    } else if (opts.decoy) {
      text = score ? String(score) : '-60';
      fx.classList.add('sb-decoy');
    } else {
      // normal target
      const grade = opts.grade || 'good';
      if (grade === 'perfect') {
        text = '+' + (score || 0) + ' PERFECT';
        fx.classList.add('sb-perfect');
      } else if (grade === 'good') {
        text = '+' + (score || 0) + ' GOOD';
        fx.classList.add('sb-good');
      } else {
        text = '+' + (score || 0);
        fx.classList.add('sb-good');
      }
    }

    fx.textContent = text;
    fx.style.left = x + 'px';
    fx.style.top  = y + 'px';

    this.host.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
    }, 600);

    // emoji particle (💥 / 💣 / ✨)
    let emo = '💥';
    if (opts.decoy) emo = '💣';
    else if (opts.grade === 'perfect') emo = '✨';

    spawnHitParticle(this.host, x, y, emo);
  }

  clear() {
    // ลบเป้าทั้งหมด
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();

    // ลบเอฟเฟกต์ที่ยังค้าง
    if (this.host) {
      this.host
        .querySelectorAll('.sb-fx-score, .hitParticle')
        .forEach(node => node.parentNode === this.host && node.parentNode.removeChild(node));
    }
  }
}
