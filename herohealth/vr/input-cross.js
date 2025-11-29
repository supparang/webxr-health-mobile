// --- 0. vr/input-cross.js (Cross-device input helper — PC + Mobile + VR) ---
(function(exports) {
  'use strict';

  /**
   * setupCrossDeviceInput(sceneEl)
   * - PC / Mobile: ใช้ rayOrigin: mouse, fuse: false → คลิก/แตะได้ตามปกติ
   * - VR Headset (enter-vr): สลับเป็น rayOrigin: entity + fuse → ใช้ gaze/trigger
   */
  function setupCrossDeviceInput(sceneEl) {
    if (!sceneEl) return;

    const cursor = document.getElementById('cursor');
    if (!cursor) return;

    // โหมดเริ่มต้น: PC + Mobile
    cursor.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');

    // เข้า VR → ใช้ gaze/fuse
    sceneEl.addEventListener('enter-vr', () => {
      cursor.setAttribute(
        'cursor',
        'rayOrigin: entity; fuse: true; fuseTimeout: 1200'
      );
    });

    // ออกจาก VR → กลับมาใช้ mouse/touch
    sceneEl.addEventListener('exit-vr', () => {
      cursor.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');
    });
  }

  exports.setupCrossDeviceInput = setupCrossDeviceInput;
})(GAME_MODULES);
