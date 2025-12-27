// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro "VR-feel" world shift for DOM layer
// Exposes globals for goodjunk.safe.js:
//  - window.__GJ_LAYER_OFFSET__  (layer bounding rect)
//  - window.__GJ_LAYER_SHIFT__   (world shift x/y)
//  - window.__GJ_AIM_POINT__     (aim point in viewport)

'use strict';

export function attachTouchLook(opts = {}) {
  const ROOT = (typeof window !== 'undefined') ? window : globalThis;

  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  const crosshairEl = opts.crosshairEl || document.getElementById('gj-crosshair');

  const aimY = (opts.aimY != null) ? Number(opts.aimY) : 0.62;
  const maxShiftPx = (opts.maxShiftPx != null) ? Number(opts.maxShiftPx) : 170;
  const ease = (opts.ease != null) ? Number(opts.ease) : 0.12;

  let shiftX = 0, shiftY = 0;
  let targetX = 0, targetY = 0;

  // touch drag
  let drag = null;

  function updateOffsets(){
    if (!layerEl) return;
    const r = layerEl.getBoundingClientRect();
    ROOT.__GJ_LAYER_OFFSET__ = { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function updateAim(){
    const x = window.innerWidth / 2;
    const y = window.innerHeight * aimY;
    ROOT.__GJ_AIM_POINT__ = { x, y };

    if (crosshairEl){
      crosshairEl.style.left = `${x}px`;
      crosshairEl.style.top  = `${y}px`;
    }
  }

  function applyShift(){
    if (!layerEl) return;
    // Move layer opposite => feels like camera panning
    layerEl.style.transform = `translate3d(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px, 0)`;
    ROOT.__GJ_LAYER_SHIFT__ = { x: shiftX, y: shiftY };
  }

  function tick(){
    shiftX += (targetX - shiftX) * ease;
    shiftY += (targetY - shiftY) * ease;
    applyShift();
    requestAnimationFrame(tick);
  }

  function onDown(ev){
    drag = { x: ev.clientX, y: ev.clientY, tx: targetX, ty: targetY };
  }
  function onMove(ev){
    if (!drag) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    targetX = clamp(drag.tx + dx, -maxShiftPx, maxShiftPx);
    targetY = clamp(drag.ty + dy, -maxShiftPx, maxShiftPx);
  }
  function onUp(){ drag = null; }

  // gyro (optional)
  let gyroEnabled = false;
  function tryEnableGyro(){
    if (gyroEnabled) return;
    gyroEnabled = true;

    window.addEventListener('deviceorientation', (e) => {
      // gamma: left-right, beta: front-back
      const g = Number(e.gamma) || 0;
      const b = Number(e.beta) || 0;

      const gx = clamp(g / 25, -1, 1) * (maxShiftPx * 0.62);
      const gy = clamp((b - 10) / 25, -1, 1) * (maxShiftPx * 0.42);

      // blend gyro gently into target
      targetX = clamp(targetX + gx * 0.02, -maxShiftPx, maxShiftPx);
      targetY = clamp(targetY + gy * 0.02, -maxShiftPx, maxShiftPx);
    }, { passive: true });
  }

  function clamp(v,a,b){ return v<a?a:(v>b?b:v); }

  // init
  updateOffsets();
  updateAim();
  applyShift();
  requestAnimationFrame(tick);

  window.addEventListener('resize', () => { updateOffsets(); updateAim(); }, { passive: true });
  window.addEventListener('orientationchange', () => { setTimeout(() => { updateOffsets(); updateAim(); }, 200); }, { passive: true });

  // pointer handlers on whole doc (feel like VR)
  document.addEventListener('pointerdown', onDown, { passive: true });
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerup', onUp, { passive: true });
  document.addEventListener('pointercancel', onUp, { passive: true });

  // optional: user gesture enables gyro on iOS
  document.addEventListener('click', () => { tryEnableGyro(); }, { once: true, passive: true });

  return { updateOffsets, updateAim };
}