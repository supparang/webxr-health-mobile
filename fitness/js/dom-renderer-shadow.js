// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (2025-12-02) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.wrapEl = opts.wrapEl || document.body;
    this.onTargetHit = opts.onTargetHit || null;
    this.targets = new Map();
    this.diffKey = 'normal';
  }

  setDifficulty(key) {
    this.diffKey = key || 'normal';
    if (this.wrapEl) this.wrapEl.dataset.sbDiff = this.diffKey;
  }

  // เลือก emoji ตามประเภทเป้า
  _emojiFor(t) {
    if (t.isBomb || t.type === 'bomb') return '💣';
    if (t.isHeal || t.type === 'heal') return '💚';
    if (t.isShield || t.type === 'shield') return '🛡️';
    if (t.isDecoy || t.type === 'decoy') return '🎯';
    if (t.isBossFace || t.type === 'bossface') return '👊';
    return '🥊';
  }

  // map zone L/R/U/D ให้เป็นตำแหน่งในสนาม
  _positionFor(target) {
    const hostRect = this.host.getBoundingClientRect();
    const lr = target.zone_lr || 'C';
    const ud = target.zone_ud || 'M';

    const xFrac = lr === 'L' ? 0.22 : lr === 'R' ? 0.78 : 0.5;
    const yFrac = ud === 'U' ? 0.27 : ud === 'D' ? 0.80 : 0.55;

    const x = hostRect.left + hostRect.width * xFrac;
    const y = hostRect.top + hostRect.height * yFrac;

    // เก็บ normalized ไว้สำหรับงานวิจัย
    target.x_norm = (x - hostRect.left) / hostRect.width;
    target.y_norm = (y - hostRect.top) / hostRect.height;

    return { x, y };
  }

  // ===== สร้างเป้า (ใช้ sizePx จาก engine + ring effect) =====
  spawnTarget(target) {
    if (!this.host) return;

    const { x, y } = this._positionFor(target);
    const size = target.sizePx || 110;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sb-target sb-target-type-${target.type || 'normal'}`;
    btn.style.width  = size + 'px';
    btn.style.height = size + 'px';
    btn.style.left   = x + 'px';
    btn.style.top    = y + 'px';

    // กำหนดสีวงแหวนตามความยาก + phase
    const baseHue =
      target.diffKey === 'easy'   ? 160 :
      target.diffKey === 'hard'   ? 310 :
                                    210;      // normal
    const phaseShift = ((target.bossPhase || 1) - 1) * 16; // Phase 1–3 ไล่สี
    const hue = baseHue + phaseShift;
    btn.style.setProperty('--sb-ring-hue', String(hue));

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = this._emojiFor(target);
    btn.appendChild(inner);

    const ring = document.createElement('div');
    ring.className = 'sb-target-ring';
    btn.appendChild(ring);

    const hit = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const pt = ev.changedTouches ? ev.changedTouches[0] : ev;
      if (this.onTargetHit) {
        this.onTargetHit(target.id, {
          clientX: pt.clientX,
          clientY: pt.clientY
        });
      }
    };

    btn.addEventListener('click', hit);
    btn.addEventListener('pointerdown', hit);
    btn.addEventListener('touchstart', hit, { passive: false });

    this.host.appendChild(btn);

    // trigger animation ตอนโผล่
    requestAnimationFrame(() => {
      btn.classList.add('sb-target--spawn');
    });

    this.targets.set(target.id, { el: btn, data: target });
  }

  // ลบเป้า (ตอน timeout / โดนตี / จบเกม)
  removeTarget(id, reason) {
    const rec = this.targets.get(id);
    if (!rec || !rec.el) return;
    const el = rec.el;
    this.targets.delete(id);

    if (reason === 'hit') {
      el.classList.add('sb-target--bye');
      setTimeout(() => el.remove(), 240);
    } else if (reason === 'timeout') {
      el.classList.add('sb-target--timeout');
      setTimeout(() => el.remove(), 240);
    } else {
      el.remove();
    }
  }

  // effect ตอนถูกตี (เพิ่ม particle ได้ภายหลัง ถ้าอยากให้แตกกระจาย)
  playHitFx(id, { grade, fxEmoji, clientX, clientY } = {}) {
    // ถ้าต้องการก็สามารถใส่ particle เพิ่มตรงนี้ได้
    // ตอนนี้ปล่อยว่างไว้ ให้ engine จัดการเกรด + score text แล้ว
  }
}

if (typeof window !== 'undefined') {
  window.DomRendererShadow = DomRendererShadow;
}
