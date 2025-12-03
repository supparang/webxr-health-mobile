// === /herohealth/vr-groups/fx.js ===
// Food Groups VR — Hit Burst FX (2025-12-05)

(function (ns) {
  'use strict';

  let scene = null;

  function init(sceneEl) {
    scene = sceneEl;
  }

  // ===== helper: random float =====
  function rf(min, max) {
    return Math.random() * (max - min) + min;
  }

  // ===== main burst FX =====
  function burst(worldPos, opts={}) {
    if (!scene || !worldPos) return;

    const isGood = opts.isGood ?? true;

    const colorGood = ['#22c55e', '#86efac', '#ecfccb'];
    const colorBad  = ['#f97316', '#fb923c', '#fed7aa'];

    const colors = isGood ? colorGood : colorBad;

    const count = opts.count || 20;
    const life  = opts.life  || 380;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('a-entity');
      p.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);

      const size = rf(0.06, 0.13);
      p.setAttribute('geometry', `primitive: sphere; radius: ${size}`);
      p.setAttribute('material', `color: ${colors[i % colors.length]}; shader: flat; opacity:0.9`);

      const ang1 = rf(0, Math.PI * 2);
      const ang2 = rf(-0.6, 0.6);
      const spd  = rf(0.6, 1.8);

      const vx = Math.cos(ang1) * Math.cos(ang2) * spd;
      const vy = Math.sin(ang2) * spd * 1.2;
      const vz = Math.sin(ang1) * Math.cos(ang2) * spd;

      // animation flight
      p.setAttribute('animation__move', {
        property: 'position',
        to: `${worldPos.x + vx} ${worldPos.y + vy} ${worldPos.z + vz}`,
        dur: life,
        easing: 'easeOutQuad'
      });

      // fade out
      p.setAttribute('animation__fade', {
        property: 'material.opacity',
        to: 0,
        dur: life,
        easing: 'linear'
      });

      scene.appendChild(p);

      setTimeout(() => {
        if (p && p.parentNode) p.parentNode.removeChild(p);
      }, life + 40);
    }
  }

  ns.foodGroupsFx = { init, burst };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));