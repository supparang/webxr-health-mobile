// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// GoodJunkVR — Touch/Gyro "World Shift" (drag-only by default)
// ✅ export attachTouchLook (ESM)
// ✅ FIX: use hostEl (gj-stage) for pointerdown when layer pointer-events:none
// ✅ Drag-only default (mouse move alone won't shift world)

'use strict';

export function attachTouchLook(opts = {}) {
  const layerEl = opts.layerEl;
  const hostEl  = opts.hostEl || layerEl;      // ✅ stage recommended
  const crosshairEl = opts.crosshairEl || null;

  if (!layerEl || !hostEl) {
    console.warn('[touch-look] missing layerEl/hostEl');
    return { recenter(){}, destroy(){} };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp  = (a, b, t) => a + (b - a) * t;

  const maxShiftPx = Number(opts.maxShiftPx ?? 170);
  const ease       = Number(opts.ease ?? 0.12);
  const dragOnly   = (opts.dragOnly !== false);

  const aimY = Number(opts.aimY ?? 0.62);
  if (crosshairEl) crosshairEl.style.setProperty('--aimY', String(aimY));

  let dragging = false;
  let px = 0, py = 0;
  let tx = 0, ty = 0;
  let lastX = 0, lastY = 0;
  let rafId = 0;
  let destroyed = false;

  function apply() {
    if (destroyed) return;
    px = lerp(px, tx, ease);
    py = lerp(py, ty, ease);
    layerEl.style.transform = `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px)`;
    rafId = requestAnimationFrame(apply);
  }

  function setTarget(dx, dy) {
    tx = clamp(dx, -maxShiftPx, maxShiftPx);
    ty = clamp(dy, -maxShiftPx, maxShiftPx);
  }

  function onDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onMove(e) {
    if (dragOnly && !dragging) return;

    if (!dragging && !dragOnly) {
      const cx = (window.innerWidth || 360) * 0.5;
      const cy = (window.innerHeight || 640) * 0.5;
      setTarget((e.clientX - cx) * 0.20, (e.clientY - cy) * 0.20);
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    setTarget(tx + dx * 0.35, ty + dy * 0.35);
  }

  function onUp() { dragging = false; }

  // optional gyro subtle drift
  let gyroOn = false;
  function onOri(ev) {
    if (!gyroOn) return;
    const gamma = Number(ev.gamma) || 0;
    const beta  = Number(ev.beta)  || 0;
    const gx = clamp(gamma * 1.5, -35, 35);
    const gy = clamp((beta - 20) * 0.9, -28, 28);
    setTarget(tx + gx * 0.03, ty + gy * 0.03);
  }

  async function enableGyro() {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const p = await DeviceOrientationEvent.requestPermission();
        gyroOn = (p === 'granted');
      } else {
        gyroOn = true;
      }
      if (gyroOn) window.addEventListener('deviceorientation', onOri, { passive: true });
    } catch (_) {}
  }

  function recenter() {
    tx = 0; ty = 0;
    px = 0; py = 0;
    layerEl.style.transform = 'translate(0px, 0px)';
  }

  function destroy() {
    destroyed = true;
    try { cancelAnimationFrame(rafId); } catch (_) {}
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    hostEl.removeEventListener('pointerdown', onDown);
    try { window.removeEventListener('deviceorientation', onOri); } catch (_) {}
  }

  // bind
  hostEl.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });

  rafId = requestAnimationFrame(apply);
  if (opts.gyro === true) enableGyro();

  return { recenter, enableGyro, destroy };
}