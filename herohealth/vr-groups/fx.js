// === /herohealth/vr-groups/fx.js ===
// Food Groups VR — Particle / Burst FX
// Production Ready (2025-12-05)

(function (ns) {
  'use strict';

  let scene = null;

  function init(sceneEl) {
    scene = sceneEl;
  }

  /**
   * Burst effect — เป้าแตกกระจายเป็น 12 ชิ้น + มี score pop
   * pos = THREE.Vector3 { x, y, z }
   */
  function burst(pos) {
    if (!scene || !pos) return;

    // จำนวนเศษกระจาย
    const N = 12;

    for (let i = 0; i < N; i++) {
      const frag = document.createElement('a-sphere');
      const size = 0.03 + Math.random() * 0.025;
      const dist = 0.22 + Math.random() * 0.32;
      const ang = (Math.PI * 2 * i) / N + Math.random() * 0.5;

      frag.setAttribute('radius', size.toFixed(3));
      frag.setAttribute('color', randomColor());
      
      frag.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
      frag.setAttribute('material', 'shader: flat; opacity: 0.9; transparent: true');

      scene.appendChild(frag);

      // animation — ลอยออก + หาย
      frag.setAttribute(
        'animation__move',
        `
        property: position;
        to: ${pos.x + Math.cos(ang) * dist} ${pos.y + (Math.random() * .35)} ${pos.z + Math.sin(ang) * dist};
        dur: 380;
        easing: easeOutQuad
        `
      );
      frag.setAttribute(
        'animation__fade',
        'property: material.opacity; to: 0; dur: 420; delay: 80'
      );

      setTimeout(() => frag.remove(), 550);
    }
  }

  /** Random soft color */
  function randomColor() {
    const colors = [
      '#facc15', // yellow
      '#4ade80', // green
      '#60a5fa', // blue
      '#f87171', // salmon red
      '#a78bfa', // purple
      '#fbbf24'  // amber
    ];
    return colors[(Math.random() * colors.length) | 0];
  }

  /**
   * score pop 2D overlay (optional) — เรียกตรงจาก UI แล้ว ไม่ใส่ใน burst
   * แต่ทำ helper ไว้ให้ GameEngine เรียกได้ถ้าอยากเพิ่ม
   */
  function scorePop(scoreDelta) {
    const el = document.createElement('div');
    el.textContent = (scoreDelta >= 0 ? '+' : '') + scoreDelta;
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.color = scoreDelta >= 0 ? '#4ade80' : '#f87171';
    el.style.fontSize = '26px';
    el.style.fontWeight = '700';
    el.style.opacity = '1';
    el.style.pointerEvents = 'none';
    el.style.transition = 'all .35s ease-out';
    el.style.zIndex = '970';
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = 'translate(-50%, -60%)';
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), 400);
  }

  ns.foodGroupsFx = {
    init,
    burst,
    scorePop
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));