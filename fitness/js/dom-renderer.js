// === fitness/js/dom-renderer.js (2025-11-22 — DOM targets + score FX) ===
'use strict';

import { spawnHitParticle } from './particle.js';

export class DomRenderer {
  /**
   * @param {ShadowBreakerGame} game - engine หลัก เรียก registerTouch(...)
   * @param {HTMLElement} host      - เลเยอร์เป้า (#target-layer)
   * @param {Object} opts           - { sizePx: number }
   */
  constructor(game, host, opts = {}) {
    this.game   = game;
    this.host   = host;
    this.sizePx = opts.sizePx || 96;

    /** @type {Map<number, HTMLElement>} */
    this.targets = new Map();
    this.bounds  = { w: 1, h: 1 };

    this.handleClick  = this.handleClick.bind(this);
    this.updateBounds = this.updateBounds.bind(this);

    this.updateBounds();
    window.addEventListener('resize', this.updateBounds);
  }

  /* ------------------------------------------------------ */
  /*  LAYOUT / BOUNDS                                       */
  /* ------------------------------------------------------ */

  updateBounds() {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.bounds = {
      w: rect.width  || 1,
      h: rect.height || 1
    };
  }

  /* ------------------------------------------------------ */
  /*  SPAWN / REMOVE TARGET                                 */
  /* ------------------------------------------------------ */

  spawnTarget(t) {
    if (!this.host) return;
    this.updateBounds();

    const size  = this.sizePx;
    const margin = 32; // กันชิดขอบ

    // สุ่มตำแหน่งในกรอบเล่น (ไม่ให้ชิดขอบเกินไป)
    const x = margin + Math.random() * Math.max(1, this.bounds.w - margin * 2);
    const y = margin + Math.random() * Math.max(1, this.bounds.h - margin * 2);

    // wrapper เป้า
    const outer = document.createElement('div');
    outer.className  = 'sb-target';
    outer.dataset.id = String(t.id);

    // ชนิดเป้า (ใช้ใน CSS)
    outer.dataset.type = t.decoy ? 'bad' : 'good';

    outer.style.width      = size + 'px';
    outer.style.height     = size + 'px';
    outer.style.left       = x + 'px';
    outer.style.top        = y + 'px';
    outer.style.marginLeft = -(size / 2) + 'px';
    outer.style.marginTop  = -(size / 2) + 'px';

    // inner สำหรับ emoji / พื้นหลัง
    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = t.emoji || (t.decoy ? '💣' : '🥊');
    outer.appendChild(inner);

    outer.addEventListener('pointerdown', this.handleClick);

    this.host.appendChild(outer);
    t.dom = outer;
    this.targets.set(t.id, outer);
  }

  handleClick(ev) {
    const el = ev.currentTarget;
    if (!el || !this.host) return;

    ev.preventDefault();

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
      if (el.parentNode === this.host) {
        this.host.removeChild(el);
      }
    }
    this.targets.delete(t.id);
  }

  /* ------------------------------------------------------ */
  /*  HIT / MISS EFFECT                                     */
  /* ------------------------------------------------------ */

  /**
   * แสดงเอฟเฟกต์ตอนตีเป้า / พลาด
   * @param {Object} t - target object มี t.dom
   * @param {Object} opts - { grade, score, miss, decoy, fever }
   */
  spawnHitEffect(t, opts = {}) {
    if (!this.host) return;

    const hostRect = this.host.getBoundingClientRect();
    let cx = hostRect.width / 2;
    let cy = hostRect.height / 2;

    if (t.dom) {
      const r = t.dom.getBoundingClientRect();
      cx = r.left - hostRect.left + r.width / 2;
      cy = r.top  - hostRect.top  + r.height / 2;

      // ให้เป้า "แตก" หรือ fade ออก
      if (opts.miss) {
        t.dom.classList.add('sb-miss');
      } else {
        t.dom.classList.add('sb-hit');
      }
      // ลบ dom หลังแอนิเมชันจบ เพื่อไม่รก
      setTimeout(() => {
        if (t.dom && t.dom.parentNode === this.host) {
          t.dom.removeEventListener('pointerdown', this.handleClick);
          this.host.removeChild(t.dom);
        }
      }, 260);
    }

    // ปล่อย particle emoji 💥 ที่ตำแหน่งเป้า
    spawnHitParticle(this.host, cx, cy, opts.decoy ? '💣' : '💥');

    // คะแนนลอยขึ้น
    const fx = document.createElement('div');
    fx.className = 'sb-fx-score';

    const score = opts.score || 0;
    let label = '';

    if (opts.miss) {
      label = 'MISS';
      fx.classList.add('sb-miss');
    } else if (opts.decoy && score < 0) {
      label = String(score);
      fx.classList.add('sb-miss');
    } else {
      label = score > 0 ? '+' + score : String(score);
      if (opts.grade === 'perfect') fx.classList.add('sb-perfect');
      else fx.classList.add('sb-good');
    }

    fx.textContent = label;
    fx.style.left  = cx + 'px';
    fx.style.top   = cy + 'px';

    this.host.appendChild(fx);
    setTimeout(() => {
      if (fx.parentNode === this.host) this.host.removeChild(fx);
    }, 700);
  }

  /* ------------------------------------------------------ */
  /*  CLEAR                                                 */
  /* ------------------------------------------------------ */

  clear() {
    for (const el of this.targets.values()) {
      el.removeEventListener('pointerdown', this.handleClick);
      if (el.parentNode === this.host) this.host.removeChild(el);
    }
    this.targets.clear();

    // ลบเอฟเฟกต์ที่เหลืออยู่
    if (this.host) {
      const fx = this.host.querySelectorAll('.sb-fx-score, .hitParticle');
      fx.forEach(node => {
        if (node.parentNode === this.host) this.host.removeChild(node);
      });
    }
  }
}