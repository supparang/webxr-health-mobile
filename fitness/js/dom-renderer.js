// === js/dom-renderer.js — DOM target renderer + FX (Shadow Breaker 2025-11-25c) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  /**
   * @param {HTMLElement} host  ชั้นที่ใช้วางเป้า (#target-layer)
   * @param {Object} opts
   *   - onTargetHit(id, info)
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.container = host?.closest('.sb-field') || host || document.body;
    this.onTargetHit = opts.onTargetHit || (() => {});
    this.targets = new Map();

    if (!this.host) {
      console.warn('[DomRenderer] host is null, renderer will be no-op');
    }

    window.addEventListener(
      'resize',
      () => { /* ไว้เผื่ออนาคตถ้าจะปรับตำแหน่งตอน resize */ },
      { passive: true }
    );
  }

  /* -------------------- utility: position -------------------- */

  /**
   * วางเป้าจาก x_norm / y_norm หรือ zone_lr / zone_ud
   * - ถ้ามี x_norm,y_norm 0–1 จะใช้ตรง ๆ
   * - ถ้าไม่มี ใช้ zone วางบน grid 3x3 แล้วสุ่มใน cell นิดหน่อย
   */
  _place(el, t) {
    let xn =
      (typeof t.x_norm === 'number' ? t.x_norm : null) ??
      (typeof t.xNorm === 'number' ? t.xNorm : null);
    let yn =
      (typeof t.y_norm === 'number' ? t.y_norm : null) ??
      (typeof t.yNorm === 'number' ? t.yNorm : null);

    const hasNorm =
      typeof xn === 'number' && xn >= 0 && xn <= 1 &&
      typeof yn === 'number' && yn >= 0 && yn <= 1;

    if (!hasNorm) {
      // ----- ใช้ zone เป็น grid 3×3 -----
      const lr = (t.zone_lr || t.zoneLR || '').toUpperCase();
      const ud = (t.zone_ud || t.zoneUD || '').toUpperCase();

      let col;
      if (lr === 'L') col = 0;
      else if (lr === 'R') col = 2;
      else col = 1; // C หรือ undefined = กลาง

      let row;
      if (ud === 'U') row = 0;
      else if (ud === 'D') row = 2;
      else row = 1; // M หรือ undefined = กลาง

      const cellW = 1 / 3;
      const cellH = 1 / 3;

      // jitter เล็กน้อยใน cell เพื่อไม่ให้ทับกันเป๊ะ ๆ
      const jitterX = (Math.random() - 0.5) * 0.4 * cellW; // ±20% ของ cell
      const jitterY = (Math.random() - 0.5) * 0.4 * cellH;

      xn = (col + 0.5) * cellW + jitterX;
      yn = (row + 0.5) * cellH + jitterY;
    }

    // clamp กันหลุดชิดขอบเกินไป
    xn = Math.min(0.90, Math.max(0.10, xn));
    yn = Math.min(0.88, Math.max(0.12, yn));

    el.style.left = (xn * 100) + '%';
    el.style.top  = (yn * 100) + '%';
  }

  /* -------------------- spawn / remove -------------------- */

  /**
   * t: { id, sizePx, isDecoy,isBomb,isHeal,isShield,isBossFace,
   *      x_norm,y_norm,zone_lr,zone_ud,emoji }
   */
  spawnTarget(t) {
    if (!this.host || !t || t.id == null) return;

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
    el.style.width  = sizePx + 'px';
    el.style.height = sizePx + 'px';

    this._place(el, t);

    const handleHit = (ev) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = rect.left + rect.width / 2;
      const sy = rect.top + rect.height / 2;

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
      setTimeout(() => el.remove(), 220);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  /* -------------------- FX / feedback -------------------- */

  playHitFx(targetId, ev = {}) {
    const rec = this.targets.get(targetId);
    const field = this.container || this.host || document.body;
    const fieldRect = field.getBoundingClientRect();

    let cx, cy;
    if (rec?.el) {
      const rect = rec.el.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    } else {
      cx = fieldRect.left + fieldRect.width / 2;
      cy = fieldRect.top  + fieldRect.height / 2;
    }
    const rx = cx - fieldRect.left;
    const ry = cy - fieldRect.top;

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
    popup.style.left = rx + 'px';
    popup.style.top  = ry + 'px';
    field.appendChild(popup);
    setTimeout(() => popup.remove(), 600);

    // neon ring
    const neon = document.createElement('div');
    neon.className = 'sb-neon-hit';
    neon.style.left = rx + 'px';
    neon.style.top  = ry + 'px';
    field.appendChild(neon);
    setTimeout(() => neon.remove(), 260);

    // particle
    spawnHitParticle(field, { x: rx, y: ry, emoji: ev.fxEmoji || '✨' });

    // camera shake
    field.classList.add('sb-shake-field');
    setTimeout(() => field.classList.remove('sb-shake-field'), 160);
  }
}