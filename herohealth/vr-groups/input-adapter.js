// vr-groups/input-adapter.js
// ทำให้เล็ง-ยิงได้เหมือน GoodJunk:
// - PC: คลิกซ้าย → ยิงเป้าที่ raycaster ชี้อยู่
// - มือถือ: แตะจอ → ยิงเป้า
// - VR: trigger / selectstart ที่ controller → ยิงเป้า

(function () {
  'use strict';

  function triggerFromRaycaster(rayEl) {
    if (!rayEl || !rayEl.components || !rayEl.components.raycaster) return;

    const ray = rayEl.components.raycaster;
    const list = ray.intersections || ray.intersectedEls || [];

    let targetEl = null;

    // A-Frame 1.5 มักได้ intersections เป็น array ของ THREE.Object3D
    if (list.length && list[0].object && list[0].object.el) {
      targetEl = list[0].object.el;
    } else if (list.length && list[0].el) {
      targetEl = list[0].el;
    }

    if (!targetEl) return;

    // ยิง event click ทั้งแบบ A-Frame และ DOM
    targetEl.emit('click');
    try {
      targetEl.dispatchEvent(new Event('click'));
    } catch (e) {
      // บาง browser ไม่ให้สร้าง Event แบบนี้ก็ข้ามไป
    }
  }

  AFRAME.registerComponent('fg-input-adapter', {
    init: function () {
      const sceneEl   = this.el;
      const cursorEl  = sceneEl.querySelector('#cursor');
      const rightHand = sceneEl.querySelector('#rightHand');

      // --- Desktop: คลิกซ้าย ---
      window.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;      // เอาเฉพาะปุ่มซ้าย
        triggerFromRaycaster(cursorEl);
      });

      // --- Mobile: แตะจอ ---
      window.addEventListener(
        'touchstart',
        function () {
          triggerFromRaycaster(cursorEl);
        },
        { passive: true }
      );

      // --- VR Controller: trigger / selectstart ---
      if (rightHand) {
        const fire = () => triggerFromRaycaster(rightHand);
        rightHand.addEventListener('triggerdown', fire);
        rightHand.addEventListener('triggerup', fire);
        rightHand.addEventListener('selectstart', fire);
        rightHand.addEventListener('select', fire);
      }
    }
  });
})();