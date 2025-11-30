// vr-groups/input-adapter.js
(function () {
  'use strict';

  function setup() {
    const sceneEl  = document.getElementById('gameScene');
    const cursorEl = document.getElementById('cursor');

    if (!sceneEl || !cursorEl || !window.AFRAME) return;

    const dev        = AFRAME.utils.device;
    const isMobile   = dev.isMobile();
    const isMobileVR = dev.isMobileVR(); // Cardboard / Quest browser ฯลฯ

    // ====== HUD บอกวิธีบังคับ ======
    const hint = document.createElement('div');
    hint.id = 'fgControlsHint';
    hint.style.position   = 'fixed';
    hint.style.bottom     = '10px';
    hint.style.left       = '50%';
    hint.style.transform  = 'translateX(-50%)';
    hint.style.padding    = '6px 12px';
    hint.style.borderRadius = '999px';
    hint.style.background = 'rgba(15,23,42,.75)';
    hint.style.color      = '#e5e7eb';
    hint.style.font       = '500 13px system-ui,-apple-system,Segoe UI,sans-serif';
    hint.style.zIndex     = '9999';

    if (isMobileVR) {
      // 🥽 VR Headset → ใช้ Trigger เป็นหลัก + Gaze สำรอง
      cursorEl.setAttribute('cursor', 'fuse: true; fuseTimeout: 1200; rayOrigin: entity');
      hint.textContent = 'VR: ใช้ Trigger ยิง หรือจ้องค้างให้วงกลมเต็ม 🔫';
    } else if (isMobile) {
      // 📱 มือถือ: แตะบนเป้า เล็งด้วยการหมุนเครื่อง
      cursorEl.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');
      hint.textContent = 'Mobile: แตะบนเป้าเพื่อยิง เล็งด้วยการหมุนมือถือ 📱';
    } else {
      // 🖥 PC: เมาส์
      cursorEl.setAttribute('cursor', 'rayOrigin: mouse; fuse: false');
      hint.textContent = 'PC: ใช้เมาส์เล็งแล้วคลิกซ้ายยิง 🖱️';
    }

    document.body.appendChild(hint);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.addEventListener('load', setup);
  } else {
    window.addEventListener('DOMContentLoaded', setup);
  }
})();
