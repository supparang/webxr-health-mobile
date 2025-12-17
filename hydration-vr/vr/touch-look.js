// path: herohealth/vr/touch-look.js
'use strict';

/**
 * attachTouchLook
 * ระบบควบคุมกล้อง A-Frame ด้วยการลากนิ้ว (Touch) หรือเมาส์
 * ออกแบบมาเพื่อใช้ร่วมกับ UI Overlay (HTML) โดยเฉพาะ
 */
export function attachTouchLook(cameraEl, options = {}) {
  if (!cameraEl) {
    console.warn('[touch-look] cameraEl not found');
    return;
  }

  // 1. ตั้งค่าพื้นฐาน
  const sensitivity = (typeof options.sensitivity === 'number') ? options.sensitivity : 0.25;
  const areaEl = options.areaEl || document.body;
  
  // Selector ของสิ่งที่ "ห้าม" หมุนกล้องถ้าไปกดโดน (เช่น ปุ่ม, ลิงก์)
  const IGNORE_SELECTOR = options.ignoreSelector || '.pointer-auto, button, a, input, .hha-hud-card';

  function shouldIgnoreTarget(target){
    if (!target || !target.closest) return false;
    return !!target.closest(IGNORE_SELECTOR);
  }

  // 2. ปิด Default look-controls ของ A-Frame (เพื่อกันตีกัน)
  try {
    const lc = cameraEl.components && cameraEl.components['look-controls'];
    if (lc && lc.pause) lc.pause();
    cameraEl.setAttribute('look-controls', 'enabled: false');
  } catch (_) {}

  // 3. ตัวแปรเก็บค่ามุมกล้อง
  let rot = cameraEl.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
  let yaw   = Number(rot.y) || 0; 
  let pitch = Number(rot.x) || 0; 

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let rafPending = false;

  function clampPitch(v) { return Math.max(-80, Math.min(80, v)); }

  // 4. ฟังก์ชันหมุนกล้อง (Render Loop)
  function applyRotationNow() {
    // อัปเดตผ่าน Object3D โดยตรงเพื่อความลื่นไหลสูงสุด
    try {
      const obj = cameraEl.object3D;
      if (obj) {
        const THREE = (window.AFRAME && window.AFRAME.THREE) || window.THREE;
        if (THREE) {
            obj.rotation.x = THREE.MathUtils.degToRad(pitch);
            obj.rotation.y = THREE.MathUtils.degToRad(yaw);
            obj.rotation.z = 0;
            obj.updateMatrixWorld(true);
        }
      }
      // อัปเดต Attribute ด้วยเพื่อให้ A-Frame รับรู้
      cameraEl.setAttribute('rotation', { x: pitch, y: yaw, z: 0 });
    } catch (e) {
      console.error(e);
    }
  }

  function scheduleApply(){
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      applyRotationNow();
    });
  }

  // 5. Logic การลาก
  function startDrag(x, y) {
    isDragging = true;
    lastX = x;
    lastY = y;
  }

  function moveDrag(x, y) {
    if (!isDragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;

    // คำนวณมุมใหม่
    yaw   -= dx * sensitivity;      
    pitch -= dy * sensitivity;      
    pitch  = clampPitch(pitch);

    scheduleApply();
  }

  function endDrag() {
    isDragging = false;
  }

  // --- Touch Events (Mobile) ---
  areaEl.addEventListener('touchstart', (ev) => {
    if (shouldIgnoreTarget(ev.target)) return;
    if (ev.touches && ev.touches[0]) {
        const t = ev.touches[0];
        startDrag(t.clientX, t.clientY);
    }
  }, { passive: false });

  areaEl.addEventListener('touchmove', (ev) => {
    if (!isDragging) return;
    if (ev.touches && ev.touches[0]) {
        // สำคัญ: ป้องกันหน้าเว็บเลื่อน/รีเฟรช ขณะลากหมุนกล้อง
        if(ev.cancelable) ev.preventDefault(); 
        const t = ev.touches[0];
        moveDrag(t.clientX, t.clientY);
    }
  }, { passive: false });

  areaEl.addEventListener('touchend', endDrag);
  areaEl.addEventListener('touchcancel', endDrag);

  // --- Mouse Events (Desktop) ---
  areaEl.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || shouldIgnoreTarget(ev.target)) return;
    startDrag(ev.clientX, ev.clientY);
  });
  window.addEventListener('mousemove', (ev) => {
    moveDrag(ev.clientX, ev.clientY);
  });
  window.addEventListener('mouseup', endDrag);

  // Initial Sync
  applyRotationNow();
}
