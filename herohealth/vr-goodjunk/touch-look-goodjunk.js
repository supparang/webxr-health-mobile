// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch/Gyro world-shift (GOODJUNK) — PRODUCTION
// ✅ Export: attachTouchLook (fix boot import error)
// ✅ Mouse: world moves ONLY while dragging (no move-on-hover)
// ✅ Touch: drag to shift
// ✅ DeviceOrientation: subtle drift (optional)
// ✅ Avoid stealing clicks on targets/buttons

'use strict';

export function attachTouchLook(opts = {}) {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  const doc  = root.document;

  const layerEl = opts.layerEl || doc.getElementById('gj-layer');
  const crosshairEl = opts.crosshairEl || doc.getElementById('gj-crosshair');

  const aimY = Number.isFinite(opts.aimY) ? opts.aimY : 0.62;
  const maxShiftPx = Number.isFinite(opts.maxShiftPx) ? opts.maxShiftPx : 170;
  const ease = Number.isFinite(opts.ease) ? opts.ease : 0.12;

  if (!layerEl) return { destroy(){} };

  // internal state
  let dragging = false;
  let lastX = 0, lastY = 0;

  let targetX = 0, targetY = 0; // desired shift
  let curX = 0, curY = 0;       // smoothed shift

  let raf = 0;
  let enabled = true;

  // Apply transform (GPU friendly)
  function apply() {
    if (!enabled) return;
    curX += (targetX - curX) * ease;
    curY += (targetY - curY) * ease;

    // Important: only translate (no scale) to keep hitboxes intuitive
    layerEl.style.transform = `translate(${curX.toFixed(2)}px, ${curY.toFixed(2)}px)`;
    raf = root.requestAnimationFrame(apply);
  }

  function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }

  function isInteractiveTarget(el){
    if (!el) return false;
    // Don't start drag when user intends to click targets/buttons
    return !!(el.closest && (
      el.closest('.gj-target') ||
      el.closest('button') ||
      el.closest('a') ||
      el.closest('[role="button"]') ||
      el.closest('.hha-controls') ||
      el.closest('.hha-hud') ||
      el.closest('#startOverlay') ||
      el.closest('.start-overlay')
    ));
  }

  function onPointerDown(e){
    if (!enabled) return;
    // only primary
    if (e.button != null && e.button !== 0) return;

    if (isInteractiveTarget(e.target)) return;

    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;

    try { layerEl.setPointerCapture && layerEl.setPointerCapture(e.pointerId); } catch(_){}
  }

  function onPointerMove(e){
    if (!enabled || !dragging) return;

    const dx = (e.clientX - lastX);
    const dy = (e.clientY - lastY);
    lastX = e.clientX;
    lastY = e.clientY;

    // Drag feel: small factor
    targetX = clamp(targetX + dx * 0.35, -maxShiftPx, maxShiftPx);
    targetY = clamp(targetY + dy * 0.35, -maxShiftPx, maxShiftPx);
  }

  function onPointerUp(e){
    if (!enabled) return;
    dragging = false;
    try { layerEl.releasePointerCapture && layerEl.releasePointerCapture(e.pointerId); } catch(_){}
  }

  function recenter(){
    targetX = 0;
    targetY = 0;
  }

  // subtle gyro (optional)
  function onDeviceOrientation(ev){
    if (!enabled) return;
    // keep it subtle and NOT fight with drag (only when not dragging)
    if (dragging) return;

    const gx = Number(ev.gamma) || 0; // left-right
    const gy = Number(ev.beta)  || 0; // front-back

    // gentle drift only
    const driftX = clamp(gx * 0.9, -18, 18);
    const driftY = clamp((gy - 20) * 0.35, -14, 14);

    targetX = clamp(driftX, -maxShiftPx, maxShiftPx);
    targetY = clamp(driftY, -maxShiftPx, maxShiftPx);
  }

  // keep crosshair at aimY (optional helper)
  function positionCrosshair(){
    if (!crosshairEl) return;
    const vw = root.innerWidth || 360;
    const vh = root.innerHeight || 640;
    crosshairEl.style.left = (vw * 0.5) + 'px';
    crosshairEl.style.top  = (vh * aimY) + 'px';
  }

  // Bind
  layerEl.addEventListener('pointerdown', onPointerDown, { passive:true });
  root.addEventListener('pointermove', onPointerMove, { passive:true });
  root.addEventListener('pointerup', onPointerUp, { passive:true });
  root.addEventListener('pointercancel', onPointerUp, { passive:true });

  root.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
  root.addEventListener('resize', positionCrosshair, { passive:true });
  positionCrosshair();

  // start loop
  raf = root.requestAnimationFrame(apply);

  return {
    recenter,
    destroy(){
      enabled = false;
      try { if (raf) root.cancelAnimationFrame(raf); } catch(_){}
      layerEl.style.transform = '';
      layerEl.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerUp);
      root.removeEventListener('deviceorientation', onDeviceOrientation);
      root.removeEventListener('resize', positionCrosshair);
    }
  };
}