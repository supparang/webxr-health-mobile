// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch / Drag + (optional) DeviceOrientation "VR-feel" world shift
// ✅ export attachTouchLook (แก้ error: does not provide an export named 'attachTouchLook')
// - shifts: layerEl (+ optional siblings) with ease
// - supports: mouse/touch drag on stage
// - supports: deviceorientation (best effort; iOS permission only when called from user gesture)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function getEl(x){
  if (!x) return null;
  if (typeof x === 'string') return document.querySelector(x);
  return x;
}

function canUseMotion(){
  return typeof ROOT.DeviceOrientationEvent !== 'undefined';
}

async function requestMotionPermissionIfNeeded(){
  try{
    const DOE = ROOT.DeviceOrientationEvent;
    if (!DOE || typeof DOE.requestPermission !== 'function') return true; // not iOS gated
    const r = await DOE.requestPermission();
    return (r === 'granted');
  }catch(_){
    return false;
  }
}

export function attachTouchLook(opts = {}){
  const DOC = ROOT.document;
  if (!DOC) return { detach(){}, requestMotionPermission: async()=>false };

  const stageEl = getEl(opts.stageEl) || DOC.getElementById('gj-stage') || DOC.body;
  const layerEl = getEl(opts.layerEl) || DOC.getElementById('gj-layer');
  const crosshairEl = getEl(opts.crosshairEl) || DOC.getElementById('gj-crosshair');

  // move these together to feel like "world"
  const extraEls = []
    .concat(getEl(opts.ringEl) || DOC.getElementById('atk-ring') || [])
    .concat(getEl(opts.laserEl) || DOC.getElementById('atk-laser') || [])
    .filter(Boolean);

  const moveEls = [layerEl].filter(Boolean).concat(extraEls);

  const aimY = clamp(opts.aimY ?? 0.62, 0.2, 0.9);
  const maxShiftPx = clamp(opts.maxShiftPx ?? 170, 40, 520);
  const ease = clamp(opts.ease ?? 0.12, 0.02, 0.35);

  // state
  let alive = true;
  let dragging = false;
  let startX = 0, startY = 0;
  let baseTX = 0, baseTY = 0;

  // desired shift
  let tx = 0, ty = 0;
  // smoothed
  let sx = 0, sy = 0;

  // motion
  let useMotion = !!opts.useMotion;
  let motionGranted = false;
  let gamma = 0, beta = 0;

  function apply(){
    if (!alive) return;
    // smooth
    sx += (tx - sx) * ease;
    sy += (ty - sy) * ease;

    const t = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0)`;
    for (const el of moveEls){
      if (!el) continue;
      el.style.transform = t;
    }

    ROOT.requestAnimationFrame(apply);
  }

  function setByDrag(dx, dy){
    // invert a bit for "world shift"
    tx = clamp(baseTX + dx * 0.65, -maxShiftPx, maxShiftPx);
    ty = clamp(baseTY + dy * 0.65, -maxShiftPx, maxShiftPx);
  }

  function onPointerDown(e){
    if (!alive) return;
    // don't start drag on HUD buttons
    const target = e.target;
    if (target && (target.closest('.hha-controls') || target.closest('.hha-hud') || target.closest('#startOverlay'))) return;

    dragging = true;
    try{ stageEl.setPointerCapture?.(e.pointerId); }catch(_){}
    startX = e.clientX; startY = e.clientY;
    baseTX = tx; baseTY = ty;
  }
  function onPointerMove(e){
    if (!alive || !dragging) return;
    const dx = (e.clientX - startX);
    const dy = (e.clientY - startY);
    setByDrag(dx, dy);
  }
  function onPointerUp(e){
    if (!alive) return;
    dragging = false;
    try{ stageEl.releasePointerCapture?.(e.pointerId); }catch(_){}
  }

  function onDeviceOrientation(e){
    if (!alive) return;
    gamma = Number(e.gamma)||0; // left-right (-90..90)
    beta  = Number(e.beta)||0;  // front-back (-180..180)
    // map to pixels
    const gx = clamp(gamma / 25, -1, 1);
    const by = clamp(beta  / 35, -1, 1);

    // bias Y so that aim point feels stable around crosshair
    const yBias = (aimY - 0.5) * 0.35;

    const mx = gx * maxShiftPx;
    const my = (by + yBias) * maxShiftPx;

    // blend with drag if dragging; otherwise follow motion
    if (!dragging){
      tx = clamp(mx, -maxShiftPx, maxShiftPx);
      ty = clamp(my, -maxShiftPx, maxShiftPx);
    }
  }

  // public: call this INSIDE a user gesture (e.g. start button) on iOS
  async function requestMotionPermission(){
    if (!canUseMotion()) return false;
    const ok = await requestMotionPermissionIfNeeded();
    motionGranted = ok;
    if (ok){
      try{ ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true }); }catch(_){}
    }
    return ok;
  }

  // bind drag
  try{
    stageEl.addEventListener('pointerdown', onPointerDown, { passive:true });
    stageEl.addEventListener('pointermove', onPointerMove, { passive:true });
    stageEl.addEventListener('pointerup', onPointerUp, { passive:true });
    stageEl.addEventListener('pointercancel', onPointerUp, { passive:true });
  }catch(_){}

  // auto motion if asked (non-iOS usually ok)
  if (useMotion){
    // this may not work on iOS unless permission is granted in gesture
    try{
      ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
      motionGranted = true;
    }catch(_){}
  }

  // kick RAF
  ROOT.requestAnimationFrame(apply);

  // return detach
  return {
    requestMotionPermission,
    detach(){
      alive = false;
      try{
        stageEl.removeEventListener('pointerdown', onPointerDown);
        stageEl.removeEventListener('pointermove', onPointerMove);
        stageEl.removeEventListener('pointerup', onPointerUp);
        stageEl.removeEventListener('pointercancel', onPointerUp);
      }catch(_){}
      try{ ROOT.removeEventListener('deviceorientation', onDeviceOrientation); }catch(_){}
      // reset transforms
      for (const el of moveEls){
        try{ el.style.transform = ''; }catch(_){}
      }
    }
  };
}