// === js/dom-renderer.js — DOM target renderer + hit FX (2025-11-28) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  /**
   * @param {HTMLElement} host  ชั้นสำหรับวางเป้า (#target-layer)
   * @param {Object} opts
   *   - onTargetHit(id, info)
   */
  constructor(host, opts = {}) {
    this.host = host;
    this.container = host?.closest('[data-sb-field]') || host || document.body;
    this.onTargetHit = opts.onTargetHit || (() => {});
    this.targets = new Map();

    if (!this.host) {
      console.warn('[DomRenderer] host is null, renderer will be no-op');
    }
  }

  // ---------- position helper ----------

  _place(el, t) {
    let xn =
      (typeof t.xNorm === 'number' ? t.xNorm : null) ??
      (typeof t.x_norm === 'number' ? t.x_norm : null);
    let yn =
      (typeof t.yNorm === 'number' ? t.yNorm : null) ??
      (typeof t.y_norm === 'number' ? t.y_norm : null);

    const validNorm =
      typeof xn === 'number' && xn >= 0 && xn <= 1 &&
      typeof yn === 'number' && yn >= 0 && yn <= 1;

    if (!validNorm) {
      const lr = (t.zoneLR || t.zone_lr || 'C').toUpperCase();
      const ud = (t.zoneUD || t.zone_ud || 'M').toUpperCase();

      let col = 1;
      if (lr === 'L') col = 0;
      else if (lr === 'R') col = 2;

      let row = 1;
      if (ud === 'U') row = 0;
      else if (ud === 'D') row = 2;

      const cellW = 1 / 3;
      const cellH = 1 / 3;

      const jitterX = (Math.random() - 0.5) * 0.3 * cellW;
      const jitterY = (Math.random() - 0.5) * 0.3 * cellH;

      xn = (col + 0.5) * cellW + jitterX;
      yn = (row + 0.5) * cellH + jitterY;
    }

    xn = Math.min(0.9, Math.max(0.1, xn));
    yn = Math.min(0.9, Math.max(0.1, yn));

    el.style.left = (xn * 100) + '%';
    el.style.top  = (yn * 100) + '%';
  }

  // ---------- spawn / remove ----------

  /**
   * t: {
   *   id, sizePx, diffKey, bossPhase,
   *   isDecoy,isBomb,isHeal,isShield,isBossFace,
   *   xNorm,yNorm,zoneLR,zoneUD,emoji
   * }
   */
  spawnTarget(t) {
    if (!this.host || !t || t.id == null) return;

    if (this.targets.has(t.id)) {
      this.removeTarget(t.id, 'dup');
    }

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(t.id);

    // คลาสตามระดับความยาก + phase
    if (t.diffKey) {
      el.classList.add(String(t.diffKey));
    }
    if (t.bossPhase != null) {
      el.dataset.phase = String(t.bossPhase);
    }

    if (t.isDecoy) el.dataset.type = 'decoy';
    if (t.isBomb)  el.dataset.type = 'bomb';
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

    const sizePx = t.sizePx || 120;
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
        clientY: ev.clientY ?? sy
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
      }, 200);
    } else {
      if (el.parentNode) el.parentNode.removeChild(el);
    }

    this.targets.delete(id);
  }

  // ---------- FX ----------

  /**
   * แสดง FX ตรงเป้า:
   * - popup คะแนน + grade
   * - วงแหวน neon
   * - particle แตกกระจาย
   * - shake สนามเล็กน้อย
   */
  playHitFx(targetId, ev = {}) {
    const field = this.container || this.host || document.body;
    const fieldRect = field.getBoundingClientRect();

    const rec = this.targets.get(targetId);

    let cx;
    let cy;
    if (rec && rec.el) {
      const r = rec.el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    } else if (ev.screenX != null && ev.screenY != null) {
      cx = ev.screenX;
      cy = ev.screenY;
    } else {
      cx = fieldRect.left + fieldRect.width / 2;
      cy = fieldRect.top + fieldRect.height / 2;
    }

    const rx = cx - fieldRect.left;
    const ry = cy - fieldRect.top;

    // popup คะแนน
    const popup = document.createElement('div');
    popup.className = 'sb-scorefx';

    let label = '';
    const delta = ev.scoreDelta != null ? ev.scoreDelta : '';
    if (ev.grade === 'perfect') {
      label = delta ? `+${delta} PERFECT` : 'PERFECT';
      popup.classList.add('perfect');
    } else if (ev.grade === 'good') {
      label = delta ? `+${delta} GOOD` : 'GOOD';
      popup.classList.add('good');
    } else if (ev.grade === 'heal') {
      label = '+HP';
      popup.classList.add('good');
    } else if (ev.grade === 'shield') {
      label = 'SHIELD';
      popup.classList.add('good');
    } else if (ev.grade === 'bomb') {
      label = 'BOMB!';
      popup.classList.add('miss');
    } else {
      label = 'MISS';
      popup.classList.add('miss');
    }

    popup.textContent = label;
    popup.style.left = rx + 'px';
    popup.style.top  = ry + 'px';
    field.appendChild(popup);
    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 650);

    // วงแหวน neon
    const neon = document.createElement('div');
    neon.className = 'sb-neon-hit';
    neon.style.left = rx + 'px';
    neon.style.top  = ry + 'px';
    field.appendChild(neon);
    setTimeout(() => {
      if (neon.parentNode) neon.parentNode.removeChild(neon);
    }, 260);

    // particles แตกกระจาย
    spawnHitParticle(field, {
      x: rx,
      y: ry,
      emoji: ev.fxEmoji || (ev.grade === 'perfect' ? '💥' : '✨'),
      count: ev.grade === 'perfect' ? 8 : 5,
      spread: 48,
      lifeMs: 480,
      className: 'sb-hit-particle'
    });

    // shake สนาม
    field.classList.add('sb-shake-field');
    setTimeout(() => field.classList.remove('sb-shake-field'), 140);
  }
}