// === /HeroHealth/vr/touch-look-goodjunk.js ===
// โหมดหมุนด้วยนิ้ว/เมาส์ สำหรับ GoodJunk VR (ใช้กับ A-Frame camera)
// - ถ้ามี gyro -> ปล่อยให้ระบบเดิมทำงาน (ไม่ยุ่ง)
// - ถ้าไม่มี gyro -> ปิด look-controls เดิม แล้วใช้ลากนิ้ว/เมาส์หมุนกล้องแทน

'use strict';

// ตรวจแบบหยาบ ๆ ว่าเครื่อง "น่าจะ" มี gyro ไหม
function hasGyroRough() {
  // ไม่มี DeviceOrientation เลย = ไม่มีแน่ ๆ
  if (typeof window === 'undefined') return false;
  if (typeof DeviceOrientationEvent === 'undefined') return false;

  // ถ้าเป็น mobile (มี touch) + มี DeviceOrientationEvent
  // ให้ถือว่ามี gyro (หรืออย่างน้อย browser รองรับ) ไปก่อน
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    return true;
  }

  // desktop + DeviceOrientation -> ส่วนใหญ่ไม่ใช้ในเคสเรา
  return false;
}

/**
 * attachTouchLook(cameraEl, opts?)
 * @param {AFRAME.Entity} cameraEl - a-camera หรือ entity ที่มี object3D.rotation
 * @param {Object} opts
 *    - onlyIfNoGyro: true (default) = ใช้โหมดนี้เฉพาะไม่มี gyro
 *    - sensitivity: ความไวในการหมุน (default 0.005)
 *    - areaEl: element ที่ใช้จับลาก (default = document.body)
 *    - silent: true = ไม่ส่ง coach message
 */
export function attachTouchLook(cameraEl, opts = {}) {
  const onlyIfNoGyro = (opts.onlyIfNoGyro !== false);

  if (!cameraEl || !cameraEl.object3D) {
    console.warn('[touch-look-goodjunk] cameraEl ไม่พร้อม');
    return { mode: 'none' };
  }

  // ถ้าตั้งให้ใช้เฉพาะตอน "ไม่มี gyro" แล้วเครื่องนี้มี gyro -> ไม่ต้องทำอะไร
  if (onlyIfNoGyro && hasGyroRough()) {
    console.log('[touch-look-goodjunk] พบ gyro → ใช้ look-controls เดิม');
    return { mode: 'gyro' };
  }

  console.log('[touch-look-goodjunk] ไม่มี gyro → ใช้โหมดหมุนด้วยนิ้ว');

  // ปิด look-controls เดิมของ A-Frame (ถ้ามี)
  try {
    if (cameraEl.components && cameraEl.components['look-controls']) {
      cameraEl.removeAttribute('look-controls');
    }
  } catch (e) {
    console.warn('[touch-look-goodjunk] remove look-controls fail', e);
  }

  // อ่าน rotation ปัจจุบันมาเป็นจุดตั้งต้น
  const rot = cameraEl.object3D.rotation;
  let yaw   = rot.y; // หมุนรอบแกน Y (ซ้าย-ขวา)
  let pitch = rot.x; // ก้ม-เงย

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const sensitivity = opts.sensitivity || 0.005;
  const maxPitch = Math.PI / 3; // ก้ม/เงยได้ประมาณ 60°

  const area = opts.areaEl || document.body;

  function getPoint(ev) {
    if (ev.touches && ev.touches[0]) {
      return ev.touches[0];
    }
    return ev;
  }

  function onStart(ev) {
    const p = getPoint(ev);
    dragging = true;
    lastX = p.clientX;
    lastY = p.clientY;
  }

  function onMove(ev) {
    if (!dragging) return;
    const p = getPoint(ev);
    const dx = p.clientX - lastX;
    const dy = p.clientY - lastY;
    lastX = p.clientX;
    lastY = p.clientY;

    // ลากในแนวนอน → หมุนรอบ Y
    yaw -= dx * sensitivity;

    // ลากในแนวตั้ง → ก้ม/เงย
    pitch -= dy * sensitivity;
    if (pitch >  maxPitch) pitch =  maxPitch;
    if (pitch < -maxPitch) pitch = -maxPitch;

    rot.y = yaw;
    rot.x = pitch;
  }

  function onEnd() {
    dragging = false;
  }

  // ติด event ทั้ง touch และ mouse
  area.addEventListener('touchstart', onStart, { passive: true });
  area.addEventListener('touchmove',  onMove,  { passive: true });
  area.addEventListener('touchend',   onEnd,   { passive: true });
  area.addEventListener('touchcancel',onEnd,   { passive: true });

  area.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onEnd);

  // ส่ง coach บอกเด็กว่าต้องทำยังไง
  if (!opts.silent) {
    try {
      window.dispatchEvent(new CustomEvent('hha:coach', {
        detail: { text: 'โหมดหมุนด้วยนิ้ว: ลากนิ้วบนจอเพื่อหมุนมุมมอง 👆🌀' }
      }));
    } catch (e) {}
  }

  // helper สำหรับถอด control ถ้าเปลี่ยน scene
  function detach() {
    area.removeEventListener('touchstart', onStart);
    area.removeEventListener('touchmove',  onMove);
    area.removeEventListener('touchend',   onEnd);
    area.removeEventListener('touchcancel',onEnd);

    area.removeEventListener('mousedown', onStart);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup',   onEnd);
  }

  return {
    mode: 'touch',
    detach
  };
}

export default { attachTouchLook };
