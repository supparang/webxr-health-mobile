// === touch-look-goodjunk.js ===
// หมุนกล้อง A-Frame ด้วยนิ้ว/เมาส์ (ใช้ได้ทั้งมือถือ/PC)

'use strict';

/**
 * attachTouchLook(cameraEl, options)
 * options:
 *   - sensitivity: จำนวนองศาที่หมุนต่อ 1 พิกเซล (default 0.25)
 *   - areaEl: element ที่รับการลาก (default: document.body)
 *   - onActiveChange: fn(active:boolean) เวลาเริ่ม/หยุดลาก
 */
export function attachTouchLook(cameraEl, options = {}) {
  if (!cameraEl) {
    console.warn('[touch-look-goodjunk] cameraEl not found');
    return;
  }

  const sensitivity = typeof options.sensitivity === 'number' ? options.sensitivity : 0.25;
  const areaEl = options.areaEl || document.body;
  const onActiveChange = typeof options.onActiveChange === 'function'
    ? options.onActiveChange
    : () => {};

  // ปิด look-controls ของ A-Frame ถ้ามี เพื่อไม่ให้สู้กัน
  try {
    const lc = cameraEl.components && cameraEl.components['look-controls'];
    if (lc && lc.pause) lc.pause();
    cameraEl.setAttribute('look-controls', 'enabled: false');
  } catch (_) {}

  let rot = cameraEl.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
  let yaw   = rot.y || 0;  // หมุนซ้าย-ขวา
  let pitch = rot.x || 0;  // หมุนขึ้น-ลง

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  function clampPitch(v) {
    return Math.max(-75, Math.min(75, v));
  }

  function applyRotation() {
    cameraEl.setAttribute('rotation', { x: pitch, y: yaw, z: 0 });
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

    yaw   -= dx * sensitivity;   // ลากไปทางขวา → มองขวา
    pitch -= dy * sensitivity;   // ลากขึ้น → มองขึ้น
    pitch  = clampPitch(pitch);

    applyRotation();
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    onActiveChange(false);
  }

  // Touch
  areaEl.addEventListener('touchstart', (ev) => {
    if (!ev.touches || !ev.touches[0]) return;
    const t = ev.touches[0];
    startDrag(t.clientX, t.clientY);
  }, { passive: true });

  areaEl.addEventListener('touchmove', (ev) => {
    if (!isDragging || !ev.touches || !ev.touches[0]) return;
    const t = ev.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive: true });

  areaEl.addEventListener('touchend',  endDrag, { passive: true });
  areaEl.addEventListener('touchcancel', endDrag, { passive: true });

  // Mouse (เผื่อทดสอบบนคอม)
  areaEl.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    startDrag(ev.clientX, ev.clientY);
  });

  window.addEventListener('mousemove', (ev) => {
    if (!isDragging) return;
    moveDrag(ev.clientX, ev.clientY);
  });

  window.addEventListener('mouseup', endDrag);
}

export default { attachTouchLook };
