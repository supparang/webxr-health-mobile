// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro look (DOM world shift) for GoodJunkVR
// ✅ ESM export: attachTouchLook
// ✅ Touch drag (mobile) + DeviceOrientation (gyro) if available
// ✅ Smooth easing + clamp maxShiftPx
// ✅ Applies translate3d to layerEl (and optional extraEls)
// ✅ Also sets crosshair top via aimY (0..1)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

export function attachTouchLook(opts = {}){
  const DOC = ROOT.document;
  if (!DOC) return { destroy(){} };

  const layerEl = opts.layerEl || DOC.getElementById('gj-layer');
  const crosshairEl = opts.crosshairEl || DOC.getElementById('gj-crosshair');

  if (!layerEl) return { destroy(){} };

  const aimY = clamp(opts.aimY ?? 0.62, 0.20, 0.86);
  const maxShiftPx = clamp(opts.maxShiftPx ?? 170, 30, 420);
  const ease = clamp(opts.ease ?? 0.12, 0.02, 0.35);

  // If you want hazards to follow world shift too:
  const extraEls = Array.isArray(opts.extraEls) ? opts.extraEls : [
    DOC.getElementById('atk-ring'),
    DOC.getElementById('atk-laser')
  ].filter(Boolean);

  // crosshair vertical placement
  try{
    if (crosshairEl) crosshairEl.style.top = (aimY * 100).toFixed(1) + '%';
  }catch(_){}

  let dragOn = false;
  let dragStartX = 0, dragStartY = 0;
  let dragDx = 0, dragDy = 0;

  // gyro
  let gyroOn = false;
  let gyroX = 0, gyroY = 0; // normalized -1..1
  let hasOri = false;

  // target/current
  let tx = 0, ty = 0;
  let cx = 0, cy = 0;

  // prevent double attach
  if (layerEl.__HHA_TOUCHLOOK__) {
    try{ layerEl.__HHA_TOUCHLOOK__.destroy(); }catch(_){}
  }

  function applyTransform(x, y){
    const sx = clamp(x, -maxShiftPx, maxShiftPx);
    const sy = clamp(y, -maxShiftPx, maxShiftPx);
    const t = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0)`;
    layerEl.style.transform = t;
    for (const el of extraEls){
      try{ el.style.transform = t; }catch(_){}
    }
  }

  function isCoarse(){
    try{ return ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches; }catch(_){}
    return false;
  }

  function onPointerDown(e){
    dragOn = true;
    dragStartX = e.clientX || 0;
    dragStartY = e.clientY || 0;
    dragDx = 0; dragDy = 0;
    try{ layerEl.setPointerCapture && layerEl.setPointerCapture(e.pointerId); }catch(_){}
  }
  function onPointerMove(e){
    if (!dragOn) return;
    const x = e.clientX || 0;
    const y = e.clientY || 0;
    dragDx = x - dragStartX;
    dragDy = y - dragStartY;
  }
  function onPointerUp(e){
    dragOn = false;
    try{ layerEl.releasePointerCapture && layerEl.releasePointerCapture(e.pointerId); }catch(_){}
    // keep a little inertia-like offset? (optional) — here we just decay in RAF
  }

  // gyro handler
  function onDeviceOrientation(e){
    hasOri = true;
    // gamma: left-right (-90..90), beta: front-back (-180..180)
    const g = Number(e.gamma);
    const b = Number(e.beta);

    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    // normalize to -1..1 (gentle)
    const nx = clamp(g / 30, -1, 1);
    const ny = clamp((b - 10) / 35, -1, 1); // slight bias so "neutral" feels centered

    gyroX = nx;
    gyroY = ny;
  }

  // Try enable gyro on first user gesture (iOS needs permission)
  async function tryEnableGyro(){
    try{
      const DO = ROOT.DeviceOrientationEvent;
      if (DO && typeof DO.requestPermission === 'function'){
        const r = await DO.requestPermission();
        gyroOn = (r === 'granted');
      } else {
        gyroOn = true;
      }
    }catch(_){
      gyroOn = false;
    }

    if (gyroOn){
      ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
    }
  }

  // bind
  layerEl.addEventListener('pointerdown', onPointerDown, { passive:true });
  ROOT.addEventListener('pointermove', onPointerMove, { passive:true });
  ROOT.addEventListener('pointerup', onPointerUp, { passive:true });
  ROOT.addEventListener('pointercancel', onPointerUp, { passive:true });

  // For mobile: try gyro after first tap anywhere
  const unlockGyroOnce = async ()=>{
    ROOT.removeEventListener('pointerdown', unlockGyroOnce, true);
    await tryEnableGyro();
  };
  ROOT.addEventListener('pointerdown', unlockGyroOnce, true);

  // RAF loop
  let raf = 0;
  function tick(){
    // drag contribution (scaled)
    const dragScale = isCoarse() ? 0.55 : 0.35;
    const dx = clamp(dragDx * dragScale, -maxShiftPx, maxShiftPx);
    const dy = clamp(dragDy * dragScale, -maxShiftPx, maxShiftPx);

    // gyro contribution
    const gyroScale = maxShiftPx * (isCoarse() ? 0.55 : 0.40);
    const gx = gyroOn ? (gyroX * gyroScale) : 0;
    const gy = gyroOn ? (gyroY * gyroScale) : 0;

    // target offset
    tx = dx + gx;
    ty = dy + gy;

    // smooth
    cx = cx + (tx - cx) * ease;
    cy = cy + (ty - cy) * ease;

    // decay drag slowly when finger up
    if (!dragOn){
      dragDx *= 0.90;
      dragDy *= 0.90;
      if (Math.abs(dragDx) < 0.05) dragDx = 0;
      if (Math.abs(dragDy) < 0.05) dragDy = 0;
    }

    applyTransform(cx, cy);
    raf = ROOT.requestAnimationFrame(tick);
  }
  raf = ROOT.requestAnimationFrame(tick);

  const api = {
    destroy(){
      try{ ROOT.cancelAnimationFrame(raf); }catch(_){}
      try{ layerEl.removeEventListener('pointerdown', onPointerDown); }catch(_){}
      try{ ROOT.removeEventListener('pointermove', onPointerMove); }catch(_){}
      try{ ROOT.removeEventListener('pointerup', onPointerUp); }catch(_){}
      try{ ROOT.removeEventListener('pointercancel', onPointerUp); }catch(_){}
      try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation); }catch(_){}
      try{ ROOT.removeEventListener('pointerdown', unlockGyroOnce, true); }catch(_){}
      try{ layerEl.style.transform = ''; }catch(_){}
      for (const el of extraEls){
        try{ el.style.transform = ''; }catch(_){}
      }
      try{ delete layerEl.__HHA_TOUCHLOOK__; }catch(_){}
    }
  };

  layerEl.__HHA_TOUCHLOOK__ = api;
  return api;
}