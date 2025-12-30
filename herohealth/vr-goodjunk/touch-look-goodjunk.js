// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch/Gyro look -> shift layers (VR-feel) for GoodJunkVR
// ✅ named export: attachTouchLook

'use strict';

export function attachTouchLook(opts = {}){
  const DOC = document;
  const stageEl = opts.stageEl || DOC.getElementById('gj-stage');
  const layerEls = Array.isArray(opts.layerEls) ? opts.layerEls.filter(Boolean) : [];
  const hazardEls = Array.isArray(opts.hazardEls) ? opts.hazardEls.filter(Boolean) : [];
  const maxShiftPx = Math.max(20, Number(opts.maxShiftPx || 160));
  const ease = Math.min(0.35, Math.max(0.04, Number(opts.ease || 0.12)));

  if (!stageEl || (!layerEls.length && !hazardEls.length)) return () => {};

  // target shift
  let tx = 0, ty = 0;
  let vx = 0, vy = 0;

  // pointer state
  let dragging = false;
  let sx = 0, sy = 0;
  let cx = window.innerWidth * 0.5;
  let cy = window.innerHeight * 0.5;

  // gyro state (normalized -1..1 approx)
  let gx = 0, gy = 0;
  let gyroOn = false;

  function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function apply(){
    // smooth
    vx += (tx - vx) * ease;
    vy += (ty - vy) * ease;

    const px = (vx).toFixed(2);
    const py = (vy).toFixed(2);

    // shift layers/hazards only (crosshair stays fixed)
    const t = `translate3d(${px}px, ${py}px, 0)`;

    for (const el of layerEls) el.style.transform = t;
    for (const el of hazardEls) el.style.transform = t;
    requestAnimationFrame(apply);
  }

  function setTargetFromPointer(x, y){
    cx = window.innerWidth * 0.5;
    cy = window.innerHeight * 0.5;

    const dx = (x - cx);
    const dy = (y - cy);

    // small deadzone
    const dd = 6;
    const ddx = Math.abs(dx) < dd ? 0 : dx;
    const ddy = Math.abs(dy) < dd ? 0 : dy;

    tx = clamp(ddx / 3.6, -maxShiftPx, maxShiftPx);
    ty = clamp(ddy / 4.2, -maxShiftPx, maxShiftPx);
  }

  function onDown(e){
    dragging = true;
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    sx = p.clientX; sy = p.clientY;
    setTargetFromPointer(sx, sy);
  }
  function onMove(e){
    if (!dragging) return;
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    setTargetFromPointer(p.clientX, p.clientY);
  }
  function onUp(){
    dragging = false;
    // ease back slightly instead of hard reset
    tx *= 0.35;
    ty *= 0.35;
  }

  // Gyro mapping (very gentle)
  function onOrient(e){
    // beta: front/back (-180..180), gamma: left/right (-90..90)
    const beta = Number(e.beta);
    const gamma = Number(e.gamma);
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

    gyroOn = true;
    // normalize
    gy = clamp(beta / 45, -1, 1);
    gx = clamp(gamma / 35, -1, 1);

    // blend gyro into target if not dragging
    if (!dragging){
      tx = clamp(gx * (maxShiftPx * 0.55), -maxShiftPx, maxShiftPx);
      ty = clamp(gy * (maxShiftPx * 0.45), -maxShiftPx, maxShiftPx);
    }
  }

  // bind
  stageEl.addEventListener('pointerdown', onDown, { passive:true });
  stageEl.addEventListener('pointermove', onMove, { passive:true });
  stageEl.addEventListener('pointerup', onUp, { passive:true });
  stageEl.addEventListener('pointercancel', onUp, { passive:true });

  stageEl.addEventListener('touchstart', onDown, { passive:true });
  stageEl.addEventListener('touchmove', onMove, { passive:true });
  stageEl.addEventListener('touchend', onUp, { passive:true });
  stageEl.addEventListener('touchcancel', onUp, { passive:true });

  // gyro permission on iOS requires user gesture
  async function tryEnableGyro(){
    try{
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function'){
        const r = await DeviceOrientationEvent.requestPermission();
        if (r === 'granted'){
          window.addEventListener('deviceorientation', onOrient, { passive:true });
        }
      } else {
        window.addEventListener('deviceorientation', onOrient, { passive:true });
      }
    }catch(_){}
  }

  // expose helper
  const api = {
    enableGyro: tryEnableGyro,
    destroy(){
      stageEl.removeEventListener('pointerdown', onDown);
      stageEl.removeEventListener('pointermove', onMove);
      stageEl.removeEventListener('pointerup', onUp);
      stageEl.removeEventListener('pointercancel', onUp);
      stageEl.removeEventListener('touchstart', onDown);
      stageEl.removeEventListener('touchmove', onMove);
      stageEl.removeEventListener('touchend', onUp);
      stageEl.removeEventListener('touchcancel', onUp);
      window.removeEventListener('deviceorientation', onOrient);
      for (const el of layerEls) el.style.transform = '';
      for (const el of hazardEls) el.style.transform = '';
    }
  };

  requestAnimationFrame(apply);
  return api;
}