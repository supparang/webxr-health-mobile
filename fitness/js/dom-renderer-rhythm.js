// === js/dom-renderer-rhythm.js — Rhythm Boxer Renderer (2025-12-02) ===
'use strict';

(function () {

  class RbDomRenderer {
    constructor(host, opts = {}) {
      this.host = host;
      this.flashEl = opts.flashEl || null;
      this.feedbackEl = opts.feedbackEl || null;
      this.wrapEl = opts.wrapEl || document.body;
    }

    showHitFx({ lane, judgment, songTime, scoreDelta }) {
      const laneEl = this.host.querySelector(`.rb-lane[data-lane="${lane}"]`);
      if (!laneEl) return;
      const rect = laneEl.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.bottom - rect.height * 0.25;

      this.spawnParticle(x, y, judgment);
      this.spawnScore(x, y, scoreDelta, judgment);

      if (this.flashEl) {
        this.flashEl.style.opacity = '0.25';
        setTimeout(() => (this.flashEl.style.opacity = '0'), 100);
      }
    }

    showMissFx({ lane }) {
      const laneEl = this.host.querySelector(`.rb-lane[data-lane="${lane}"]`);
      if (!laneEl) return;
      const rect = laneEl.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.bottom - rect.height * 0.25;
      this.spawnText(x, y, 'MISS', '#ef4444');
    }

    spawnParticle(x, y, judgment) {
      const n = 8;
      for (let i = 0; i < n; i++) {
        const el = document.createElement('div');
        el.className = 'rb-particle';
        const size = 5 + Math.random() * 5;
        const ang = (i / n) * Math.PI * 2;
        const dist = 40 + Math.random() * 20;
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist;

        Object.assign(el.style, {
          left: x + 'px',
          top: y + 'px',
          width: size + 'px',
          height: size + 'px',
          background:
            judgment === 'perfect'
              ? '#4ade80'
              : judgment === 'great'
              ? '#22d3ee'
              : '#facc15',
          borderRadius: '50%',
          opacity: 1,
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 98,
          transform: `translate(${dx}px,${dy}px) scale(0)`
        });

        this.wrapEl.appendChild(el);
        requestAnimationFrame(() => {
          el.style.transition = 'transform .4s ease-out, opacity .4s ease-out';
          el.style.transform = `translate(${dx * 0.5}px,${dy * 0.5}px) scale(1.1)`;
          el.style.opacity = 0;
        });
        setTimeout(() => el.remove(), 450);
      }
    }

    spawnScore(x, y, scoreDelta, judgment) {
      const el = document.createElement('div');
      el.className = 'rb-score-fx';
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
        fontSize: '16px',
        textShadow: '0 0 4px rgba(255,255,255,.6)',
        transform: 'translate(-50%, -50%) scale(1)',
        transition: 'transform .6s ease-out, opacity .6s ease-out',
        pointerEvents: 'none',
        zIndex: 99
      });
      this.wrapEl.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = 'translate(-50%, -100%) scale(1.3)';
        el.style.opacity = 0;
      });
      setTimeout(() => el.remove(), 650);
    }

    spawnText(x, y, text, color) {
      const el = document.createElement('div');
      el.textContent = text;
      Object.assign(el.style, {
        position: 'absolute',
        left: x + 'px',
        top: y + 'px',
        color,
        fontWeight: 'bold',
        fontSize: '16px',
        textShadow: '0 0 6px rgba(255,255,255,.5)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        opacity: 1,
        transition: 'transform .6s ease-out, opacity .6s ease-out',
        zIndex: 100
      });
      this.wrapEl.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = 'translate(-50%, -120%) scale(1.2)';
        el.style.opacity = 0;
      });
      setTimeout(() => el.remove(), 700);
    }
  }

  if (typeof window !== 'undefined') {
    window.RbDomRenderer = RbDomRenderer;
  }

})();
