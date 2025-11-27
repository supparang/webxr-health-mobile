// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (2025-12-03) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.wrapEl = opts.wrapEl || document.body;
    this.onTargetHit = opts.onTargetHit || (() => {});

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

  // ---------- SPAWN TARGET ----------

  spawnTarget(target) {
    if (!this.bounds) this._updateBounds();

    const { zone_lr, zone_ud } = target;
    const { nx, ny } = this._pickNormalizedPos(zone_lr, zone_ud);

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
      transition: 'transform .2s ease-out, opacity .2s ease-out',
      boxShadow: '0 18px 35px rgba(15,23,42,0.9)'
    });

    // วงแหวน + พื้นหลัง gradient ให้ดู "นุ่ม ๆ"
    const ring = document.createElement('div');
    ring.className = 'sb-target-ring';
    Object.assign(ring.style, {
      width: '100%',
      height: '100%',
      borderRadius: 'inherit',
      padding: '4px',
      background: 'conic-gradient(from 210deg, rgba(96,165,250,.9), rgba(52,211,153,.9), rgba(244,114,182,.9), rgba(96,165,250,.9))'
    });

    const core = document.createElement('div');
    core.className = 'sb-target-core';
    Object.assign(core.style, {
      width: '100%',
      height: '100%',
      borderRadius: 'inherit',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 30% 20%, #f9fafb, #0f172a)',
      boxShadow: 'inset 0 0 18px rgba(15,23,42,.85)'
    });

    const inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = target.isBomb ? '💣'
      : target.isHeal ? '💚'
      : target.isShield ? '🛡️'
      : target.isDecoy ? '🎯'
      : '🥊';
    Object.assign(inner.style, {
      fontSize: (size * 0.58) + 'px',
      filter: 'drop-shadow(0 4px 6px rgba(15,23,42,.85))'
    });

    core.appendChild(inner);
    ring.appendChild(core);
    el.appendChild(ring);

    const handleClick = (ev) => {
      ev.preventDefault();
      this.onTargetHit(target.id, {
        clientX: ev.clientX,
        clientY: ev.clientY
      });
    };

    el.addEventListener('click', handleClick);
    el.addEventListener('touchstart', (ev) => {
      if (ev.touches && ev.touches[0]) {
        const t = ev.touches[0];
        this.onTargetHit(target.id, { clientX: t.clientX, clientY: t.clientY });
      } else {
        handleClick(ev);
      }
    }, { passive: true });

    this.host.appendChild(el);
    this.targets.set(target.id, el);

    // pop-in นิดหนึ่ง
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  }

  // ---------- REMOVE TARGET ----------

  removeTarget(id, reason) {
    const el = this.targets.get(id);
    if (!el) return;

    if (reason === 'timeout') {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-50%) scale(0.6)';
      setTimeout(() => el.remove(), 160);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  // ---------- FX ----------

  _spawnScoreText(x, y, scoreDelta, grade) {
    if (typeof x !== 'number' || typeof y !== 'number') return;
    if (!scoreDelta && scoreDelta !== 0) return;

    const el = document.createElement('div');
    el.textContent = scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta;
    Object.assign(el.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      transform: 'translate(-50%,-50%) scale(1)',
      fontWeight: '700',
      fontSize: '18px',
      color: grade === 'perfect' ? '#4ade80'
        : grade === 'good' ? '#38bdf8'
        : grade === 'bad' ? '#fb923c'
        : '#e5e7eb',
      textShadow: '0 0 10px rgba(0,0,0,.95)',
      pointerEvents: 'none',
      zIndex: 999,
      opacity: 1,
      transition: 'transform .55s ease-out, opacity .55s ease-out'
    });

    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%,-120%) scale(1.1)';
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 600);
  }

  _spawnParticles(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const n = 10;
    for (let i = 0; i < n; i++) {
      const f = document.createElement('div');
      const size = 6 + Math.random() * 6;
      Object.assign(f.style, {
        position: 'fixed',
        left: x + 'px',
        top: y + 'px',
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

  playHitFx(id, info = {}) {
    const x = info.clientX;
    const y = info.clientY;
    const scoreDelta = info.scoreDelta;
    const grade = info.grade;

    this._spawnParticles(x, y);
    this._spawnScoreText(x, y, scoreDelta, grade);
  }
}
