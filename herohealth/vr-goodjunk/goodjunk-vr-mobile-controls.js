// === vr-goodjunk/goodjunk-vr-mobile-controls.js ===
// คอนโทรลเฉพาะฝั่งการเล็ง/ยิงบนมือถือ & เดสก์ท็อป
// - หมุนมุมมอง: A-Frame ทำให้ผ่าน look-controls อยู่แล้ว
// - ยิง: ใช้ปุ่ม #fireBtn ยิง ray จาก cursor (#vrCursor) ไปโดน .gj-target

(function () {
  'use strict';

  function $(sel) {
    return document.querySelector(sel);
  }

  let fireBtn, cursorEl;

  function setup() {
    fireBtn = $('#fireBtn');
    cursorEl = $('#vrCursor');

    if (!fireBtn || !cursorEl) {
      console.warn('[GoodJunk VR] fireBtn หรือ vrCursor ไม่พบใน DOM');
      return;
    }

    // กดปุ่ม ยิง!
    fireBtn.addEventListener('click', shootFromCenter);

    // เผื่อบางเครื่อง touch ยังไม่ยิง click ให้ เพิ่ม touchstart ซ้ำ
    fireBtn.addEventListener('touchstart', function (ev) {
      ev.preventDefault();
      shootFromCenter();
    }, { passive: false });

    console.log('[GoodJunk VR] Mobile controls ready');
  }

  function shootFromCenter() {
    const rayComp = cursorEl.components && cursorEl.components.raycaster;
    if (!rayComp) {
      console.warn('[GoodJunk VR] raycaster component ยังไม่พร้อม');
      return;
    }

    // ให้ raycaster รีเฟรช list ของเป้า .gj-target
    try {
      rayComp.refreshObjects && rayComp.refreshObjects();
    } catch (err) {
      // noop
    }

    const targets = rayComp.intersectedEls || [];
    if (!targets.length) {
      // ยิงไม่โดนอะไร อาจทำ effect ยิบๆ ที่ crosshair ภายหลังได้
      // เช่น กระพริบวงกลม
      flashCursorMiss();
      return;
    }

    const hitEl = targets[0];

    // ส่ง event click ให้เป้าที่โดน ray
    // engine/logic เดิมของคุณที่ฟัง 'click' ไว้จะทำงานเหมือนเดิม
    hitEl.emit('click', { origin: 'center-ray', cursor: cursorEl });

    flashCursorHit();
  }

  // Effect เบาๆ ที่ crosshair เวลาโดน / ไม่โดน
  function flashCursorHit() {
    const ring = cursorEl.querySelector('a-ring');
    if (!ring) return;
    const orig = ring.getAttribute('material');
    ring.setAttribute('material', 'color', '#22c55e');
    setTimeout(() => {
      ring.setAttribute('material', 'color', orig.color || '#ffffff');
    }, 120);
  }

  function flashCursorMiss() {
    const ring = cursorEl.querySelector('a-ring');
    if (!ring) return;
    const orig = ring.getAttribute('material');
    ring.setAttribute('material', 'color', '#f97316');
    setTimeout(() => {
      ring.setAttribute('material', 'color', orig.color || '#ffffff');
    }, 120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

})();
