// === vr-groups/fx.js (2025-12-03 Production Ready) ===
// เอฟเฟกต์เป้าแตก, คะแนนเด้ง, และ miss FX
// ใช้ DOM ล้วน เพื่อทำงานบน A15 / MobileVR ได้เร็วกว่า A-Frame particle

(function (ns) {
  'use strict';

  const FX_ROOT_ID = 'fg-fx-root';
  let root = null;

  function ensureRoot() {
    if (root && root.isConnected) return root;

    root = document.createElement('div');
    root.id = FX_ROOT_ID;
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '100vw';
    root.style.height = '100vh';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '700';     // สูงกว่า HUD นิดหน่อย
    document.body.appendChild(root);
    return root;
  }

  // ------------------------------------------------------------
  // แปลงตำแหน่ง world → screen
  // ------------------------------------------------------------
  function worldToScreen(pos) {
    const scene = document.querySelector('a-scene');
    if (!scene) return { x: window.innerWidth/2, y: window.innerHeight/2 };

    const camera = scene.camera;
    if (!camera) return { x: window.innerWidth/2, y: window.innerHeight/2 };

    const vector = new THREE.Vector3(pos.x, pos.y, pos.z);
    vector.project(camera);

    return {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth,
      y: (-vector.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  // ------------------------------------------------------------
  // Hit particle: emoji แตกกระจาย 8 ชิ้น
  // ------------------------------------------------------------
  function spawnBurst(emoji, pos) {
    ensureRoot();
    const p = worldToScreen(pos);

    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.textContent = emoji;
      el.style.position = 'fixed';
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.fontSize = '22px';
      el.style.opacity = '1';
      el.style.transition = 'transform .45s ease-out, opacity .45s ease-out';
      root.appendChild(el);

      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 40;

      setTimeout(() => {
        el.style.transform =
          `translate(${Math.cos(ang)*dist}px, ${Math.sin(ang)*dist}px) scale(0.6)`;
        el.style.opacity = '0';
      }, 10);

      setTimeout(() => el.remove(), 500);
    }
  }

  // ------------------------------------------------------------
  // คะแนนเด้งตรงจุดที่ยิงโดน
  // ------------------------------------------------------------
  function spawnScore(scoreDelta, pos, judgment = 'good') {
    ensureRoot();
    const p = worldToScreen(pos);

    const el = document.createElement('div');
    el.textContent = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
    el.style.position = 'fixed';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.fontSize = '20px';
    el.style.fontWeight = '700';
    el.style.opacity = '1';

    if (judgment === 'perfect') el.style.color = '#facc15';
    else if (judgment === 'good') el.style.color = '#34d399';
    else el.style.color = '#f87171';

    el.style.transition =
      'transform .55s ease-out, opacity .55s ease-out';

    root.appendChild(el);

    setTimeout(() => {
      el.style.transform = 'translate(-50%,-70px)';
      el.style.opacity = '0';
    }, 10);

    setTimeout(() => el.remove(), 600);
  }

  // ------------------------------------------------------------
  // Miss effect (จุดแดงเล็ก ๆ แสดงตำแหน่ง miss)
  // ------------------------------------------------------------
  function spawnMiss(pos) {
    ensureRoot();
    const p = worldToScreen(pos);

    const el = document.createElement('div');
    el.textContent = '✖';
    el.style.position = 'fixed';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.transform = 'translate(-50%, -50%) scale(1)';
    el.style.fontSize = '20px';
    el.style.color = '#f87171';
    el.style.opacity = '1';
    el.style.transition = 'transform .45s ease-out, opacity .45s ease-out';

    root.appendChild(el);

    setTimeout(() => {
      el.style.transform = 'translate(-50%, -50%) scale(0.3)';
      el.style.opacity = '0';
    }, 10);

    setTimeout(() => el.remove(), 450);
  }

  // ------------------------------------------------------------
  // API ส่งกลับให้ GameEngine.js ใช้
  // ------------------------------------------------------------
  ns.foodGroupsFX = {
    spawnBurst,
    spawnScore,
    spawnMiss
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));