// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (2025-12-02) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.wrapEl = opts.wrapEl || document.body;
    this.onTargetHit = opts.onTargetHit || (() => {});

    // ให้ host เป็นตำแหน่งอ้างอิง
    const style = window.getComputedStyle(this.host);
    if (style.position === 'static' || !style.position) {
      this.host.style.position = 'relative';
    }

    this.targets = new Map();
    this.diffKey = 'normal';

    window.addEventListener('resize', () => this._updateBounds());
    this._updateBounds();
  }

  setDifficulty(diffKey) {
    this.diffKey = diffKey || 'normal';
  }

  _updateBounds() {
    if (!this.host) return;
    const r = this.host.getBoundingClientRect();
    this.bounds = {
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height
    };
  }

  // แปลง zone L/C/R, U/M/D → ตำแหน่งภายในกรอบ playfield เป็นสัดส่วน 0–1
  _pickNormalizedPos(zoneLR, zoneUD) {
    const lrRanges = {
      L: [0.16, 0.38],
      C: [0.40, 0.60],
      R: [0.62, 0.86]
    };
    const udRanges = {
      U: [0.22, 0.38],
      M: [0.42, 0.62],
      D: [0.66, 0.82]
    };

    const [lx1, lx2] = lrRanges[zoneLR] || lrRanges.C;
    const [uy1, uy2] = udRanges[zoneUD] || udRanges.M;

    const nx = lx1 + Math.random() * (lx2 - lx1);
    const ny = uy1 + Math.random() * (uy2 - uy1);

    return { nx, ny };
  }

  // ---------- SPAWN ----------

  spawnTarget(target) {
    if (!this.bounds) this._updateBounds();
    const { zone_lr, zone_ud } = target;

    const { nx, ny } = this._pickNormalizedPos(zone_lr, zone_ud);
    // เก็บกลับไปใน target เพื่อใช้ใน CSV
    target.x_norm = nx;
    target.y_norm = ny;

    const size = target.sizePx || 110;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = [
      'sb-target',
      `sb-target-${target.type || 'normal'}`,
      `sb-diff-${this.diffKey}`,
      `sb-boss-${target.bossIndex ?? 0}`,
      `sb-phase-${target.bossPhase ?? 1}`
    ].join(' ');

    Object.assign(el.style, {
      position: 'absolute',
      left: (nx * 100) + '%',
      top: (ny * 100) + '%',
      width: size + 'px',
      height: size + 'px',
      transform: 'translate(-50%,-50%) scale(0.7)',
      borderRadius: '999px',
      border: 'none',
      padding: '0',
      cursor: 'pointer',
      opacity: '0',
      transition: 'transform .2s ease-out, opacity .2s ease-out'
    });

    // วงแหวน + emoji ภายในเป้า (เผื่อไปตกแต่งต่อ)
    const ring = document.createElement('div');
    ring.className = 'sb-target-ring';
    ring.style.width = '100%';
    ring.style.height = '100%';
    ring.style.borderRadius = 'inherit';
    ring.style.display = 'flex';
    ring.style.alignItems = 'center';
    ring.style.justifyContent = 'center';

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = target.isBomb ? '💣'
      : target.isHeal ? '💚'
      : target.isShield ? '🛡️'
      : target.isDecoy ? '🎯'
      : '🥊';

    ring.appendChild(inner);
    el.appendChild(ring);

    const handleHit = (ev) => {
      ev.preventDefault();
      const info = {
        clientX: ev.clientX,
        clientY: ev.clientY
      };
      this.onTargetHit(target.id, info);
    };

    el.addEventListener('click', handleHit);
    el.addEventListener('touchstart', (ev) => {
      if (ev.touches && ev.touches[0]) {
        const t = ev.touches[0];
        this.onTargetHit(target.id, { clientX: t.clientX, clientY: t.clientY });
      } else {
        handleHit(ev);
      }
    }, { passive: true });

    this.host.appendChild(el);
    this.targets.set(target.id, el);

    // pop-in effect เวลาโผล่
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  }

  // ---------- REMOVE ----------

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;

    if (reason === 'timeout') {
      // fade out ตอนหมดเวลา
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(0.6)';
      setTimeout(() => el.remove(), 160);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  // ---------- FX ----------

  playHitFx(id, info) {
    this.showHitFx(info || {});
    // ถ้าต้องการ effect เพิ่ม สามารถต่อจากตรงนี้ได้
  }

  showHitFx({ clientX, clientY }) {
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return;

    const fragCount = 10;
    for (let i = 0; i < fragCount; i++) {
      const f = document.createElement('div');
      f.className = 'sb-frag';
      const size = 6 + Math.random() * 6;
      Object.assign(f.style, {
        position: 'fixed',
        left: clientX + 'px',
        top: clientY + 'px',
        width: size + 'px',
        height: size + 'px',
        borderRadius: '999px',
        background: 'rgba(248,250,252,.95)',
        pointerEvents: 'none',
        zIndex: 999,
        opacity: '1',
        transform: 'translate(-50%,-50%)',
        transition: 'transform .4s ease-out, opacity .4s ease-out'
      });

      document.body.appendChild(f);

      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const tx = Math.cos(ang) * dist;
      const ty = Math.sin(ang) * dist;

      requestAnimationFrame(() => {
        f.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`;
        f.style.opacity = '0';
      });

      setTimeout(() => f.remove(), 420);
    }
  }
}
