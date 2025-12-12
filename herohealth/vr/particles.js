// === /herohealth/vr-groups/aframe-particles.js ===
// FX สำหรับ Food Groups VR
// - แตกกระจายใน A-Frame รอบ emoji เป้า
// - ยิง DOM FX ตรงตำแหน่งเป้า (คะแนนเด้ง + คำตัดสิน)

(function (ns, root) {
  'use strict';

  const A = root.AFRAME;

  // แปลง world position -> screen 2D (px)
  function worldToScreen(sceneEl, worldPos) {
    if (!sceneEl || !sceneEl.camera || !A || !A.THREE || !worldPos) return null;

    const width  = root.innerWidth  || 1;
    const height = root.innerHeight || 1;

    const v = new A.THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    v.project(sceneEl.camera);

    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height
    };
  }

  const Fx = {
    scene: null,

    // เรียกจาก GameEngine ตอนเริ่มเกม
    init(sceneEl) {
      this.scene = sceneEl;
    },

    /**
     * ทำ FX แตกกระจายรอบ emoji เป้า
     * @param {Object} worldPos {x,y,z} ใน world space
     * @param {Object} [opts]   { good, scoreDelta, judgment }
     *   - good: true = ของดี / perfect, false = ของไม่ดี
     *   - scoreDelta: คะแนนที่อยากให้เด้งโชว์ เช่น "+40"
     *   - judgment: ข้อความตัดสิน เช่น "GOOD" "PERFECT" "MISS"
     */
    burst(worldPos, opts) {
      opts = opts || {};
      if (!this.scene || !worldPos || !A) return;

      const sceneEl = this.scene;
      const good = (opts.good !== false); // ถ้าไม่ส่งมา ถือว่า good

      // ---------- 1) 3D shards รอบ emoji เป้า ----------
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('a-sphere');
        p.setAttribute('radius', '0.03');
        p.setAttribute('color', good ? '#bbf7d0' : '#fed7aa'); // เขียวอ่อน / ส้มอ่อน
        p.setAttribute('material', 'opacity: 1; transparent: true');

        const jx = (Math.random() - 0.5) * 0.4;
        const jy = (Math.random() - 0.5) * 0.4;
        const jz = (Math.random() - 0.5) * 0.4;

        p.setAttribute(
          'position',
          `${worldPos.x} ${worldPos.y} ${worldPos.z}`
        );

        p.setAttribute(
          'animation__move',
          `property: position; to: ${worldPos.x + jx} ${worldPos.y + jy} ${worldPos.z + jz}; dur: 420; easing: easeOutQuad`
        );
        p.setAttribute(
          'animation__fade',
          'property: material.opacity; to: 0; dur: 420; easing: linear'
        );

        sceneEl.appendChild(p);

        setTimeout(() => {
          if (p.parentNode) p.parentNode.removeChild(p);
        }, 500);
      }

      // ---------- 2) DOM FX (คะแนนเด้ง + คำตัดสินตรง emoji) ----------
      const screen = worldToScreen(sceneEl, worldPos);
      if (!screen || !root.Particles) return;

      const P = root.Particles;

      // เป้าแตกแบบ 2D รอบ ๆ จุดที่ตี
      if (typeof P.burstAt === 'function') {
        P.burstAt(screen.x, screen.y, {
          good: good
        });
      }

      // คะแนนเด้ง + label ตัดสิน (GOOD / PERFECT / MISS ฯลฯ)
      if (typeof P.scorePop === 'function') {
        const scoreVal =
          (opts.scoreDelta !== undefined && opts.scoreDelta !== null)
            ? String(opts.scoreDelta)
            : (good ? '+10' : ''); // default ถ้าไม่ได้ส่งมา

        const judgment =
          (opts.judgment && String(opts.judgment)) ||
          (good ? 'GOOD' : 'MISS');

        P.scorePop(screen.x, screen.y, scoreVal, {
          judgment: judgment,
          good: good
        });
      }
    }
  };

  ns.foodGroupsFx = Fx;
})(window.GAME_MODULES || (window.GAME_MODULES = {}), window);