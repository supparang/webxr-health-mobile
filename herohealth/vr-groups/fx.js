// === /herohealth/vr-groups/fx.js ===
// Particle FX + Floating Score สำหรับ Food Groups VR
// Production Ready 2025-12-05

(function (ns) {
  'use strict';

  let root = null;

  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'fg-fx-root';
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '620';
    document.body.appendChild(root);
    return root;
  }

  // --------------------------
  // Floating Score ( +10 / -5 )
  // --------------------------
  function floatScore(x, y, scoreDelta) {
    ensureRoot();

    const el = document.createElement('div');
    el.className = 'fg-float-score';
    el.textContent = (scoreDelta > 0 ? '+' : '') + scoreDelta;

    el.style.position = 'absolute';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.fontSize = '24px';
    el.style.fontWeight = '700';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.color = scoreDelta > 0 ? '#4ade80' : '#f87171';
    el.style.opacity = '1';
    el.style.transition = 'all 0.65s ease-out';

    root.appendChild(el);

    requestAnimationFrame(() => {
      el.style.top = (y - 60) + 'px';
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 700);
  }

  // --------------------------
  // Particle ระเบิดตอนโดนเป้า
  // --------------------------
  function spawnHitFx(x, y) {
    ensureRoot();

    const n = 12;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'fg-hit-frag';

      const size = 6 + Math.random() * 6;
      p.style.position = 'absolute';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = '#facc15';
      p.style.borderRadius = '999px';
      p.style.opacity = '1';
      p.style.transition = 'transform 0.55s ease-out, opacity 0.55s ease-out';

      root.appendChild(p);

      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;
      const tx = Math.cos(ang) * dist;
      const ty = Math.sin(ang) * dist;

      requestAnimationFrame(() => {
        p.style.transform = `translate(${tx}px, ${ty}px) scale(0.4)`;
        p.style.opacity = '0';
      });

      setTimeout(() => p.remove(), 600);
    }
  }

  // --------------------------
  // MISS particle (สีแดง)
  // --------------------------
  function spawnMissFx(x, y) {
    ensureRoot();

    const n = 10;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      p.className = 'fg-miss-frag';

      const size = 5 + Math.random() * 5;
      p.style.position = 'absolute';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = '#ef4444';
      p.style.borderRadius = '999px';
      p.style.opacity = '1';
      p.style.transition = 'transform 0.55s ease-out, opacity 0.55s ease-out';

      root.appendChild(p);

      const ang = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 25;
      const tx = Math.cos(ang) * dist;
      const ty = Math.sin(ang) * dist;

      requestAnimationFrame(() => {
        p.style.transform = `translate(${tx}px, ${ty}px) scale(0.4)`;
        p.style.opacity = '0';
      });

      setTimeout(() => p.remove(), 600);
    }
  }

  // --------------------------
  // Export
  // --------------------------
  ns.foodGroupsFx = {
    spawnHitFx,
    spawnMissFx,
    floatScore
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));