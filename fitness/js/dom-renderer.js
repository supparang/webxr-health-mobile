// === js/dom-renderer.js — Shadow Breaker DOM Target Renderer + FX (2025-11-29) ===
'use strict';

/**
 * ใช้กับ ShadowBreakerEngine:
 *   this.renderer = new DomRenderer(this.field, {
 *     onTargetHit: (id, info) => this.handleHit(id, info)
 *   });
 *
 * engine จะเรียก:
 *   - renderer.spawnTarget(target)
 *   - renderer.removeTarget(id, reason)
 *   - renderer.playHitFx(id, opts)
 */

const clamp = (v, min, max) => (v < min ? min : (v > max ? max : v));

export class DomRenderer {
  /**
   * @param {HTMLElement} host  พื้นที่ให้เป้าโผล่ (เช่น #target-layer)
   * @param {Object} opts
   *   - onTargetHit(id, info)  callback เมื่อมีการกดเป้า
   */
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.opts = opts;
    this.targets = new Map(); // id → { el, cx, cy, size }

    if (getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }
  }

  // ---------- SPAWN TARGET ----------

  /**
   * สร้าง DOM เป้าตามข้อมูล target จาก engine._spawnTarget
   * target: { id, type, sizePx, ... }
   * จะอัปเดต target.x_norm / target.y_norm เป็นตำแหน่ง 0..1
   */
  spawnTarget(target) {
    if (!this.host || !target) return;

    const fieldRect = this.host.getBoundingClientRect();
    const size = target.sizePx || 96;
    const radius = size / 2;
    const margin = radius + 10; // กัน glow หลุดขอบ

    const w = fieldRect.width  || this.host.clientWidth  || 320;
    const h = fieldRect.height || this.host.clientHeight || 320;

    if (w < margin * 2 || h < margin * 2) {
      console.warn('[DomRenderer] playfield too small');
      return;
    }

    // ---- เลือกตำแหน่งแบบพยายามไม่ให้ชนกันตรง ๆ ----
    let cx = 0;
    let cy = 0;

    const isTooClose = (x, y) => {
      for (const { cx: ox, cy: oy, size: os } of this.targets.values()) {
        const dx = x - ox;
        const dy = y - oy;
        const dist2 = dx * dx + dy * dy;
        const minDist = (size + os) * 0.55;
        if (dist2 < minDist * minDist) {
          return true;
        }
      }
      return false;
    };

    const maxTry = 8;
    for (let i = 0; i < maxTry; i++) {
      const x = clamp(
        margin + Math.random() * (w - margin * 2),
        margin,
        w - margin
      );
      const y = clamp(
        margin + Math.random() * (h - margin * 2),
        margin,
        h - margin
      );
      if (!isTooClose(x, y) || i === maxTry - 1) {
        cx = x;
        cy = y;
        break;
      }
    }

    // ค่าปกติ 0..1 สำหรับงานวิจัย
    const xNorm = w > 0 ? cx / w : 0.5;
    const yNorm = h > 0 ? cy / h : 0.5;
    target.x_norm = +xNorm.toFixed(4);
    target.y_norm = +yNorm.toFixed(4);

    // ---- สร้างปุ่มเป้า + emoji ภายใน ----
    const type = target.type || 'normal';
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target sb-target--' + type;
    el.dataset.id = String(target.id);
    el.dataset.type = type;

    el.style.position = 'absolute';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    // ใช้ translate(-50%,-50%) จาก CSS ให้ left/top เป็น center
    el.style.left   = cx + 'px';
    el.style.top    = cy + 'px';

    // emoji / icon ตามชนิดเป้า
    const emoji = this._iconForType(type, target);
    const inner = document.createElement('div');
    inner.className = 'sb-target-inner sb-target-inner--' + type;
    inner.textContent = emoji;

    el.appendChild(inner);

    const handler = (ev) => {
      ev.preventDefault();
      this._emitHit(target.id, ev);
    };
    el.addEventListener('pointerdown', handler);
    el.addEventListener('click', handler);

    this.host.appendChild(el);
    this.targets.set(target.id, { el, cx, cy, size });
  }

  _iconForType(type, target) {
    if (type === 'bomb')      return '💣';
    if (type === 'decoy')     return '👻';
    if (type === 'heal')      return '💚';
    if (type === 'shield')    return '🛡️';
    if (type === 'bossface')  return '😈';
    // default: เป้าปกติ
    return '🎯';
  }

  // ---------- REMOVE TARGET ----------

  /**
   * ลบเป้าตาม id พร้อม effect เล็กน้อย
   * reason: 'hit' | 'timeout' | 'boss-change' | 'end' ...
   */
  removeTarget(id, reason = '') {
    const rec = this.targets.get(id);
    if (!rec) return;
    const el = rec.el;

    if (reason === 'timeout') {
      el.classList.add('sb-target--fade-timeout');
      setTimeout(() => el.remove(), 180);
    } else if (reason === 'boss-change' || reason === 'end') {
      el.classList.add('sb-target--fade-soft');
      setTimeout(() => el.remove(), 140);
    } else if (reason === 'hit') {
      el.classList.add('sb-target--hit');
      setTimeout(() => el.remove(), 140);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  // ---------- HIT FX ----------

  /**
   * เล่น effect ตอนตีโดนเป้า:
   *   - popup คะแนน/emoji ลอยขึ้น
   */
  playHitFx(id, opts = {}) {
    const rec = this.targets.get(id);
    const host = this.host || document.body;
    if (!host) return;

    const { grade, scoreDelta, fxEmoji, clientX, clientY } = opts;

    const hostRect = host.getBoundingClientRect();
    let x = clientX;
    let y = clientY;

    if (rec && rec.el) {
      const r = rec.el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top  + r.height / 2;
    } else {
      if (x == null || y == null) {
        x = hostRect.left + hostRect.width / 2;
        y = hostRect.top  + hostRect.height  / 2;
      }
    }

    // popup
    const pop = document.createElement('div');
    pop.className = 'sb-pop';

    const emoDefault =
      fxEmoji ||
      (grade === 'perfect' ? '💥' :
       grade === 'good'    ? '⭐' :
       grade === 'heal'    ? '💚' :
       grade === 'shield'  ? '🛡️' :
       grade === 'bomb'    ? '💣' : '💫');

    if (typeof scoreDelta === 'number' && scoreDelta > 0) {
      pop.textContent = `+${scoreDelta}`;
    } else {
      pop.textContent = emoDefault;
    }

    const xLocal = x - hostRect.left;
    const yLocal = y - hostRect.top;
    pop.style.left = xLocal + 'px';
    pop.style.top  = yLocal + 'px';

    host.appendChild(pop);
    setTimeout(() => pop.remove(), 650);
  }

  // ---------- INTERNAL ----------

  _emitHit(id, ev) {
    if (!this.opts || typeof this.opts.onTargetHit !== 'function') return;
    this.opts.onTargetHit(id, {
      clientX: ev.clientX,
      clientY: ev.clientY
    });
  }
}
