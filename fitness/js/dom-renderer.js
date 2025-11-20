// === fitness/js/dom-renderer.js
// DOM renderer สำหรับ Shadow Breaker / Rhythm ฯลฯ
'use strict';

// named export
export class DomRenderer {
  constructor(engine, host, opts = {}) {
    this.engine  = engine;   // game engine (มี registerTouch ฯลฯ)
    this.host    = host;     // ปกติเป็น #target-layer
    this.sizePx  = opts.sizePx || 96;
    this.targets = new Map();
    this.bounds  = { w: 0, h: 0, left: 0, top: 0 };

    if (this.host) {
      // ถ้ายังไม่กำหนด position ให้เป็น relative
      if (!this.host.style.position) {
        this.host.style.position = 'relative';
      }
      this.updateBounds();
      window.addEventListener('resize', () => this.updateBounds());
      window.addEventListener('orientationchange', () => {
        setTimeout(() => this.updateBounds(), 300);
      });
    }
  }

  setEngine(engine) {
    this.engine = engine;
  }

  updateBounds() {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.bounds.w    = rect.width;
    this.bounds.h    = rect.height;
    this.bounds.left = rect.left;
    this.bounds.top  = rect.top;
  }

  clear() {
    this.targets.forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    this.targets.clear();
  }

  /* ---------- spawn / remove target ---------- */

  /**
   * t: {
   *   id: number,
   *   emoji: '🥊' | '⭐' | '💣' | ...,
   *   decoy?: boolean,
   *   x?: 0..1, y?: 0..1 (ตำแหน่ง normalized),
   *   scale?: number        (easy ใหญ่ / hard เล็ก)
   * }
   */
  spawnTarget(t) {
    if (!this.host || !t) return;
    this.updateBounds();

    const el = document.createElement('div');
    el.className = 'sb-target' + (t.decoy ? ' sb-target-decoy' : '');
    el.style.width  = this.sizePx + 'px';
    el.style.height = this.sizePx + 'px';
    el.textContent  = t.emoji || '⭐';

    const safeW = Math.max(0, this.bounds.w - this.sizePx);
    const safeH = Math.max(0, this.bounds.h - this.sizePx);

    const nx = (typeof t.x === 'number') ? t.x : Math.random();
    const ny = (typeof t.y === 'number') ? t.y : Math.random();

    const x = nx * safeW;
    const y = ny * safeH;

    el.style.position = 'absolute';
    el.style.left  = '0';
    el.style.top   = '0';

    const scale = t.scale || 1;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;

    el.dataset.id = String(t.id);

    // แตะเป้า → ยิงพิกัดจอเข้า engine.registerTouch
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.engine && typeof this.engine.registerTouch === 'function') {
        this.engine.registerTouch(ev.clientX, ev.clientY, t.id);
      }
    }, { passive: false });

    this.host.appendChild(el);
    this.targets.set(t.id, el);
    t.dom = el;
  }

  removeTarget(t) {
    const id = t && t.id;
    const el = (t && t.dom) || this.targets.get(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (id != null) this.targets.delete(id);
    if (t) t.dom = null;
  }

  /* ---------- hit effect + score popup ---------- */

  /**
   * info: {
   *   miss?:   boolean,
   *   decoy?:  boolean,
   *   fever?:  boolean,
   *   grade?:  'perfect' | 'good' | 'bad' | 'miss' | string,
   *   score?:  number
   * }
   */
  spawnHitEffect(t, info = {}) {
    if (!this.host) return;
    this.updateBounds();

    const baseEl = (t && t.dom) || this.host;
    const rect   = baseEl.getBoundingClientRect();

    // center ในพิกัด host (ให้เด้งตรง emoji)
    const cx = rect.left + rect.width  / 2 - this.bounds.left;
    const cy = rect.top  + rect.height / 2 - this.bounds.top;

    const emojiChar = info.miss
      ? '💨'
      : (info.decoy ? '💣' : (info.fever ? '💥' : '✨'));

    const particle = document.createElement('div');
    particle.className   = 'sb-hit-particle';
    particle.textContent = emojiChar;
    particle.style.left  = cx + 'px';
    particle.style.top   = cy + 'px';

    const label = document.createElement('div');
    label.className = 'sb-hit-score';
    label.style.left = cx + 'px';
    label.style.top  = (cy - 8) + 'px';

    const s = typeof info.score === 'number' ? info.score : 0;

    if (info.miss) {
      label.textContent = 'MISS';
      label.classList.add('sb-score-miss');
    } else if (info.decoy && s <= 0) {
      label.textContent = `BAD  ${s}`;
      label.classList.add('sb-score-bad');
    } else {
      const grade = (info.grade || 'Hit').toUpperCase();
      const sign  = s >= 0 ? '+' : '';
      label.textContent = `${grade}  ${sign}${s}`;
      if (grade === 'PERFECT')      label.classList.add('sb-score-perfect');
      else if (grade === 'GOOD')    label.classList.add('sb-score-good');
      else if (grade === 'BAD')     label.classList.add('sb-score-bad');
    }

    this.host.appendChild(particle);
    this.host.appendChild(label);

    setTimeout(() => {
      if (particle.parentNode) particle.parentNode.removeChild(particle);
      if (label.parentNode)    label.parentNode.removeChild(label);
    }, 450);
  }
}

// default export ด้วย (กันพลาดถ้า engine.js ใช้ import แบบ default)
export default DomRenderer;
