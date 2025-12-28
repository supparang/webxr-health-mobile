// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro "VR-feel" look for DOM games (GoodJunkVR)
// ✅ ESM named export: attachTouchLook
// ✅ Touch drag: shift the world layer under crosshair
// ✅ Gyro (DeviceOrientation): subtle shift (mobile)
// ✅ iOS permission handled (request on first user gesture)
// ✅ Returns { destroy(), setEnabled(bool) }

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function isIOS(){
  const ua = String(navigator.userAgent||'');
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function requestIOSPermission(){
  // iOS 13+ requires user gesture + permission API
  try{
    const DO = ROOT.DeviceOrientationEvent;
    if (!DO || typeof DO.requestPermission !== 'function') return true;
    const res = await DO.requestPermission();
    return res === 'granted';
  }catch(_){
    return false;
  }
}

export function attachTouchLook(opts = {}){
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  const crosshairEl = opts.crosshairEl || document.getElementById('gj-crosshair');

  if (!layerEl){
    console.warn('[touch-look] missing layerEl');
    return { destroy(){}, setEnabled(){} };
  }

  const maxShiftPx = clamp(opts.maxShiftPx ?? 170, 40, 360);
  const ease = clamp(opts.ease ?? 0.12, 0.02, 0.40);

  // gyro tuning (subtle)
  const gyroScale = clamp(opts.gyroScale ?? 1.0, 0.2, 2.2);
  const gyroMax = clamp(opts.gyroMax ?? (maxShiftPx * 0.70), 20, maxShiftPx);

  // aimY (crosshair vertical feel) - you already position crosshair by CSS,
  // this value is mainly for future extensions, kept for API stability
  const aimY = clamp(opts.aimY ?? 0.62, 0.2, 0.85);

  let enabled = true;

  // target shift (what we want) + current (smoothed)
  let tx = 0, ty = 0;          // current
  let dx = 0, dy = 0;          // desired from input sum
  let dragX = 0, dragY = 0;    // desired from touch drag
  let gyroX = 0, gyroY = 0;    // desired from gyro

  // drag state
  let dragging = false;
  let sx = 0, sy = 0; // start pointer
  let bx = 0, by = 0; // base drag at start

  // gyro permission
  let gyroAllowed = !isIOS(); // non-iOS: usually ok
  let gyroBound = false;

  function apply(){
    // compose desired
    dx = clamp(dragX + gyroX, -maxShiftPx, maxShiftPx);
    dy = clamp(dragY + gyroY, -maxShiftPx, maxShiftPx);

    // smooth
    tx += (dx - tx) * ease;
    ty += (dy - ty) * ease;

    // apply transform to world layer
    // (crosshair stays fixed => feels like "look")
    layerEl.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;

    // optional: tiny parallax for hazards (if you want later)
    // const ring = document.getElementById('atk-ring'); if(ring) ring.style.transform = `translate(-50%,-50%) translate3d(${(tx*0.15).toFixed(2)}px, ${(ty*0.15).toFixed(2)}px, 0)`;

    if (enabled) ROOT.requestAnimationFrame(apply);
  }

  function onPointerDown(e){
    if (!enabled) return;
    // allow drag anywhere (stage/layer)
    dragging = true;
    sx = e.clientX; sy = e.clientY;
    bx = dragX; by = dragY;

    // iOS gyro permission: request on first gesture
    if (!gyroAllowed && isIOS()){
      requestIOSPermission().then(ok => {
        gyroAllowed = ok;
        if (ok && !gyroBound) bindGyro();
      });
    }
  }

  function onPointerMove(e){
    if (!enabled || !dragging) return;
    const mx = e.clientX, my = e.clientY;
    const ddx = (mx - sx);
    const ddy = (my - sy);

    // invert to feel like head-look (drag right moves world left)
    dragX = clamp(bx + (-ddx), -maxShiftPx, maxShiftPx);
    dragY = clamp(by + (-ddy), -maxShiftPx, maxShiftPx);
  }

  function onPointerUp(){
    dragging = false;
  }

  function onDeviceOrientation(ev){
    if (!enabled || !gyroAllowed) return;

    // gamma: left-right (-90..90), beta: front-back (-180..180)
    const g = Number(ev.gamma);
    const b = Number(ev.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    // map to pixels (subtle)
    // gamma to X, beta to Y (invert for feel)
    const gx = clamp((-g / 30) * gyroMax * gyroScale, -gyroMax, gyroMax);
    const gy = clamp((-(b - 10) / 40) * gyroMax * gyroScale, -gyroMax, gyroMax);

    // ease gyro separately
    gyroX += (gx - gyroX) * 0.16;
    gyroY += (gy - gyroY) * 0.16;
  }

  function bindGyro(){
    if (gyroBound) return;
    gyroBound = true;
    ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
  }

  // bind pointers on stage if exists, else window
  const stage = document.getElementById('gj-stage') || layerEl;
  stage.style.touchAction = 'none';

  stage.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  // non-iOS: bind gyro immediately (if wanted)
  if (!isIOS()) bindGyro();

  // kick loop
  ROOT.requestAnimationFrame(apply);

  return {
    destroy(){
      try{ stage.removeEventListener('pointerdown', onPointerDown); }catch(_){}
      try{ ROOT.removeEventListener('pointermove', onPointerMove); }catch(_){}
      try{ ROOT.removeEventListener('pointerup', onPointerUp); }catch(_){}
      try{ ROOT.removeEventListener('pointercancel', onPointerUp); }catch(_){}
      try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation); }catch(_){}
      enabled = false;
    },
    setEnabled(v){
      enabled = !!v;
      if (enabled) ROOT.requestAnimationFrame(apply);
    },
    setAimY(v){ /* reserved */ void(v); void(aimY); }
  };
}