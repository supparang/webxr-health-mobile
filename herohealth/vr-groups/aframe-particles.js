// === /herohealth/vr-groups/aframe-particles.js ===
// FX สำหรับ Food Groups VR
// - แตกกระจายรอบ emoji เป้า (3D A-Frame)
// - ยิง DOM FX กลางจอ (คะแนนเด้ง + คำตัดสิน) แบบไม่ทำให้เกมพัง

(function (ns) {
  'use strict';

  const root = window;
  const A = root.AFRAME;

  // แปลง world position -> screen 2D (px) แบบมี try/catch กันเกมพัง
  function worldToScreen(sceneEl, worldPos) {
    try {
      if (!sceneEl || !sceneEl.camera || !A || !A.THREE || !worldPos) {
        return null;
      }

      const width  = root.innerWidth  || 1;
      const height = root.innerHeight || 1;

      const v = new A.THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
      v.project(sceneEl.camera);

      return {
        x: (v.x * 0.5 + 0.5) * width,
        y: (-v.y * 0.5 + 0.5) * height
      };
    } catch (e) {
      // ถ้ามีอะไรผิดพลาด ให้ fallback เป็นกลางจอเฉย ๆ
      const w = root.innerWidth  || 1;
      const h = root.innerHeight || 1;
      return { x: w / 2, y: h / 2 };
    }
  }

  const Fx = {
    scene: null,

    // ให้ GameEngine เรียกตอนเริ่มเกม: GAME_MODULES.foodGroupsFx.init(sceneEl)
    init(sceneEl) {
      this.scene = sceneEl;
    },

    /**
     * ทำ FX แตกกระจายรอบ emoji เป้า
     * @param {Object} worldPos {x,y,z}
     * @param {Object} [opts]   { good, scoreDelta, judgment }
     */
    burst(worldPos, opts) {
      opts = opts || {};
      if (!this.scene || !worldPos) return;

      const sceneEl = this.scene;
      const good = (opts.good !== false); // ถ้าไม่ระบุ = good

      // ---------- 1) 3D shards รอบ emoji เป้า (เหมือนเวอร์ชันที่ใช้ได้ก่อนหน้านี้) ----------
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

      // ---------- 2) DOM FX คะแนนเด้ง + คำตัดสิน ----------
      // ถ้าไฟล์ /herohealth/vr/particles.js ยังไม่โหลด ให้ข้าม ไม่ให้เกมพัง
      if (!root.Particles) return;

      const screen = worldToScreen(sceneEl, worldPos);
      if (!screen) return;

      const P = root.Particles;

      try {
        // เป้าแตก 2D รอบตำแหน่งเป้า
        if (typeof P.burstAt === 'function') {
          P.burstAt(screen.x, screen.y, {
            good: good
          });
        }

        // คะแนนเด้ง + label ตัดสิน
        if (typeof P.scorePop === 'function') {
          const scoreVal =
            (opts.scoreDelta !== undefined && opts.scoreDelta !== null)
              ? String(opts.scoreDelta)
              : (good ? '+10' : '');

          const judgment =
            (opts.judgment && String(opts.judgment)) ||
            (good ? 'GOOD' : 'MISS');

          P.scorePop(screen.x, screen.y, scoreVal, {
            judgment: judgment,
            good: good
          });
        }
      } catch (e) {
        // ถ้ามี error เรื่อง FX DOM ก็ไม่ให้เกมล้ม
        console.warn('[FoodGroupsFX] DOM FX error:', e);
      }
    }
  };

  ns.foodGroupsFx = Fx;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));