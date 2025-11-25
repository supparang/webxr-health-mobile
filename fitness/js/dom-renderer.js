// === js/dom-renderer.js — DOM target renderer + FX (Shadow Breaker 2025-11-25) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  /**
   * @param {HTMLElement} host  ชั้นที่ใช้วางเป้า (#target-layer)
   * @param {Object} opts
   *   - onTargetHit(id, info) ถูกเรียกเมื่อผู้เล่นแตะเป้า
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.onTargetHit = opts.onTargetHit || (() => {});
    this.targets = new Map();

    if (!this.host) {
      console.warn('[DomRenderer] host is null, renderer will be no-op');
    }

    window.addEventListener(
      'resize',
      () => {
        // ถ้าต้องการคำนวณตำแหน่งใหม่ตามขนาดจอ สามารถใส่โค้ดเพิ่มได้ที่นี่
      },
      { passive: true }
    );
  }

  /* -------------------- utility: position -------------------- */

  /**
   * ตีความตำแหน่งจาก x_norm / y_norm หรือ zone_lr / zone_ud
   * แล้ววางเป้าลงใน .sb-field แบบไม่ชิดขอบเกินไป
   */
  _place(el, t) {
    let xn = null;
    let yn = null;

    // 1) ใช้ x_norm / y_norm ถ้ามีและอยู่ในช่วง (0,1)
    if (typeof t.x_norm === 'number' && t.x_norm > 0 && t.x_norm < 1) {
      xn = t.x_norm;
    } else if (typeof t.xNorm === 'number' && t.xNorm > 0 && t.xNorm < 1) {
      xn = t.xNorm;
    }

    if (typeof t.y_norm === 'number' && t.y_norm > 0 && t.y_norm < 1) {
      yn = t.y_norm;
    } else if (typeof t.yNorm === 'number' && t.yNorm > 0 && t.yNorm < 1) {
      yn = t.yNorm;
    }

    // 2) ถ้าไม่มี ให้ใช้ zone_lr / zone_ud เป็น bucket แล้ว random ภายใน
    if (xn == null) {
      const zr = (t.zone_lr || t.zoneLR || 'C').toUpperCase();
      if (zr === 'L') xn = 0.20 + Math.random() * 0.12; // 0.20–0.32
      else if (zr === 'R') xn = 0.68 + Math.random() * 0.12; // 0.68–0.80
      else xn = 0.40 + Math.random() * 0.20; // center 0.40–0.60
    }

    if (yn == null) {
      const zu = (t.zone_ud || t.zoneUD || 'M').toUpperCase();
      if (zu === 'U') yn = 0.22 + Math.random() * 0.14; // 0.22–0.36
      else if (zu === 'D') yn = 0.64 + Math.random() * 0.12; // 0.64–0.76
      else yn = 0.40 + Math.random() * 0.18; // 0.40–0.58
    }

    // 3) map เป็น %
    const xPct = 8 + xn * 84;  // 8%–92%
    const yPct = 12 + yn * 76; // 12%–88%

    el.style.left = xPct + '%';
    el.style.top = yPct + '%';
  }

  /* -------------------- spawn / remove -------------------- */

  /**
   * t: {
   *   id, sizePx, isDecoy, isBomb, isHeal, isShield, isBossFace,
   *   x_norm, y_norm, zone_lr, zone_ud, emoji
   * }
   */
  spawnTarget(t) {
    if (!this.host) return;
    if (!t || t.id == null) return;

    // ลบของเก่าถ้ามี id ซ้ำ
    if (this.targets.has(t.id)) {
      this.removeTarget(t.id, 'dup');
    }

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = t.id;

    if (t.isDecoy)    el.dataset.type = 'decoy';
    if (t.isBomb)     el.dataset.type = 'bad';
    if (t.isBossFace) el.dataset.bossFace = '1';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';

    let symbol = '🥊';
    if (t.isBomb)        symbol = '💣';
    else if (t.isHeal)   symbol = '💚';
    else if (t.isShield) symbol = '🛡️';
    else if (t.isDecoy)  symbol = '🎯';
    if (t.emoji)         symbol = t.emoji;

    inner.textContent = symbol;
    el.appendChild(inner);

    const sizePx = t.sizePx || t.size || 140;
    el.style.width = sizePx + 'px';
    el.style.height = sizePx + 'px';

    this._place(el, t);

    const handleHit = (ev) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = rect.left + rect.width / 2;
      const sy = rect.top + rect.height / 2;

      // ยิง callback ให้ engine
      this.onTargetHit(t.id, {
        screenX: sx,
        screenY: sy,
        clientX: ev.clientX ?? sx,
        clientY: ev.clientY ?? sy,
      });
    };

    el.addEventListener('pointerdown', handleHit);
    el.addEventListener('touchstart', handleHit, { passive: false });

    this.host.appendChild(el);
    this.targets.set(t.id, { el, data: t });
  }

  removeTarget(id, reason = '') {
    const rec = this.targets.get(id);
    if (!rec) return;
    const el = rec.el;

    if (reason === 'hit') {
      el.classList.add('sb-hit');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    } else {
      if (el.parentNode) el.parentNode.removeChild(el);
    }

    this.targets.delete(id);
  }

  /* -------------------- FX / feedback -------------------- */

  /**
   * แสดง popup คะแนน + neon burst + camera shake
   * ev: { grade, scoreDelta, emoji }
   */
  playHitFx(targetId, ev = {}) {
    const rec = this.targets.get(targetId);
    const base = rec?.el || this.host;
    if (!base) return;

    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // popup score
    const popup = document.createElement('div');
    popup.className = 'sb-fx-score';

    let label = '';
    if (ev.grade === 'perfect') {
      label = `+${ev.scoreDelta ?? ''} PERFECT`;
      popup.classList.add('sb-perfect');
    } else if (ev.grade === 'good') {
      label = `+${ev.scoreDelta ?? ''} GOOD`;
      popup.classList.add('sb-good');
    } else if (ev.grade === 'heal') {
      label = '+HP';
      popup.classList.add('sb-good');
    } else if (ev.grade === 'shield') {
      label = '+SHIELD';
      popup.classList.add('sb-good');
    } else if (ev.grade === 'bomb') {
      label = 'BOMB!';
      popup.classList.add('sb-miss');
    } else {
      label = 'MISS';
      popup.classList.add('sb-miss');
    }

    popup.textContent = label;
    popup.style.left = cx + 'px';
    popup.style.top = cy + 'px';
    document.body.appendChild(popup);

    setTimeout(() => popup.remove(), 600);

    // neon ring
    const neon = document.createElement('div');
    neon.className = 'sb-neon-hit';
    neon.style.left = cx + 'px';
    neon.style.top = cy + 'px';
    document.body.appendChild(neon);
    setTimeout(() => neon.remove(), 260);

    // particle emoji (ใช้ A-Frame หรือ DOM mode)
    spawnHitParticle(document.body, { x: cx, y: cy, emoji: ev.fxEmoji || '✨' });

    // camera shake (field)
    const field = this.host?.closest('.sb-field');
    if (field) {
      field.classList.add('sb-shake-field');
      setTimeout(() => field.classList.remove('sb-shake-field'), 160);
    }
  }
}