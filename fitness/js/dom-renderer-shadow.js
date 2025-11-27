// === js/dom-renderer-shadow.js — Shadow Breaker Renderer (FX only, 2025-12-02) ===
'use strict';

export class DomRendererShadow {
  constructor(host, opts = {}) {
    this.host = host;
    this.flashEl = opts.flashEl || null;
    this.feedbackEl = opts.feedbackEl || null;
    this.wrapEl = opts.wrapEl || document.body;
  }

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
        position: 'absolute',
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: 99
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
        : judgment === 'great'
        ? '#22d3ee'
        : '#facc15';
    Object.assign(el.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      color,
      fontWeight: 'bold',
      fontSize: '18px',
      textShadow: '0 0 6px rgba(255,255,255,0.8)',
      transform: 'translate(-50%, -50%) scale(1)',
      transition: 'transform .6s ease-out, opacity .6s ease-out',
      pointerEvents: 'none',
      zIndex: 100
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
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      color: '#ef4444',
      fontWeight: 'bold',
      textShadow: '0 0 8px rgba(239,68,68,.8)',
      transform: 'translate(-50%, -50%) scale(1)',
      transition: 'transform .6s ease-out, opacity .6s ease-out',
      pointerEvents: 'none',
      zIndex: 100
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