// === herohealth/vr/touch-look.js ===
'use strict';

export function attachTouchLook(cameraEl, options = {}) {
  if (!cameraEl) {
    console.warn('[touch-look] cameraEl not found');
    return;
  }

  const sensitivity = (typeof options.sensitivity === 'number') ? options.sensitivity : 0.25;
  const areaEl = options.areaEl || document.body;
  const IGNORE_SELECTOR = options.ignoreSelector || '.pointer-auto, button, a, input';

  function shouldIgnoreTarget(target){
    if (!target || !target.closest) return false;
    return !!target.closest(IGNORE_SELECTOR);
  }

  // Disable default look-controls
  try {
    const lc = cameraEl.components && cameraEl.components['look-controls'];
    if (lc && lc.pause) lc.pause();
    cameraEl.setAttribute('look-controls', 'enabled: false');
  } catch (_) {}

  let rot = cameraEl.getAttribute('rotation') || { x: 0, y: 0, z: 0 };
  let yaw   = Number(rot.y) || 0; 
  let pitch = Number(rot.x) || 0; 

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  let rafPending = false;

  function clampPitch(v) { return Math.max(-80, Math.min(80, v)); }

  function applyRotationNow() {
    cameraEl.setAttribute('rotation', { x: pitch, y: yaw, z: 0 });
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
  }

  function moveDrag(x, y) {
    if (!isDragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;

    yaw   -= dx * sensitivity;      
    pitch -= dy * sensitivity;      
    pitch  = clampPitch(pitch);

    scheduleApply();
  }

  function endDrag() {
    isDragging = false;
  }

  // --- Touch Events ---
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
        // Prevent Pull-to-refresh on mobile
        if(ev.cancelable) ev.preventDefault(); 
        const t = ev.touches[0];
        moveDrag(t.clientX, t.clientY);
    }
  }, { passive: false });

  areaEl.addEventListener('touchend', endDrag);
  areaEl.addEventListener('touchcancel', endDrag);

  // --- Mouse Events ---
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
