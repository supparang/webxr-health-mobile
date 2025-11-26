// === js/dom-renderer.js — Shadow Breaker DOM Target Renderer + FX (2025-11-28a) ===
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
    this.targets = new Map(); // id → element

    if (getComputedStyle(this.host).position === 'static') {
      // ให้เป็น relative เพื่อวาง absolute child ง่าย ๆ
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

    const rect = this.host.getBoundingClientRect();
    const size = target.sizePx || 96;
    const radius = size / 2;
    const margin = radius + 8; // กันหลุดขอบ + glow

    const w = rect.width  || this.host.clientWidth  || 320;
    const h = rect.height || this.host.clientHeight || 320;

    const maxX = Math.max(margin, w - margin);
    const maxY = Math.max(margin, h - margin);

    const x = clamp(
      margin + Math.random() * (w - margin * 2),
      margin,
      maxX
    );
    const y = clamp(
      margin + Math.random() * (h - margin * 2),
      margin,
      maxY
    );

    // ค่าปกติ 0..1 สำหรับงานวิจัย
    const xNorm = w > 0 ? x / w : 0.5;
    const yNorm = h > 0 ? y / h : 0.5;
    target.x_norm = +xNorm.toFixed(4);
    target.y_norm = +yNorm.toFixed(4);

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sb-target' + (target.type ? ` sb-target--${target.type}` : '');
    el.dataset.id = String(target.id);
    el.dataset.type = target.type || 'normal';

    el.style.position = 'absolute';
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    // ใช้ translate(-50%,-50%) จาก CSS → ให้ left/top เป็นจุดกึ่งกลาง
    el.style.left   = x + 'px';
    el.style.top    = y + 'px';

    // handler click / touch
    const handler = (ev) => {
      ev.preventDefault();
      this._emitHit(target.id, ev);
    };
    el.addEventListener('pointerdown', handler);
    el.addEventListener('click', handler);

    this.host.appendChild(el);
    this.targets.set(target.id, el);
  }

  // ---------- REMOVE TARGET ----------

  /**
   * ลบเป้าตาม id พร้อม effect เล็กน้อย
   * reason: 'hit' | 'timeout' | 'boss-change' | 'end' ...
   */
  removeTarget(id, reason = '') {
    const el = this.targets.get(id);
    if (!el) return;

    if (reason === 'timeout') {
      el.classList.add('sb-target--fade-timeout');
      setTimeout(() => el.remove(), 180);
    } else if (reason === 'boss-change' || reason === 'end') {
      el.classList.add('sb-target--fade-soft');
      setTimeout(() => el.remove(), 140);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  // ---------- HIT FX ----------

  /**
   * เล่น effect ตอนตีโดนเป้า:
   *   - สั่น / scale เป้า
   *   - popup คะแนน/emoji
   */
  playHitFx(id, opts = {}) {
    const el = this.targets.get(id);
    const host = this.host || document.body;
    if (!host) return;

    const { grade, scoreDelta, fxEmoji, clientX, clientY } = opts;

    const hostRect = host.getBoundingClientRect();
    let x = clientX;
    let y = clientY;

    if (el) {
      // ใช้ center ของเป้าเป็นหลัก
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top  + r.height / 2;

      // animation ตอนโดน
      el.classList.add('sb-target--hit');
      setTimeout(() => {
        if (el.isConnected) el.remove();
      }, 120);

      this.targets.delete(id);
    } else {
      // fallback: กลางสนาม
      if (x == null || y == null) {
        x = hostRect.left + hostRect.width / 2;
        y = hostRect.top  + hostRect.height / 2;
      }
    }

    // popup คะแนน / emoji
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
