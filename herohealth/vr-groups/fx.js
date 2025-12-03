// === /herohealth/vr-groups/fx.js ===
// FX ระบบเอฟเฟกต์ทั้งหมดของ Food Groups VR
// 2025-12-05

(function (ns) {
  'use strict';

  // -----------------------------------------------------
  // Utility
  // -----------------------------------------------------
  function makeParticle(color, size, life) {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.width = size + 'px';
    div.style.height = size + 'px';
    div.style.background = color;
    div.style.borderRadius = '999px';
    div.style.zIndex = 9999;
    div.style.opacity = '0.9';
    div.style.pointerEvents = 'none';
    div.style.transition = `transform ${life}ms ease-out, opacity ${life}ms ease-out`;
    return div;
  }

  function worldToScreen(obj3D, renderer) {
    if (!window.THREE || !obj3D) return null;
    const vec = new THREE.Vector3();
    const canvas = renderer?.domElement;
    if (!canvas) return null;

    obj3D.getWorldPosition(vec);
    vec.project(window.GAME_MODULES.camera);

    return {
      x: (vec.x * 0.5 + 0.5) * canvas.clientWidth,
      y: (-vec.y * 0.5 + 0.5) * canvas.clientHeight
    };
  }

  // -----------------------------------------------------
  // เป้าแตก (hit FX)
  // -----------------------------------------------------
  function burstAt(x, y, emoji = '✨') {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.textContent = emoji;
      span.style.position = 'fixed';
      span.style.left = x + 'px';
      span.style.top = y + 'px';
      span.style.fontSize = '18px';
      span.style.zIndex = 2000;
      span.style.pointerEvents = 'none';
      document.body.appendChild(span);

      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 20;
      const tx = x + Math.cos(ang) * dist;
      const ty = y + Math.sin(ang) * dist;

      span.animate(
        [
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${tx - x}px,${ty - y}px)`, opacity: 0 }
        ],
        { duration: 450 + Math.random() * 180, easing: 'ease-out' }
      ).onfinish = () => span.remove();
    }
  }

  // -----------------------------------------------------
  // MISS FX
  // -----------------------------------------------------
  function fxMiss(x, y) {
    const span = document.createElement('span');
    span.textContent = '💨';
    span.style.position = 'fixed';
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    span.style.fontSize = '26px';
    span.style.opacity = '0.9';
    span.style.zIndex = 2000;
    span.style.pointerEvents = 'none';
    document.body.appendChild(span);

    span.animate(
      [
        { transform: 'translateY(0px)', opacity: 1 },
        { transform: 'translateY(-40px)', opacity: 0 }
      ],
      { duration: 550, easing: 'ease-out' }
    ).onfinish = () => span.remove();
  }

  // -----------------------------------------------------
  // Mission Clear FX
  // -----------------------------------------------------
  function makeMissionToast(text, color) {
    const box = document.createElement('div');
    box.textContent = text;
    box.style.position = 'fixed';
    box.style.left = '50%';
    box.style.top = '22%';
    box.style.transform = 'translateX(-50%)';
    box.style.padding = '10px 16px';
    box.style.fontSize = '18px';
    box.style.fontWeight = '700';
    box.style.background = 'rgba(0,0,0,0.75)';
    box.style.borderRadius = '12px';
    box.style.border = `1px solid ${color}`;
    box.style.color = color;
    box.style.zIndex = 3000;
    box.style.opacity = '0';
    document.body.appendChild(box);

    box.animate(
      [
        { opacity: 0, transform: 'translate(-50%, -10px)' },
        { opacity: 1, transform: 'translate(-50%, 0px)' },
        { opacity: 0, transform: 'translate(-50%, 10px)' }
      ],
      { duration: 1500, easing: 'ease-out' }
    ).onfinish = () => box.remove();
  }

  function fxMissionClear() {
    makeMissionToast('🎉 Mission Complete!', '#facc15');
  }

  function fxMiniClear() {
    makeMissionToast('✨ Mini Quest Cleared!', '#38bdf8');
  }

  // -----------------------------------------------------
  // Event Hooks
  // -----------------------------------------------------
  function init() {
    // เมื่อยิงโดน (GameEngine.js ต้อง dispatch event นี้)
    window.addEventListener('fg-hit', (ev) => {
      const { x, y, emoji } = ev.detail || {};
      burstAt(x, y, emoji || '✨');
    });

    // MISS
    window.addEventListener('fg-miss', (ev) => {
      const { x, y } = ev.detail || {};
      fxMiss(x, y);
    });

    // mission clear
    window.addEventListener('fg-mission-clear', () => fxMissionClear());
    window.addEventListener('fg-mini-clear', () => fxMiniClear());
  }

  ns.foodGroupsFx = {
    init,
    burst: burstAt,
    miss: fxMiss,
    missionClear: fxMissionClear,
    miniClear: fxMiniClear
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));