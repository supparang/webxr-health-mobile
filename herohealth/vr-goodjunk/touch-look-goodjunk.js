// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// GoodJunkVR — Touch/Gyro "World Shift" (drag-only by default)
// ✅ ESM export: attachTouchLook (matches goodjunk-vr.boot.js import)
// ✅ Drag to shift world; mouse move alone won't move world (fix "เมาส์ขยับแล้วเป้าขยับ")
// ✅ Optional deviceorientation subtle drift (mobile)

'use strict';

export function attachTouchLook(opts = {}) {
  const layerEl = opts.layerEl;
  const crosshairEl = opts.crosshairEl || null;

  if (!layerEl) {
    console.warn('[touch-look] missing layerEl');
    return { recenter(){}, destroy(){} };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp  = (a, b, t) => a + (b - a) * t;

  const maxShiftPx = Number(opts.maxShiftPx ?? 170);
  const ease       = Number(opts.ease ?? 0.12);

  // IMPORTANT: dragOnly = true by default (prevents "mouse move moves world")
  const dragOnly   = (opts.dragOnly !== false);

  // aimY used by some HUD crosshair styles (optional)
  const aimY = Number(opts.aimY ?? 0.62);
  if (crosshairEl) crosshairEl.style.setProperty('--aimY', String(aimY));

  // state
  let dragging = false;
  let px = 0, py = 0;      // current
  let tx = 0, ty = 0;      // target
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
      // optional "mouse look" mode (not used by default)
      const cx = (window.innerWidth || 360) * 0.5;
      const cy = (window.innerHeight || 640) * 0.5;
      const dx = (e.clientX - cx) * 0.20;
      const dy = (e.clientY - cy) * 0.20;
      setTarget(dx, dy);
      return;
    }

    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // drag scales
    setTarget(tx + dx * 0.35, ty + dy * 0.35);
  }

  function onUp() { dragging = false; }

  // deviceorientation (subtle)
  let gyroOn = false;
  function onOri(ev) {
    if (!gyroOn) return;
    const gamma = Number(ev.gamma) || 0; // left/right
    const beta  = Number(ev.beta)  || 0; // front/back
    // gentle drift, not a full control
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
    layerEl.removeEventListener('pointerdown', onDown);
    try { window.removeEventListener('deviceorientation', onOri); } catch (_) {}
  }

  // events
  layerEl.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });

  // start loop
  rafId = requestAnimationFrame(apply);

  // auto gyro for mobile if asked
  if (opts.gyro === true) enableGyro();

  // optional API
  return { recenter, enableGyro, destroy };
}

// optional global fallback (harmless)
try { window.attachTouchLook = attachTouchLook; } catch (_) {}