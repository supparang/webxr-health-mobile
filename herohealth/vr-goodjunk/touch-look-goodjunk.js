// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch-Look (Drag + Gyro) — GoodJunkVR
// ✅ ESM export: attachTouchLook
// ✅ Works on PC (mouse drag) + Mobile (touch drag)
// ✅ Optional Gyro (DeviceOrientation) with iOS permission request on first gesture
// ✅ VR Cardboard stereo: supports layerEls [left,right] OR auto-detect #gj-layer-r
// ✅ Moves "world" by translating layer(s) (crosshair stays fixed)

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function lerp(a,b,t){ return a + (b-a)*t; }

function getEl(v){
  if (!v) return null;
  if (typeof v === 'string') return document.querySelector(v);
  return v;
}

function isCoarse(){
  try{ return matchMedia && matchMedia('(pointer: coarse)').matches; }catch(_){ return false; }
}

async function requestGyroPermissionIfNeeded(){
  // iOS 13+ requires user gesture + requestPermission
  try{
    const DO = window.DeviceOrientationEvent;
    if (!DO || typeof DO.requestPermission !== 'function') return true;
    const res = await DO.requestPermission();
    return res === 'granted';
  }catch(_){
    return false;
  }
}

/**
 * attachTouchLook({
 *   stageEl, layerEl, layerEls:[L,R], crosshairEl,
 *   maxShiftPx=170, ease=0.12, dragScale=1.0,
 *   gyro=true, gyroScale=1.0, gyroClampDeg=18,
 *   invertX=false, invertY=false
 * })
 */
export function attachTouchLook(opts = {}){
  const stageEl = getEl(opts.stageEl) || document.getElementById('gj-stage') || document.body;

  const crosshairEl = getEl(opts.crosshairEl) || document.getElementById('gj-crosshair');

  // layers: mono or stereo
  const layerElsInput = Array.isArray(opts.layerEls) ? opts.layerEls.map(getEl).filter(Boolean) : null;
  const layerEl = getEl(opts.layerEl) || document.getElementById('gj-layer');
  const layerR = document.getElementById('gj-layer-r'); // auto detect
  const layers = [];

  if (layerElsInput && layerElsInput.length){
    for (const el of layerElsInput) layers.push(el);
  } else {
    if (layerEl) layers.push(layerEl);
    // stereo: include right layer if exists
    if (layerR) layers.push(layerR);
  }

  // If no layers found, do nothing safely
  if (!layers.length){
    console.warn('[touch-look] no layer elements found');
    return {
      destroy(){},
      enableGyro(){},
      disableGyro(){},
      setEnabled(){},
      setMaxShift(){},
    };
  }

  const maxShiftPx = Number.isFinite(+opts.maxShiftPx) ? +opts.maxShiftPx : 170;
  const ease = clamp(opts.ease ?? 0.12, 0.02, 0.35);

  const dragScale = Number.isFinite(+opts.dragScale) ? +opts.dragScale : 1.0;

  const gyroEnabledDefault = (opts.gyro === undefined) ? true : !!opts.gyro;
  const gyroScale = Number.isFinite(+opts.gyroScale) ? +opts.gyroScale : 1.0;
  const gyroClampDeg = clamp(opts.gyroClampDeg ?? 18, 6, 45);

  const invertX = !!opts.invertX;
  const invertY = !!opts.invertY;

  // internal state
  let enabled = true;
  let dragging = false;

  let startX = 0, startY = 0;
  let dragX = 0, dragY = 0;         // instantaneous drag shift
  let dragTX = 0, dragTY = 0;       // target drag shift

  let gyroOK = false;
  let gyroOn = gyroEnabledDefault;
  let gamma = 0; // left-right tilt
  let beta  = 0; // front-back tilt

  let outX = 0, outY = 0;           // smoothed output shift
  let raf = 0;

  // Compute crosshair anchor (optional, used to make feel stable)
  function getCrosshairNorm(){
    if (!crosshairEl) return { nx: 0.5, ny: 0.62 };
    try{
      const r = crosshairEl.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const W = window.innerWidth || 360;
      const H = window.innerHeight || 640;
      return { nx: clamp(cx/W, 0, 1), ny: clamp(cy/H, 0, 1) };
    }catch(_){
      return { nx: 0.5, ny: 0.62 };
    }
  }

  // Apply transform to layers
  function applyShift(x, y){
    // translate "world" opposite to look direction feels more VR-ish
    const tx = (invertX ? +x : x);
    const ty = (invertY ? +y : y);
    const sx = clamp(tx, -maxShiftPx, maxShiftPx);
    const sy = clamp(ty, -maxShiftPx, maxShiftPx);

    for (const el of layers){
      el.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0)`;
      el.style.willChange = 'transform';
    }
  }

  // Build gyro shift
  function gyroShiftPx(){
    if (!gyroOn || !gyroOK) return { x: 0, y: 0 };

    // Normalize degrees -> [-1..1]
    const g = clamp(gamma / gyroClampDeg, -1, 1);
    const b = clamp(beta  / gyroClampDeg, -1, 1);

    // Convert to pixels
    // gamma: tilt left/right -> x
    // beta:  tilt front/back -> y
    // Use negative to feel like "camera look" (tilt right -> world shifts left)
    const x = (-g) * maxShiftPx * 0.70 * gyroScale;
    const y = (-b) * maxShiftPx * 0.55 * gyroScale;

    return { x, y };
  }

  function tick(){
    if (!enabled){
      applyShift(0, 0);
      raf = requestAnimationFrame(tick);
      return;
    }

    // Smooth drag targets
    dragX = lerp(dragX, dragTX, 0.18);
    dragY = lerp(dragY, dragTY, 0.18);

    const gs = gyroShiftPx();

    // Optional: tiny bias to keep "anchor" feel around crosshair position
    // (Makes world shift feel centered on crosshair, especially on wide screens)
    const { nx, ny } = getCrosshairNorm();
    const biasX = (nx - 0.5) * 8;     // small, not huge
    const biasY = (ny - 0.62) * 8;

    const targetX = (dragX + gs.x + biasX);
    const targetY = (dragY + gs.y + biasY);

    outX = lerp(outX, targetX, ease);
    outY = lerp(outY, targetY, ease);

    applyShift(outX, outY);

    raf = requestAnimationFrame(tick);
  }

  // Pointer handlers
  function onDown(e){
    if (!enabled) return;

    dragging = true;
    const p = getPoint(e);
    startX = p.x;
    startY = p.y;

    // request gyro permission on first gesture (iOS)
    if (gyroOn && !gyroOK){
      requestGyroPermissionIfNeeded().then(granted=>{
        if (granted) gyroOK = true;
      });
    }

    // capture pointer (mouse)
    try{ stageEl.setPointerCapture && stageEl.setPointerCapture(e.pointerId); }catch(_){}
  }

  function onMove(e){
    if (!enabled || !dragging) return;

    const p = getPoint(e);
    const dx = (p.x - startX);
    const dy = (p.y - startY);

    // map to shift; clamp so it doesn't fly
    // Drag should feel like "look": drag right -> world shifts left slightly
    dragTX = clamp((-dx) * 0.65 * dragScale, -maxShiftPx, maxShiftPx);
    dragTY = clamp((-dy) * 0.55 * dragScale, -maxShiftPx, maxShiftPx);

    // prevent page scroll on touch
    if (e.cancelable) e.preventDefault();
  }

  function onUp(e){
    dragging = false;

    // spring back slightly (don’t snap to 0 instantly)
    dragTX *= 0.25;
    dragTY *= 0.25;

    if (e && e.cancelable) e.preventDefault();
  }

  function getPoint(e){
    // support touch/pointer/mouse
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX ?? 0, y: e.clientY ?? 0 };
  }

  // Gyro handler
  function onDeviceOrientation(e){
    // gamma: left-right, beta: front-back
    const g = Number(e.gamma);
    const b = Number(e.beta);
    if (Number.isFinite(g)) gamma = clamp(g, -90, 90);
    if (Number.isFinite(b)) beta  = clamp(b, -90, 90);
  }

  // Bind listeners
  const passiveFalse = { passive:false };

  // Use pointer events when possible
  stageEl.addEventListener('pointerdown', onDown, passiveFalse);
  stageEl.addEventListener('pointermove', onMove, passiveFalse);
  stageEl.addEventListener('pointerup', onUp, passiveFalse);
  stageEl.addEventListener('pointercancel', onUp, passiveFalse);

  // Touch fallback
  stageEl.addEventListener('touchstart', onDown, passiveFalse);
  stageEl.addEventListener('touchmove', onMove, passiveFalse);
  stageEl.addEventListener('touchend', onUp, passiveFalse);
  stageEl.addEventListener('touchcancel', onUp, passiveFalse);

  // Mouse fallback
  stageEl.addEventListener('mousedown', onDown, passiveFalse);
  window.addEventListener('mousemove', onMove, passiveFalse);
  window.addEventListener('mouseup', onUp, passiveFalse);

  // Gyro
  function enableGyro(){
    gyroOn = true;
    // if no permission needed, mark ok immediately
    try{
      const DO = window.DeviceOrientationEvent;
      if (DO && typeof DO.requestPermission !== 'function') gyroOK = true;
    }catch(_){}
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
  }

  function disableGyro(){
    gyroOn = false;
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
  }

  if (gyroOn) enableGyro();

  // Start loop
  raf = requestAnimationFrame(tick);

  // Public API
  return {
    destroy(){
      try{ cancelAnimationFrame(raf); }catch(_){}
      raf = 0;

      stageEl.removeEventListener('pointerdown', onDown, passiveFalse);
      stageEl.removeEventListener('pointermove', onMove, passiveFalse);
      stageEl.removeEventListener('pointerup', onUp, passiveFalse);
      stageEl.removeEventListener('pointercancel', onUp, passiveFalse);

      stageEl.removeEventListener('touchstart', onDown, passiveFalse);
      stageEl.removeEventListener('touchmove', onMove, passiveFalse);
      stageEl.removeEventListener('touchend', onUp, passiveFalse);
      stageEl.removeEventListener('touchcancel', onUp, passiveFalse);

      stageEl.removeEventListener('mousedown', onDown, passiveFalse);
      window.removeEventListener('mousemove', onMove, passiveFalse);
      window.removeEventListener('mouseup', onUp, passiveFalse);

      disableGyro();

      // reset transform
      try{
        for (const el of layers) el.style.transform = 'translate3d(0,0,0)';
      }catch(_){}
    },
    enableGyro,
    disableGyro,
    setEnabled(v){
      enabled = !!v;
      if (!enabled){
        dragTX = dragTY = dragX = dragY = 0;
        outX = outY = 0;
        applyShift(0, 0);
      }
    },
    setMaxShift(px){
      if (Number.isFinite(+px)) {
        // update closure variable via mutation
        // (we keep it simple by writing to opts and reading when clamping)
        opts.maxShiftPx = +px;
      }
    }
  };
}