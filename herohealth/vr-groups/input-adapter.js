// vr-groups/input-adapter.js
(function (ns) {
  'use strict';

  function detectDeviceType() {
    try {
      if (window.AFRAME && AFRAME.utils && AFRAME.utils.device) {
        const d = AFRAME.utils.device;
        if (d.isMobileVR && d.isMobileVR()) return 'mobile-vr';
        if (d.checkHeadsetConnected && d.checkHeadsetConnected()) return 'desktop-vr';
        if (d.isMobile && d.isMobile()) return 'mobile';
        return 'desktop';
      }
    } catch (e) {}
    const ua = navigator.userAgent || '';
    if (/Mobile|Android|iPhone|iPad/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  AFRAME.registerComponent('fg-input-adapter', {
    init: function () {
      const cam = document.getElementById('camera');
      const cursor = document.getElementById('cursor');
      const hintEl = document.getElementById('fgHint');
      const rightHand = document.getElementById('rightHand');

      if (!cam || !cursor) return;

      const type = detectDeviceType();

      // base raycaster ให้ยิงเฉพาะเป้า
      cursor.setAttribute('raycaster', 'objects: [data-hha-tgt]');

      if (type === 'desktop') {
        // 🖥 PC: ใช้เมาส์เล็ง + คลิก
        cam.setAttribute('look-controls', 'pointerLockEnabled: false; touchEnabled: true');
        cursor.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');
        cursor.setAttribute('geometry', 'primitive: ring; radiusInner: 0.01; radiusOuter: 0.02');
        cursor.setAttribute('material',
          'color: #fde047; shader: flat; opacity: 0.95;');
        if (hintEl) {
          hintEl.textContent = 'ลากเมาส์เลื่อนเป้า แล้วคลิกซ้ายเพื่อยิง 🎯';
        }
      } else if (type === 'mobile') {
        // 📱 โทรศัพท์: ใช้วงแหวนกลางจอ + แตะ
        cam.setAttribute('look-controls',
          'pointerLockEnabled: false; touchEnabled: true');
        cursor.setAttribute('cursor', 'rayOrigin: entity; fuse: true; fuseTimeout: 1200');
        cursor.setAttribute('geometry', 'primitive: ring; radiusInner: 0.02; radiusOuter: 0.04');
        if (hintEl) {
          hintEl.textContent = 'หันมือถือให้วงแหวนทับเป้า แล้วแตะหน้าจอเพื่อยิง 🎯';
        }
      } else {
        // 🕶 VR Headset (mobile-vr / desktop-vr)
        cam.setAttribute('look-controls',
          'pointerLockEnabled: false; touchEnabled: false');
        // ใช้ทั้ง gaze และ controller ได้
        cursor.setAttribute('cursor', 'rayOrigin: entity; fuse: true; fuseTimeout: 1200');
        cursor.setAttribute('geometry', 'primitive: ring; radiusInner: 0.02; radiusOuter: 0.04');

        if (rightHand) {
          rightHand.setAttribute('laser-controls', 'hand: right');
          rightHand.setAttribute('raycaster', 'objects: [data-hha-tgt]; interval: 10');
        }

        if (hintEl) {
          hintEl.textContent = 'ใช้ Trigger บนคอนโทรลเลอร์ หรือจ้องค้างที่เป้าเพื่อยิง 🎯';
        }
      }

      // auto-hide hint หลัง 8 วินาที (ไม่บังจอ)
      if (hintEl) {
        setTimeout(function () {
          hintEl.style.transition = 'opacity .5s ease';
          hintEl.style.opacity = '0';
          hintEl.style.pointerEvents = 'none';
        }, 8000);
      }
    }
  });

  ns.foodGroupsInputAdapter = true;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
