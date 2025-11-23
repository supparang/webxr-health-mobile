// === js/dom-renderer.js — DOM target renderer + FX (2025-11-24 tuned) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  constructor(game, host, opts = {}) {
    this.game   = game;
    this.host   = host;
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

    // ถ้ามี size จาก diff/engine ให้ใช้เลย ไม่งั้นใช้ค่า default
    const size = t.size_px || this.sizePx;
    t.size_px = size;

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.touchAction = 'manipulation'; // ช่วยลดการ scroll/click เพี้ยนบนมือถือ

    const inner = document.createElement('div');
    inner.className   = 'sb-target-inner';
    inner.textContent = t.emoji || '🥊';

    el.dataset.id   = String(t.id);
    el.dataset.type = t.decoy ? 'bad' : 'good';
    if (t.bossFace) el.dataset.bossFace = '1';
    el.appendChild(inner);

    // ---- วางสุ่มใน field แบบใช้สัดส่วน (เก็บไว้ลง CSV ได้) ----
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    const padRatio = 0.18; // เว้นขอบซ้าย/ขวา/บน/ล่าง ~18% ของพื้นที่
    const xNorm = padRatio + Math.random() * (1 - padRatio * 2);
    const yNorm = padRatio + Math.random() * (1 - padRatio * 2);

    const x = xNorm * w;
    const y = yNorm * h;

    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    // เก็บตำแหน่ง/พิกัด normalize สำหรับงานวิจัย
    t.lastPos = { x, y };
    t.x_norm  = xNorm;
    t.y_norm  = yNorm;

    const onPointerDown = (ev) => {
      ev.preventDefault();
      // ปิดคลิกซ้ำบน target เดิม (กัน double-score)
      if (t._clicked) return;
      t._clicked = true;

      const rect = this.host.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;

      // ส่งตำแหน่งสัมพัทธ์ host เข้า engine
      this.game.registerTouch(cx, cy, t.id);
    };

    el.addEventListener('pointerdown', onPointerDown);

    t._el    = el;
    t._onPtr = onPointerDown;
    t._clicked = false;

    this.host.appendChild(el);
  }

  /* ----------------- ลบเป้าแบบเงียบ (ใช้ตอน timeout / clear) ----------------- */
  removeTarget(t) {
    const el = t && t._el;
    if (!el) return;

    try {
      if (t._onPtr) {
        el.removeEventListener('pointerdown', t._onPtr);
      }
    } catch (e) {}

    if (el.parentNode) el.parentNode.removeChild(el);

    t._el    = null;
    t._onPtr = null;
  }

  /* ----------------- เอฟเฟกต์โดนตี / miss ----------------- */
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;
    const host = this.host;

    const el = t && t._el;
    let x, y;

    if (el && el.parentNode) {
      const r  = el.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      x = r.left + r.width  / 2 - hr.left;
      y = r.top  + r.height / 2 - hr.top;

      // ให้เป้าแตก + fade ก่อนลบ
      el.classList.add('sb-hit');
      el.style.pointerEvents = 'none';

      // ลบตัว DOM หลังแอนิเมชันจบ
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);

      // เคลียร์ reference เพื่อกัน memory leak
      t._el = null;
      t._onPtr = null;
    } else if (t && t.lastPos) {
      // กรณี engine ลบไปแล้ว → ใช้ตำแหน่งล่าสุด
      x = t.lastPos.x;
      y = t.lastPos.y;
    } else {
      // fallback กลางจอ
      x = host.clientWidth / 2;
      y = host.clientHeight / 2;
    }

    // 💥 particle (เลือก emoji ให้บอกอารมณ์มากขึ้น)
    const emo = opts.miss ? '💢' : (opts.decoy ? '💣' : '💥');
    spawnHitParticle(host, x, y, emo);

    // คะแนนเด้ง
    const popup = document.createElement('div');
    popup.className = 'sb-fx-score';

    const score = opts.score || 0;
    let cls;
    let text;

    if (opts.miss) {
      cls  = 'sb-miss';
      text = 'MISS';
    } else if (opts.decoy || score < 0) {
      cls  = 'sb-decoy';
      text = `-${Math.abs(score)} Bomb`;
    } else if (opts.grade === 'perfect') {
      cls  = 'sb-perfect';
      text = `+${score} PERFECT`;
    } else if (opts.grade === 'good') {
      cls  = 'sb-good';
      text = `+${score} GOOD`;
    } else {
      cls  = 'sb-good';
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
