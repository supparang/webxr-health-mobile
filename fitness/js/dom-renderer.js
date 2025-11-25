// === js/dom-renderer.js — DOM target renderer + FX (Shadow Breaker 2025-11-25b) ===
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

    window.addEventListener('resize', () => {
      // ถ้าจะปรับตำแหน่งตาม resize เพิ่มได้ทีหลัง
    }, { passive: true });
  }

  /* -------------------- utility: position -------------------- */

  /**
   * วางเป้าจาก x_norm / y_norm หรือ zone_lr / zone_ud
   */
  _place(el, t) {
    let xn = null;
    let yn = null;

    if (typeof t.x_norm === 'number' && t.x_norm > 0 && t.x_norm < 1) xn = t.x_norm;
    else if (typeof t.xNorm === 'number' && t.xNorm > 0 && t.xNorm < 1) xn = t.xNorm;

    if (typeof t.y_norm === 'number' && t.y_norm > 0 && t.y_norm < 1) yn = t.y_norm;
    else if (typeof t.yNorm === 'number' && t.yNorm > 0 && t.yNorm < 1) yn = t.yNorm;

    // ถ้าไม่มี norm → ใช้ zone
    if (xn == null) {
      const zr = (t.zone_lr || t.zoneLR || 'C').toUpperCase();
      if (zr === 'L')      xn = 0.20 + Math.random() * 0.12;
      else if (zr === 'R') xn = 0.68 + Math.random() * 0.12;
      else                 xn = 0.40 + Math.random() * 0.20;
    }

    if (yn == null) {
      const zu = (t.zone_ud || t.zoneUD || 'M').toUpperCase();
      if (zu === 'U')      yn = 0.22 + Math.random() * 0.14;
      else if (zu === 'D') yn = 0.64 + Math.random() * 0.12;
      else                 yn = 0.40 + Math.random() * 0.18;
    }

    const xPct = 8 + xn * 84;   // กันขอบซ้ายขวา
    const yPct = 12 + yn * 76;  // กันขอบบนล่าง

    el.style.left = xPct + '%';
    el.style.top  = yPct + '%';
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
      setTimeout(() => {
        el.remove();
      }, 220);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  /* -------------------- FX / feedback -------------------- */

  /**
   * แสดง popup คะแนน + neon burst + particle
   * ev: { grade, scoreDelta, fxEmoji }
   */
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
      // ถ้าเป้าถูกลบไปแล้ว ให้ใช้กลางฟิลด์แทน (กันเด้งไปมุมจอ)
      cx = fieldRect.left + fieldRect.width / 2;
      cy = fieldRect.top  + fieldRect.height / 2;
    }

    // แปลงเป็นพิกัด relative ในฟิลด์
    const rx = cx - fieldRect.left;
    const ry = cy - fieldRect.top;

    // ---- popup score ----
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

    // ---- neon ring ----
    const neon = document.createElement('div');
    neon.className = 'sb-neon-hit';
    neon.style.left = rx + 'px';
    neon.style.top  = ry + 'px';
    field.appendChild(neon);
    setTimeout(() => neon.remove(), 260);

    // ---- particle emoji ----
    spawnHitParticle(field, { x: rx, y: ry, emoji: ev.fxEmoji || '✨' });

    // ---- camera shake ----
    field.classList.add('sb-shake-field');
    setTimeout(() => field.classList.remove('sb-shake-field'), 160);
  }
}