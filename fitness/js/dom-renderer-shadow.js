// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (2025-12-02) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host || document.body;
    this.wrapEl = opts.wrapEl || document.body;
    this.onTargetHit = opts.onTargetHit || (() => {});
    this.targets = new Map();
    this.diffKey = 'normal';

    if (getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }
  }

  setDifficulty(key) {
    this.diffKey = key || 'normal';
  }

  // ---------- SPAWN / REMOVE ----------

  spawnTarget(target) {
    if (!this.host) return;

    const el = document.createElement('div');
    el.className = `sb-target sb-${target.type}`;

    const size = target.sizePx || 96;
    el.style.position = 'absolute';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.borderRadius = '999px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = Math.round(size * 0.6) + 'px';
    el.style.userSelect = 'none';
    el.style.touchAction = 'none';
    el.style.boxShadow = '0 0 12px rgba(15,23,42,0.8)';
    el.dataset.targetId = String(target.id);

    // สีพื้นตาม type
    let bg = 'rgba(56,189,248,0.9)';   // normal
    let border = 'rgba(248,250,252,0.9)';
    let emoji = '🎯';

    if (target.isBomb) {
      bg = 'rgba(248,113,113,0.95)';
      border = 'rgba(254,242,242,0.95)';
      emoji = '💣';
    } else if (target.isDecoy) {
      bg = 'rgba(234,179,8,0.9)';
      border = 'rgba(254,249,195,0.95)';
      emoji = '🎭';
    } else if (target.isHeal) {
      bg = 'rgba(34,197,94,0.95)';
      border = 'rgba(220,252,231,0.95)';
      emoji = '💚';
    } else if (target.isShield) {
      bg = 'rgba(56,189,248,0.95)';
      border = 'rgba(224,242,254,0.95)';
      emoji = '🛡️';
    } else if (target.isBossFace) {
      bg = 'rgba(129,140,248,0.98)';
      border = 'rgba(224,231,255,0.98)';
      emoji = '💥';
    }

    el.style.background = bg;
    el.style.border = '2px solid ' + border;
    el.textContent = emoji;

    // ตำแหน่งตาม zone L/C/R, U/M/D
    const rect = this.host.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const zoneX = { L: 0.22, C: 0.5, R: 0.78 };
    const zoneY = { U: 0.23, M: 0.5, D: 0.77 };

    const zx = zoneX[target.zone_lr] ?? 0.5;
    const zy = zoneY[target.zone_ud] ?? 0.5;

    const jitterX = (Math.random() - 0.5) * 0.12;
    const jitterY = (Math.random() - 0.5) * 0.12;

    const xFrac = Math.min(0.9, Math.max(0.1, zx + jitterX));
    const yFrac = Math.min(0.9, Math.max(0.1, zy + jitterY));

    const x = xFrac * w;
    const y = yFrac * h;

    target.x_norm = xFrac;
    target.y_norm = yFrac;

    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'translate(-50%, -50%)';

    const handler = (ev) => {
      ev.preventDefault();
      this.onTargetHit(target.id, {
        clientX: ev.clientX,
        clientY: ev.clientY
      });
    };

    el.addEventListener('pointerdown', handler);
    el.addEventListener('click', handler);
    el.addEventListener('touchstart', handler, { passive: false });

    this.host.appendChild(el);
    this.targets.set(target.id, { el, handler });
  }

  removeTarget(id, reason) {
    const rec = this.targets.get(id);
    if (!rec) return;
    const el = rec.el;

    el.removeEventListener('pointerdown', rec.handler);
    el.removeEventListener('click', rec.handler);
    el.removeEventListener('touchstart', rec.handler);

    if (reason === 'timeout') {
      el.style.transition = 'transform .25s ease-out, opacity .25s ease-out';
      el.style.transform += ' scale(0.7)';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 260);
    } else {
      el.remove();
    }

    this.targets.delete(id);
  }

  playHitFx(id, info) {
    const rec = this.targets.get(id);
    let x = info?.clientX;
    let y = info?.clientY;

    if ((!x || !y) && rec?.el) {
      const r = rec.el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }

    if (info.scoreDelta > 0) {
      this.showHitFx({
        x,
        y,
        scoreDelta: info.scoreDelta,
        lane: 0,
        judgment: info.grade
      });
    } else if (info.grade === 'miss' || info.grade === 'bomb') {
      this.showMissFx({ x, y });
    }
  }

  // ---------- FX helpers ----------

  showHitFx({ x, y, scoreDelta, lane, judgment }) {
    this.spawnHitParticle(x, y, judgment);
    this.spawnScoreText(x, y, scoreDelta, judgment);
  }

  showMissFx({ x, y }) {
    this.spawnMissParticle(x, y);
  }

  spawnHitParticle(x, y, judgment) {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'sb-frag';
      const size = 6 + Math.random() * 6;
      const ang = (i / n) * Math.PI * 2;
      const dist = 60 + Math.random() * 40;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;

      Object.assign(el.style, {
        left: x + 'px',
        top: y + 'px',
        width: size + 'px',
        height: size + 'px',
        background: judgment === 'perfect' ? '#22d3ee' : '#facc15',
        transform: `translate(${dx}px,${dy}px) scale(0)`,
        opacity: 1,
        position: 'fixed',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 9999
      });

      this.wrapEl.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transition = 'transform .5s ease-out, opacity .5s ease-out';
        el.style.transform = `translate(${dx * 0.5}px,${dy * 0.5}px) scale(1.2)`;
        el.style.opacity = 0;
      });
      setTimeout(() => el.remove(), 550);
    }
  }

  spawnScoreText(x, y, scoreDelta, judgment) {
    const el = document.createElement('div');
    el.className = 'sb-score-fx';
    el.textContent = `+${scoreDelta}`;
    const color =
      judgment === 'perfect'
        ? '#4ade80'
        : judgment === 'good'
        ? '#22d3ee'
        : '#facc15';
    Object.assign(el.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      color,
      fontWeight: 'bold',
      fontSize: '18px',
      textShadow: '0 0 6px rgba(255,255,255,0.8)',
      transform: 'translate(-50%, -50%) scale(1)',
      transition: 'transform .6s ease-out, opacity .6s ease-out',
      pointerEvents: 'none',
      zIndex: 10000
    });
    this.wrapEl.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -120%) scale(1.4)';
      el.style.opacity = 0;
    });
    setTimeout(() => el.remove(), 650);
  }

  spawnMissParticle(x, y) {
    const el = document.createElement('div');
    el.className = 'sb-miss';
    el.textContent = 'MISS';
    Object.assign(el.style, {
      position: 'fixed',
      left: x + 'px',
      top: y + 'px',
      color: '#ef4444',
      fontWeight: 'bold',
      textShadow: '0 0 8px rgba(239,68,68,.8)',
      transform: 'translate(-50%, -50%) scale(1)',
      transition: 'transform .6s ease-out, opacity .6s ease-out',
      pointerEvents: 'none',
      zIndex: 10000
    });
    this.wrapEl.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -120%) scale(1.4)';
      el.style.opacity = 0;
    });
    setTimeout(() => el.remove(), 650);
  }
}

if (typeof window !== 'undefined') {
  window.DomRendererShadow = DomRendererShadow;
}