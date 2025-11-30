// vr-goodjunk/aframe-particles.js
(function (ns) {
  'use strict';

  const Fx = {
    scene: null,

    init(sceneEl) {
      this.scene = sceneEl;
    },

    burst(worldPos) {
      if (!this.scene || !worldPos || !window.AFRAME) return;

      for (let i = 0; i < 12; i++) {
        const p = document.createElement('a-sphere');
        p.setAttribute('radius', '0.03');
        p.setAttribute('color', '#fde68a');
        p.setAttribute('material', 'opacity: 1; transparent: true');

        const jx = (Math.random() - 0.5) * 0.4;
        const jy = (Math.random() - 0.5) * 0.4;
        const jz = (Math.random() - 0.5) * 0.4;

        p.setAttribute('position',
          `${worldPos.x} ${worldPos.y} ${worldPos.z}`);

        p.setAttribute('animation__move',
          `property: position; to: ${worldPos.x + jx} ${worldPos.y + jy} ${worldPos.z + jz}; dur: 420; easing: ease-out`);
        p.setAttribute('animation__fade',
          'property: material.opacity; to: 0; dur: 420; easing: linear');

        this.scene.appendChild(p);

        setTimeout(() => {
          if (p.parentNode) p.parentNode.removeChild(p);
        }, 500);
      }
    }
  };

  ns.foodGroupsFx = Fx;
})(window.GAME_MODULES);
