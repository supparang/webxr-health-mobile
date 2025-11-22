// === js/dom-renderer.js — DOM target renderer + FX (2025-11-22 CENTER ZONE) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game = game;
    this.host = host;
    this.sizePx = opts.sizePx || 100;

    this._rect = null;
    this.updateRect();
    window.addEventListener('resize', () => this.updateRect(), { passive: true });
  }

  updateRect() {
    if (!this.host) return;
    this._rect = this.host.getBoundingClientRect();
  }

  /* ----------------- สร้างเป้า ----------------- */
  spawnTarget(t) {
    if (!this.host) return;
    if (!this._rect) this.updateRect();

    const size = this.sizePx;
    const el = document.createElement('div');
    el.className = 'sb-target';
    el.style.width = size + 'px';
    el.style.height = size + 'px';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || '🥊';

    el.dataset.id = String(t.id);
    el.dataset.type = t.decoy ? 'bad' : 'good';
    el.appendChild(inner);

    // ---------- วางเป้า "โซนกลางจอ" ----------
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;

    // พื้นที่ปลอดภัย = กลางจอประมาณ 60% ของ width/height
    const pad = 18 + size / 2;
    const centerX = w / 2;
    const centerY = h / 2;

    const spanX = Math.max(80, w * 0.6);   // กระจายซ้าย-ขวา แต่เน้นกลาง
    const spanY = Math.max(80, h * 0.6);   // กระจายบน-ล่าง แต่เน้นกลาง

    let x = centerX - spanX / 2 + Math.random() * spanX;
    let y = centerY - spanY / 2 + Math.random() * spanY;

    // กันไม่ให้ชิดขอบเกินไป
    x = Math.min(Math.max(x, pad), w - pad);
    y = Math.min(Math.max(y, pad), h - pad);

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // เก็บตำแหน่งล่าสุด
    t.lastPos = { x, y };

    const onPointerDown = (ev) => {
      ev.preventDefault();
      const rect = this.host.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      this.game.registerTouch(cx, cy, t.id);
    };

    el.addEventListener('pointerdown', onPointerDown);

    t._el = el;
    t._onPtr = onPointerDown;

    this.host.appendChild(el);
  }

  /* ----------------- ลบเป้า (แบบเงียบ) ----------------- */
  removeTarget(t) {
    const el = t && t._el;
    if (!el) return;
    try {
      if (t._onPtr) {
        el.removeEventListener('pointerdown', t._onPtr);
      }
    } catch (e) {}
    if (el.parentNode) el.parentNode.removeChild(el);
    t._el = null;
    t._onPtr = null;
  }

  /* ----------------- เอฟเฟกต์โดนตี / miss ----------------- */
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const host = this.host;
    const el = t && t._el;
    let x, y;

    if (el && el.parentNode) {
      const r = el.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      x = r.left + r.width / 2 - hr.left;
      y = r.top + r.height / 2 - hr.top;

      // เป้าแตกกระจาย
      el.classList.add('sb-hit');

      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    } else if (t && t.lastPos) {
      x = t.lastPos.x;
      y = t.lastPos.y;
    } else {
      x = host.clientWidth / 2;
      y = host.clientHeight / 2;
    }

    // 💥 particle
    const emo = opts.decoy ? '💥' : (opts.miss ? '💢' : '✨');
    spawnHitParticle(host, x, y, emo);

    // คะแนนเด้ง
    const popup = document.createElement('div');
    popup.className = 'sb-fx-score';

    const score = opts.score || 0;
    let cls;
    let text;

    if (opts.miss) {
      cls = 'sb-miss';
      text = 'MISS';
    } else if (opts.decoy || score < 0) {
      cls = 'sb-decoy';
      text = `-${Math.abs(score)} Bomb`;
    } else if (opts.grade === 'perfect') {
      cls = 'sb-perfect';
      text = `+${score} PERFECT`;
    } else {
      cls = 'sb-good';
      text = `+${score}`;
    }

    popup.classList.add(cls);
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';
    popup.textContent = text;

    host.appendChild(popup);

    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 600);
  }

  /* ----------------- เคลียร์ทั้งหมด ----------------- */
  clear() {
    if (!this.host) return;
    this.host.innerHTML = '';
  }
}
