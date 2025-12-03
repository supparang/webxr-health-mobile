// === /herohealth/vr-groups/fx.js ===
// Particle FX สำหรับ Food Groups VR
// Production Ready — optimized for mobile (Samsung A15 OK)

(function (ns) {
  'use strict';

  const Fx = {};
  let scene;

  //--------------------------------------------------------------------
  // init — เรียกครั้งเดียวจาก GameEngine constructor
  //--------------------------------------------------------------------
  Fx.init = function (sceneEl) {
    scene = sceneEl;
    console.log('[GroupsVR FX] initialized');
  };

  //--------------------------------------------------------------------
  // Helper: สร้าง particle 1 ชิ้น
  //--------------------------------------------------------------------
  function makeParticle(color) {
    const el = document.createElement('a-sphere');
    el.setAttribute('radius', 0.02 + Math.random() * 0.03);
    el.setAttribute('color', color || '#ffffff');
    el.setAttribute('shader', 'flat');
    el.setAttribute('opacity', 0.9);
    return el;
  }

  //--------------------------------------------------------------------
  // burst — เอฟเฟกต์ตอนยิงโดนเป้าหมาย
  //--------------------------------------------------------------------
  Fx.burst = function (worldPos, color = '#ffffff') {
    if (!scene || !worldPos) return;

    const N = 12;                 // particle count (mobile safe)
    const life = 360;             // ms
    const dist = 0.22;            // explosion radius

    for (let i = 0; i < N; i++) {
      const p = makeParticle(color);

      const ang = (Math.PI * 2 * i) / N;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      const dz = (Math.random() - 0.5) * 0.1;

      p.object3D.position.set(worldPos.x, worldPos.y, worldPos.z);
      scene.appendChild(p);

      // Animate particle → ออกห่าง + ละลายหาย
      p.setAttribute('animation__move', {
        property: 'position',
        to: `${worldPos.x + dx} ${worldPos.y + dy} ${worldPos.z + dz}`,
        dur: life,
        easing: 'easeOutQuad'
      });

      p.setAttribute('animation__fade', {
        property: 'opacity',
        to: 0,
        dur: life,
        easing: 'linear'
      });

      // auto remove
      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
      }, life + 50);
    }
  };

  //--------------------------------------------------------------------
  // pop — เวลา spawn target (ring → pop-in)
  //--------------------------------------------------------------------
  Fx.pop = function (el) {
    if (!el) return;
    el.setAttribute('animation__pop', {
      property: 'scale',
      from: '0.001 0.001 0.001',
      to: '1 1 1',
      dur: 180,
      easing: 'easeOutQuad'
    });
  };

  //--------------------------------------------------------------------
  // highlight ring (เป้าภารกิจ)
  //--------------------------------------------------------------------
  Fx.attachQuestRing = function (el, radius) {
    if (!el) return;

    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', radius + 0.05);
    ring.setAttribute('radius-outer', radius + 0.13);
    ring.setAttribute('color', '#facc15');
    ring.setAttribute('shader', 'flat');
    ring.setAttribute('position', '0 0 0.01');
    el.appendChild(ring);
  };

  //--------------------------------------------------------------------
  // score pop — PERFECT / GOOD / MISS เด้งขึ้นตรงตำแหน่งเป้า
  //--------------------------------------------------------------------
  Fx.scorePop = function (worldPos, text, color) {
    if (!scene || !worldPos) return;

    const txt = document.createElement('a-text');
    txt.setAttribute('value', text);
    txt.setAttribute('color', color || '#ffffff');
    txt.setAttribute('align', 'center');
    txt.setAttribute('shader', 'msdf');
    txt.setAttribute('side', 'double');
    txt.setAttribute('scale', '0.6 0.6 0.6');
    txt.object3D.position.set(worldPos.x, worldPos.y, worldPos.z);

    scene.appendChild(txt);

    txt.setAttribute('animation__up', {
      property: 'position',
      to: `${worldPos.x} ${worldPos.y + 0.3} ${worldPos.z}`,
      dur: 420,
      easing: 'easeOutQuad'
    });
    txt.setAttribute('animation__fade', {
      property: 'opacity',
      to: 0,
      dur: 420,
      easing: 'linear'
    });

    setTimeout(() => {
      if (txt.parentNode) txt.parentNode.removeChild(txt);
    }, 450);
  };

  //--------------------------------------------------------------------
  // export
  //--------------------------------------------------------------------
  ns.foodGroupsFx = Fx;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));