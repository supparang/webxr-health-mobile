// === /herohealth/vr-groups/fx.js ===
// เอฟเฟกต์แตกกระจายง่าย ๆ สำหรับ Food Groups VR
// ใช้ชื่อ namespace: GAME_MODULES.foodGroupsFx

(function (ns) {
  'use strict';

  let sceneRef = null;

  function init(sceneEl) {
    sceneRef = sceneEl || sceneRef || document.querySelector('a-scene');
  }

  function burst(worldPos) {
    if (!sceneRef || !sceneRef.object3D || !window.AFRAME || !window.THREE) return;
    if (!worldPos) return;

    const n = 14;
    const base = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

    for (let i = 0; i < n; i++) {
      const frag = document.createElement('a-entity');
      const size = 0.06 + Math.random() * 0.06;

      frag.setAttribute('geometry', `primitive: sphere; radius: ${size}`);
      frag.setAttribute(
        'material',
        'color: #facc15; shader: flat; metalness:0; roughness:1'
      );
      frag.setAttribute('position', `${base.x} ${base.y} ${base.z}`);

      const dx = (Math.random() - 0.5) * 1.4;
      const dy = Math.random() * 1.2 + 0.4;
      const dz = (Math.random() - 0.5) * 1.4;

      const dur = 380 + Math.random() * 220;

      frag.setAttribute(
        'animation__move',
        `property: position; to: ${base.x + dx} ${base.y + dy} ${base.z + dz}; dur: ${dur}; easing: easeOutQuad`
      );
      frag.setAttribute(
        'animation__fade',
        `property: material.opacity; from: 1; to: 0; dur: ${dur}; easing: linear`
      );

      sceneRef.appendChild(frag);

      setTimeout(function () {
        if (frag && frag.parentNode) frag.parentNode.removeChild(frag);
      }, dur + 80);
    }
  }

  ns.foodGroupsFx = {
    init,
    burst
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
