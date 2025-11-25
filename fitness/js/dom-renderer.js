// === js/dom-renderer.js — DOM target renderer + FX (Shadow Breaker 2025-11-28) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  /**
   * @param {HTMLElement} host  ชั้นที่ใช้วางเป้า (#target-layer)
   * @param {Object} opts
   *   - onTargetHit(id, info)
   */
  constructor(host, opts = {}) {
    this.host    = host;
    this.container = host?.closest('[data-sb-field]') || host || document.body;
    this.onTargetHit = opts.onTargetHit || (() => {});
    this.targets = new Map();

    if (!this.host) {
      console.warn('[DomRenderer] host is null, renderer will be no-op');
    }

    window.addEventListener('resize', () => {}, { passive: true });
  }

  // ตำแหน่งเป้า (ใช้ x_norm / y_norm หรือ zone_lr / zone_ud)
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
      const lr = (t.zone_lr || t.zoneLR || 'C').toUpperCase();
      const ud = (t.zone_ud || t.zoneUD || 'M').toUpperCase();

      let col = 1;
      if (lr === 'L') col = 0;
      else if (lr === 'R') col = 2;

      let row = 1;
      if (ud === 'U') row = 0;
      else if (ud === 'D') row = 2;

      const cellW = 1 / 3;
      const cellH = 1 / 3;

      const jitterX = (Math.random() - 0.5) * 0.40 * cellW; // ±20%
      const jitterY = (Math.random() - 0.5) * 0.40 * cellH;

      xn = (col + 0.5) * cellW + jitterX;
      yn = (row + 0.5) * cellH + jitterY;
    }

    // กันติดขอบ
    xn = Math.min(0.92, Math.max(0.08, xn));
    yn = Math.min(0.90, Math.max(0.10, yn));

    el.style.left = (xn * 100) + '%';
    el.style.top  = (yn * 100) + '%';
  }

  /**
   * t: {
   *   id, sizePx,
   *   diffKey, bossPhase,
   *   isDecoy,isBomb,isHeal,isShield,isBossFace,
   *   x_norm,y_norm,zone_lr,zone_ud,emoji
   * }
   */
  spawnTarget(t) {
    if (!this.host || !t || t.id == null) return;

    if (this.targets.has(t.id)) {
      this.removeTarget(t.id, 'dup');
    }

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = t.id;

    // diff / phase class — ใช้ทำ ring สี
    if (t.diffKey) {
      el.classList.add(t.diffKey);        // easy / normal / hard
      el.classList.add('diff-' + t.diffKey);
    }
    if (t.bossPhase != null) {
      el.classList.add('phase-' + t.bossPhase);
    }

    if (t.isDecoy)    el.dataset.type = 'decoy';
    if (t.isBomb)     el.dataset.type = 'bomb';
    if (t.isHeal)     el.dataset.type = 'heal';
    if (t.isShield)   el.dataset.type = 'shield';
    if (t.isBossFace) el.dataset.bossFace = '1';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';

    let symbol = '🥊';
    if (t.isBomb)        symbol = '💣';
    else if (t.isHeal)   symbol = '💚';
    else if (t.isShield) symbol = '🛡️';
    else if (t.isDecoy)  symbol = '🎯';
    else if (t.isBossFace) symbol = '👑';
    if (t.emoji)         symbol = t.emoji;

    inner.textContent = symbol;
    el.appendChild(inner);

    const sizePx = t.sizePx || t.size || 110;
    el.style.width  = sizePx + 'px';
    el.style.height = sizePx + 'px';

    this._place(el, t);

    const handleHit = (ev) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      this.onTargetHit(t.id, {
        targetId: t.id,
        clientX: ev.clientX ?? cx,
        clientY: ev.clientY ?? cy
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

  /**
   * FX ตอนตีเป้า:
   * - popup คะแนน / grade
   * - วงแหวน neon
   * - particle แตกกระจาย
   * - shake สนาม
   */
  playHitFx(targetId, ev = {}) {
    const field = this.container || this.host || document.body;
    const rectField = field.getBoundingClientRect();
    const rec = this.targets.get(targetId);

    let cx;
    let cy;

    // 1) ใช้ตำแหน่ง pointer เป็นหลัก
    if (ev && ev.clientX != null && ev.clientY != null) {
      cx = ev.clientX;
      cy = ev.clientY;
    }
    // 2) ถ้าไม่มี ใช้ center ของ target
    else if (rec && rec.el) {
      const r = rec.el.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    }
    // 3) fallback = กลาง field
    else {
      cx = rectField.left + rectField.width / 2;
      cy = rectField.top  + rectField.height / 2;
    }

    const rx = cx - rectField.left;
    const ry = cy - rectField.top;

    // popup คะแนน
    const popup = document.createElement('div');
    popup.className = 'sb-scorefx';

    const delta = ev.scoreDelta != null ? ev.scoreDelta : '';
    const grade = ev.grade || 'good';
    let label = '';

    if (grade === 'perfect') {
      label = delta ? `+${delta} PERFECT` : 'PERFECT';
      popup.classList.add('perfect');
    } else if (grade === 'good') {
      label = delta ? `+${delta} GOOD` : 'GOOD';
      popup.classList.add('good');
    } else if (grade === 'heal') {
      label = '+HP';
      popup.classList.add('good');
    } else if (grade === 'shield') {
      label = 'SHIELD';
      popup.classList.add('good');
    } else if (grade === 'bomb') {
      label = 'BOMB!';
      popup.classList.add('miss');
    } else if (grade === 'miss') {
      label = 'MISS';
      popup.classList.add('miss');
    } else {
      label = delta ? `+${delta}` : '+0';
      popup.classList.add('good');
    }

    popup.textContent = label;
    popup.style.left = rx + 'px';
    popup.style.top  = ry + 'px';
    field.appendChild(popup);
    setTimeout(() => popup.remove(), 650);

    // วงแหวน neon
    const neon = document.createElement('div');
    neon.className = 'sb-neon-hit';
    neon.style.left = rx + 'px';
    neon.style.top  = ry + 'px';
    field.appendChild(neon);
    setTimeout(() => neon.remove(), 260);

    // particle แตกกระจาย
    spawnHitParticle(field, {
      x: rx,
      y: ry,
      emoji: ev.fxEmoji || (grade === 'perfect' ? '💥' : '✨'),
      count: grade === 'perfect' ? 8 : 5,
      spread: 48,
      lifeMs: 480,
      className: 'sb-hit-particle'
    });

    // shake สนาม
    field.classList.add('sb-shake-field');
    setTimeout(() => field.classList.remove('sb-shake-field'), 140);
  }
}
