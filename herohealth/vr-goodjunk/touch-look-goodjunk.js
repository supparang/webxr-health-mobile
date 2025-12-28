// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro "VR feel" look shift for DOM layers (GoodJunkVR)
// ✅ ESM export: attachTouchLook
// ✅ Updates CSS vars: --lookX, --lookY (px)
// ✅ Optional gyro (DeviceOrientation) if available
// ✅ Works for normal + stereo (CSS handles per-eye offset)

'use strict';

export function attachTouchLook(opts = {}){
  const doc = document;
  const root = doc.documentElement;

  const stageEl = opts.stageEl || doc.getElementById('gj-stage') || doc.body;
  const aimY = Number.isFinite(opts.aimY) ? opts.aimY : 0.62;

  const maxShiftPx = Number.isFinite(opts.maxShiftPx) ? opts.maxShiftPx : 170;
  const ease = Number.isFinite(opts.ease) ? opts.ease : 0.12;

  const enableGyro = (opts.enableGyro !== false);
  const gyroScale = Number.isFinite(opts.gyroScale) ? opts.gyroScale : 1.0;

  let dragging = false;
  let px0 = 0, py0 = 0;
  let tx = 0, ty = 0;   // target shift
  let cx = 0, cy = 0;   // current shift
  let raf = 0;

  // gyro baseline
  let hasGyro = false;
  let g0a = null, g0b = null;
  let ga = 0, gb = 0;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function setVars(x, y){
    root.style.setProperty('--lookX', `${x.toFixed(2)}px`);
    root.style.setProperty('--lookY', `${y.toFixed(2)}px`);
  }

  function tick(){
    cx += (tx - cx) * ease;
    cy += (ty - cy) * ease;
    setVars(cx, cy);
    raf = requestAnimationFrame(tick);
  }

  function toNormFromPoint(px, py){
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;

    // center around “aim point” (crosshair-ish)
    const ax = w * 0.5;
    const ay = h * aimY;

    const nx = (px - ax) / Math.max(1, w * 0.5);
    const ny = (py - ay) / Math.max(1, h * 0.5);
    return { nx: clamp(nx, -1, 1), ny: clamp(ny, -1, 1) };
  }

  function updateFromPointer(px, py){
    const n = toNormFromPoint(px, py);
    tx = clamp(n.nx * maxShiftPx, -maxShiftPx, maxShiftPx);
    ty = clamp(n.ny * maxShiftPx * 0.65, -maxShiftPx, maxShiftPx);
  }

  function onDown(e){
    dragging = true;
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    px0 = p.clientX;
    py0 = p.clientY;
    updateFromPointer(px0, py0);
  }
  function onMove(e){
    if (!dragging) return;
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    updateFromPointer(p.clientX, p.clientY);
  }
  function onUp(){
    dragging = false;
    // gently return to center (but not hard snap)
    tx *= 0.55;
    ty *= 0.55;
  }

  // Gyro (optional)
  async function tryEnableGyro(){
    if (!enableGyro) return;
    try{
      // iOS permission gate
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function'){
        // Only request on user gesture; we won’t auto-call here.
        // You can call returned helper requestGyroPermission() if needed.
      }
    }catch(_){}
  }

  function onGyro(ev){
    if (!enableGyro) return;
    if (ev == null) return;

    const a = Number(ev.alpha);
    const b = Number(ev.beta);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;

    // set baseline once (avoid jump)
    if (g0a == null || g0b == null){
      g0a = a; g0b = b;
      hasGyro = true;
    }
    ga = (a - g0a);
    gb = (b - g0b);

    // merge gyro into target shift (light)
    const gx = clamp((ga / 35) * maxShiftPx * 0.45 * gyroScale, -maxShiftPx, maxShiftPx);
    const gy = clamp((gb / 35) * maxShiftPx * 0.25 * gyroScale, -maxShiftPx, maxShiftPx);

    // if dragging, pointer dominates; if not, gyro dominates gently
    if (!dragging){
      tx = gx;
      ty = gy;
    } else {
      tx = clamp(tx + gx * 0.25, -maxShiftPx, maxShiftPx);
      ty = clamp(ty + gy * 0.25, -maxShiftPx, maxShiftPx);
    }
  }

  // Bind
  stageEl.addEventListener('pointerdown', onDown, { passive:true });
  stageEl.addEventListener('pointermove', onMove, { passive:true });
  stageEl.addEventListener('pointerup', onUp, { passive:true });
  stageEl.addEventListener('pointercancel', onUp, { passive:true });

  stageEl.addEventListener('touchstart', onDown, { passive:true });
  stageEl.addEventListener('touchmove', onMove, { passive:true });
  stageEl.addEventListener('touchend', onUp, { passive:true });
  stageEl.addEventListener('touchcancel', onUp, { passive:true });

  window.addEventListener('deviceorientation', onGyro, { passive:true });

  // Start raf
  setVars(0, 0);
  raf = requestAnimationFrame(tick);
  tryEnableGyro();

  // helper for iOS permission (optional to call from Start button)
  async function requestGyroPermission(){
    try{
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function'){
        const res = await DeviceOrientationEvent.requestPermission();
        return res === 'granted';
      }
    }catch(_){}
    return false;
  }

  return {
    requestGyroPermission,
    destroy(){
      cancelAnimationFrame(raf);
      stageEl.removeEventListener('pointerdown', onDown);
      stageEl.removeEventListener('pointermove', onMove);
      stageEl.removeEventListener('pointerup', onUp);
      stageEl.removeEventListener('pointercancel', onUp);

      stageEl.removeEventListener('touchstart', onDown);
      stageEl.removeEventListener('touchmove', onMove);
      stageEl.removeEventListener('touchend', onUp);
      stageEl.removeEventListener('touchcancel', onUp);

      window.removeEventListener('deviceorientation', onGyro);
      setVars(0, 0);
    }
  };
}