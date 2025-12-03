// === vr-groups/fx.js (2025-12-03 Production Ready) ===
// เอฟเฟกต์ภาพสำหรับ Food Groups VR
// ใช้ร่วมกับ A-Frame + THREE ได้ทันที

(function (ns) {
  'use strict';

  const Fx = {};

  // ------------------------------------------------------
  // INTERNAL: สร้าง particle 1 ชิ้น
  // ------------------------------------------------------
  function createParticle(color, life = 380) {
    const el = document.createElement('a-sphere');
    el.setAttribute('radius', '0.02');
    el.setAttribute('segments-height', '8');
    el.setAttribute('segments-width', '8');
    el.setAttribute('color', color);
    el.setAttribute('opacity', '0.95');
    el.setAttribute('shader', 'flat');
    el.setAttribute('scale', '1 1 1');

    // ละลายหาย
    el.setAttribute('animation__fade', {
      property: 'opacity',
      to: 0,
      dur: life,
      easing: 'easeOutQuad'
    });
    return el;
  }

  // ------------------------------------------------------
  // INTERNAL: ยิง particle ออกหลายทิศทาง
  // ------------------------------------------------------
  function spawnBurstParticles(scene, wp, color) {
    const NUM = 10 + Math.floor(Math.random() * 6); // 10–15 ชิ้น
    for (let i = 0; i < NUM; i++) {
      const p = createParticle(color);
      const dx = (Math.random() - 0.5) * 0.8;
      const dy = (Math.random() - 0.5) * 0.8;
      const dz = (Math.random() - 0.5) * 0.8;
      const dist = 0.18 + Math.random() * 0.2;

      p.object3D.position.set(wp.x, wp.y, wp.z);

      p.setAttribute('animation__move', {
        property: 'position',
        to: `${wp.x + dx * dist} ${wp.y + dy * dist} ${wp.z + dz * dist}`,
        dur: 300,
        easing: 'easeOutCubic'
      });

      scene.appendChild(p);

      // auto remove
      setTimeout(() => p.remove(), 420);
    }
  }

  // ------------------------------------------------------
  // Hit effect — แตกกระจายแบบน่ารัก ๆ
  // ------------------------------------------------------
  Fx.burst = function (wp, isGood = true) {
    const scene = document.querySelector('a-scene');
    if (!scene || !wp) return;

    const color = isGood ? '#22c55e' : '#ef4444';
    spawnBurstParticles(scene, wp, color);
  };

  // ------------------------------------------------------
  // Miss effect — ฟุ้งเบา ๆ
  // ------------------------------------------------------
  Fx.miss = function (wp) {
    const scene = document.querySelector('a-scene');
    if (!scene || !wp) return;

    const NUM = 6;
    const color = '#9ca3af';

    for (let i = 0; i < NUM; i++) {
      const p = createParticle(color, 300);
      const dx = (Math.random() - 0.5) * 0.3;
      const dy = (Math.random() - 0.5) * 0.3;
      const dz = (Math.random() - 0.5) * 0.3;
      const dist = 0.12 + Math.random() * 0.1;

      p.object3D.position.set(wp.x, wp.y, wp.z);
      p.setAttribute('animation__move', {
        property: 'position',
        to: `${wp.x + dx * dist} ${wp.y + dy * dist} ${wp.z + dz * dist}`,
        dur: 240,
        easing: 'easeOutQuad'
      });

      scene.appendChild(p);
      setTimeout(() => p.remove(), 300);
    }
  };

  // ------------------------------------------------------
  // API ใช้จาก GameEngine.js
  // ------------------------------------------------------
  ns.foodGroupsFx = Fx;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));