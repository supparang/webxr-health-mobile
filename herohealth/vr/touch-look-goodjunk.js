// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch-look สำหรับ GoodJunk VR (หมุนมุมมองด้วยการลากนิ้วบนจอ)

'use strict';

export function attachTouchLook(cameraEl, opts = {}) {
  if (!cameraEl) return;

  const areaEl     = opts.areaEl || document.body;
  const sensitivity = typeof opts.sensitivity === 'number' ? opts.sensitivity : 0.25;
  const onActiveChange = typeof opts.onActiveChange === 'function'
    ? opts.onActiveChange
    : () => {};

  // ถ้าอุปกรณ์ไม่มี touch ก็ไม่ต้องทำอะไร (ให้ใช้เมาส์เลื่อนตามปกติ)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!hasTouch) return;

  let active = false;
  let startX = 0;
  let startY = 0;
  let startRotX = 0;
  let startRotY = 0;

  function setActive(v) {
    if (active === v) return;
    active = v;
    onActiveChange(active);
  }

  function onTouchStart(ev) {
    if (!ev.touches || ev.touches.length === 0) return;
    const t = ev.touches[0];

    const rot = cameraEl.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
    startRotX = rot.x || 0;
    startRotY = rot.y || 0;

    startX = t.clientX;
    startY = t.clientY;

    setActive(true);
  }

  function onTouchMove(ev) {
    if (!active) return;
    if (!ev.touches || ev.touches.length === 0) return;
    const t = ev.touches[0];

    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // แปลง pixel → องศา
    const rotY = startRotY + dx * sensitivity;
    let rotX   = startRotX - dy * sensitivity; // ลากขึ้น = มองขึ้น

    // จำกัดไม่ให้เงย/ก้มเกินไป
    if (rotX > 80) rotX = 80;
    if (rotX < -80) rotX = -80;

    cameraEl.setAttribute('rotation', {
      x: rotX,
      y: rotY,
      z: 0
    });
  }

  function onTouchEnd() {
    if (!active) return;
    setActive(false);
  }

  areaEl.addEventListener('touchstart', onTouchStart, { passive: true });
  areaEl.addEventListener('touchmove',  onTouchMove,  { passive: true });
  areaEl.addEventListener('touchend',   onTouchEnd,   { passive: true });
  areaEl.addEventListener('touchcancel',onTouchEnd,   { passive: true });
}
