// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro "VR-feel" look shift for DOM layer (GoodJunkVR)
// ✅ export attachTouchLook (ESM)
// ✅ pointer drag (desktop + mobile)
// ✅ deviceorientation (mobile, if permission granted)
// ✅ smooth easing + clamp
// ✅ returns cleanup()

'use strict';

function clamp(v, a, b){
  v = Number(v) || 0;
  return Math.max(a, Math.min(b, v));
}

function isCoarsePointer(){
  try{ return matchMedia('(pointer: coarse)').matches; }catch(_){ return false; }
}

function isMobileLike(){
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  return isCoarsePointer() || Math.min(w, h) < 520;
}

function normalizeAngleDeg(a){
  // keep in [-180, 180]
  a = Number(a) || 0;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;
  return a;
}

export function attachTouchLook(opts = {}){
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  const crosshairEl = opts.crosshairEl || document.getElementById('gj-crosshair');

  if (!layerEl) {
    console.warn('[touch-look] missing layerEl');
    return () => {};
  }

  const aimY = clamp(opts.aimY ?? 0.62, 0.2, 0.85);
  const maxShiftPx = clamp(opts.maxShiftPx ?? (isMobileLike() ? 190 : 150), 60, 360);
  const ease = clamp(opts.ease ?? 0.12, 0.04, 0.35);

  // state
  let enabled = true;

  // desired offsets (from input), and current offsets (smoothed)
  let dxWant = 0, dyWant = 0;
  let dx = 0, dy = 0;

  // drag
  let dragging = false;
  let lastX = 0, lastY = 0;

  // gyro baseline
  let gyroReady = false;
  let baseGamma = 0; // left/right
  let baseBeta  = 0; // up/down
  let useGyro = false;

  // apply transforms
  function apply(){
    if (!enabled) return;

    dx = dx + (dxWant - dx) * ease;
    dy = dy + (dyWant - dy) * ease;

    // translate layer only (crosshair stays fixed -> feels like head look)
    layerEl.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;

    // optional: keep an "aim point" for future use (not required by safe.js)
    layerEl.style.setProperty('--aimY', String(aimY));

    requestAnimationFrame(apply);
  }

  // pointer drag
  function onPointerDown(e){
    if (!enabled) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    try{ layerEl.setPointerCapture?.(e.pointerId); }catch(_){}
  }

  function onPointerMove(e){
    if (!enabled || !dragging) return;
    const x = e.clientX, y = e.clientY;
    const dxm = x - lastX;
    const dym = y - lastY;
    lastX = x; lastY = y;

    // drag moves view (invert to feel like "swipe to look")
    dxWant = clamp(dxWant + dxm * 0.9, -maxShiftPx, maxShiftPx);
    dyWant = clamp(dyWant + dym * 0.9, -maxShiftPx, maxShiftPx);
  }

  function onPointerUp(){
    dragging = false;
  }

  // gyro (best-effort)
  function onOrientation(ev){
    if (!enabled || !useGyro) return;

    const gamma = normalizeAngleDeg(ev.gamma); // L/R
    const beta  = normalizeAngleDeg(ev.beta);  // U/D

    if (!gyroReady){
      gyroReady = true;
      baseGamma = gamma;
      baseBeta  = beta;
    }

    // delta
    const dg = normalizeAngleDeg(gamma - baseGamma);
    const db = normalizeAngleDeg(beta - baseBeta);

    // map degrees -> pixels
    // keep gentle so kids don't get motion sickness
    const gx = clamp(dg / 25, -1, 1) * maxShiftPx;
    const gy = clamp(-db / 28, -1, 1) * maxShiftPx;

    // combine: gyro sets baseline, drag adds on top
    // (drag already stored in dxWant/dyWant; so blend rather than overwrite)
    dxWant = clamp(dxWant * 0.65 + gx * 0.35, -maxShiftPx, maxShiftPx);
    dyWant = clamp(dyWant * 0.65 + gy * 0.35, -maxShiftPx, maxShiftPx);
  }

  async function tryEnableGyro(){
    // iOS requires permission gesture; Android usually just works.
    try{
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        // must be called from a user gesture. If not, it will throw.
        const res = await DeviceOrientationEvent.requestPermission();
        useGyro = (res === 'granted');
      } else {
        useGyro = true;
      }
    }catch(_){
      useGyro = false;
    }
  }

  // Bind events
  layerEl.style.willChange = 'transform';
  layerEl.style.transform = 'translate3d(0,0,0)';

  // Use stage if exists (better drag area)
  const stage = document.getElementById('gj-stage') || layerEl;

  stage.addEventListener('pointerdown', onPointerDown, { passive:true });
  stage.addEventListener('pointermove', onPointerMove, { passive:true });
  stage.addEventListener('pointerup', onPointerUp, { passive:true });
  stage.addEventListener('pointercancel', onPointerUp, { passive:true });
  stage.addEventListener('pointerleave', onPointerUp, { passive:true });

  // auto-try gyro on mobile; if needs permission, user will still be fine with drag
  if (isMobileLike()){
    tryEnableGyro().finally(()=>{
      window.addEventListener('deviceorientation', onOrientation, { passive:true });
    });
  }

  // If you want: tap crosshair to re-center drift
  if (crosshairEl){
    crosshairEl.addEventListener('click', ()=>{
      // recenter smoothly
      dxWant = 0; dyWant = 0;
      gyroReady = false; // re-baseline gyro
    }, { passive:true });
  }

  requestAnimationFrame(apply);

  // cleanup
  return function cleanup(){
    enabled = false;
    try{ window.removeEventListener('deviceorientation', onOrientation); }catch(_){}
    try{
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('pointerleave', onPointerUp);
    }catch(_){}
  };
}