// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// หมุนกล้อง A-Frame ด้วยนิ้ว/เมาส์ (มือถือ/PC)
// FIX: update object3D rotation (THREE) + non-passive touch + preventDefault + ignore HUD clicks

'use strict';

export function attachTouchLook(cameraEl, options = {}) {
  if (!cameraEl) {
    console.warn('[touch-look-goodjunk] cameraEl not found');
    return;
  }

  const sensitivity = (typeof options.sensitivity === 'number') ? options.sensitivity : 0.25;
  const areaEl = options.areaEl || document.body;
  const onActiveChange = (typeof options.onActiveChange === 'function') ? options.onActiveChange : () => {};

  // กันลากบน HUD / ปุ่ม (ปรับ selector ได้ตามงานจริง)
  const IGNORE_SELECTOR = options.ignoreSelector || '.hud-root, .hud-card, button, a, input, textarea, select';

  function shouldIgnoreTarget(target){
    if (!target || !target.closest) return false;
    return !!target.closest(IGNORE_SELECTOR);
  }

  // ปิด look-controls ของ A-Frame ถ้ามี เพื่อไม่ให้สู้กัน
  try {
    const lc = cameraEl.components && cameraEl.components['look-controls'];
    if (lc && lc.pause) lc.pause();
    cameraEl.setAttribute('look-controls', 'enabled: false');
  } catch (_) {}

  // อ่าน rotation เริ่มต้น
  let rot = cameraEl.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
  let yaw   = Number(rot.y) || 0; // deg
  let pitch = Number(rot.x) || 0; // deg

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  // raf throttle (ลื่นกว่า + ลด jitter)
  let rafPending = false;

  function clampPitch(v) {
    return Math.max(-75, Math.min(75, v));
  }

  function applyRotationNow() {
    // 1) update attribute (ให้ A-Frame state ตรง)
    cameraEl.setAttribute('rotation', { x: pitch, y: yaw, z: 0 });

    // 2) update object3D ทันที (ให้ THREE camera matrix เปลี่ยนในเฟรมเดียวกัน)
    try {
      const obj = cameraEl.object3D;
      if (obj) {
        const THREE = (window.AFRAME && window.AFRAME.THREE) || window.THREE;
        if (THREE && THREE.MathUtils && THREE.MathUtils.degToRad) {
          obj.rotation.set(
            THREE.MathUtils.degToRad(pitch),
            THREE.MathUtils.degToRad(yaw),
            0
          );
          obj.updateMatrixWorld(true);
        }
      }
    } catch (_) {}
  }

  function scheduleApply(){
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      applyRotationNow();
    });
  }

  function startDrag(x, y) {
    isDragging = true;
    lastX = x;
    lastY = y;
    onActiveChange(true);
  }

  function moveDrag(x, y) {
    if (!isDragging) return;

    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;

    yaw   -= dx * sensitivity;     // ลากไปทางขวา → มองขวา
    pitch -= dy * sensitivity;     // ลากขึ้น → มองขึ้น
    pitch  = clampPitch(pitch);

    scheduleApply();
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    onActiveChange(false);
  }

  // ===== Touch =====
  areaEl.addEventListener('touchstart', (ev) => {
    if (shouldIgnoreTarget(ev.target)) return;
    if (!ev.touches || !ev.touches[0]) return;

    // กัน gesture แปลก ๆ บนมือถือ
    try { ev.preventDefault(); } catch (_) {}

    const t = ev.touches[0];
    startDrag(t.clientX, t.clientY);
  }, { passive: false });

  areaEl.addEventListener('touchmove', (ev) => {
    if (!isDragging) return;
    if (!ev.touches || !ev.touches[0]) return;

    try { ev.preventDefault(); } catch (_) {}

    const t = ev.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive: false });

  areaEl.addEventListener('touchend', (ev) => {
    try { ev.preventDefault(); } catch (_) {}
    endDrag();
  }, { passive: false });

  areaEl.addEventListener('touchcancel', (ev) => {
    try { ev.preventDefault(); } catch (_) {}
    endDrag();
  }, { passive: false });

  // ===== Mouse =====
  areaEl.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    if (shouldIgnoreTarget(ev.target)) return;
    startDrag(ev.clientX, ev.clientY);
  });

  window.addEventListener('mousemove', (ev) => {
    if (!isDragging) return;
    moveDrag(ev.clientX, ev.clientY);
  });

  window.addEventListener('mouseup', endDrag);

  // บังคับ sync ครั้งแรก
  applyRotationNow();
}

export default { attachTouchLook };
