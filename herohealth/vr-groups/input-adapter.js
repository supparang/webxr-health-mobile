// vr-groups/input-adapter.js
// รวม input: เมาส์ (PC) + ทัช (Mobile) + Trigger (VR)
// แล้วไปยิง click ใส่เป้า data-hha-tgt

(function (ns) {
  'use strict';

  AFRAME.registerComponent('fg-input-adapter', {
    init: function () {
      const scene    = this.el;
      const cursor   = document.querySelector('#cursor');
      const hand     = document.querySelector('#rightHand');

      let activeRaycaster = null;

      function pickActiveRaycaster() {
        // ถ้าอยู่ในโหมด VR: ให้ controller สำคัญสุด
        if (scene.is('vr-mode') && hand && hand.components.raycaster) {
          activeRaycaster = hand;
        } else {
          // ปกติ: ใช้ cursor กลางจอ
          activeRaycaster = cursor;
        }
      }

      pickActiveRaycaster();
      scene.addEventListener('enter-vr', pickActiveRaycaster);
      scene.addEventListener('exit-vr', pickActiveRaycaster);

      function findTargetFromRaycaster(rayComp) {
        if (!rayComp) return null;

        // A-Frame จะเก็บ element ที่โดน raycaster ไว้ใน intersectedEls
        if (rayComp.intersectedEls && rayComp.intersectedEls.length > 0) {
          return rayComp.intersectedEls[0];
        }

        // เผื่อบางเวอร์ชันใช้ intersections (object3D)
        if (rayComp.intersections && rayComp.intersections.length > 0) {
          const obj = rayComp.intersections[0].object;
          if (obj && obj.el) return obj.el;
        }
        return null;
      }

      function shoot() {
        if (!activeRaycaster || !activeRaycaster.components.raycaster) return;
        const rayComp = activeRaycaster.components.raycaster;
        const target = findTargetFromRaycaster(rayComp);
        if (!target) return;

        // ยิงเฉพาะเป้าที่ตั้ง data-hha-tgt ไว้
        if (!target.hasAttribute('data-hha-tgt')) return;

        // ให้เป้ารับ event click (GameEngine ผูก listener ไว้แล้ว)
        target.emit('click');
      }

      // ---------- Desktop: เมาส์คลิกซ้าย ----------
      window.addEventListener('mousedown', function (evt) {
        if (evt.button !== 0) return; // เฉพาะปุ่มซ้าย
        shoot();
      });

      // ---------- Mobile: แตะหน้าจอ ----------
      window.addEventListener('touchstart', function () {
        shoot();
      }, { passive: true });

      // ---------- VR: trigger / ปุ่มหลัก ----------
      if (hand) {
        hand.addEventListener('triggerdown', shoot);
        hand.addEventListener('gripdown', shoot);
        hand.addEventListener('abuttondown', shoot);
        hand.addEventListener('bbuttondown', shoot);
        hand.addEventListener('xbuttondown', shoot);
        hand.addEventListener('ybuttondown', shoot);
      }

      // ---------- เผื่อใช้คีย์บอร์ด Space ยิง ----------
      window.addEventListener('keydown', function (evt) {
        if (evt.code === 'Space' || evt.code === 'Enter') {
          shoot();
        }
      });
    }
  });

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
