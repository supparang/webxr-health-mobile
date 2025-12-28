// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro "VR-feel look" for DOM overlay games (GoodJunk)
// ✅ ESM export: attachTouchLook
// ✅ gestureEl = รับลาก/gyro
// ✅ applyEls = รายการ element ที่ต้องเลื่อนพร้อมกัน (stereo L/R)
// ✅ safe on iOS (permission request helper)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

export function attachTouchLook(opts = {}){
  const DOC = ROOT.document;
  const gestureEl = opts.gestureEl || DOC?.getElementById('gj-gesture') || DOC?.body;
  const applyEls = Array.isArray(opts.applyEls) && opts.applyEls.length
    ? opts.applyEls.filter(Boolean)
    : [ opts.applyEl || opts.stageEl || DOC?.getElementById('gj-stage') ].filter(Boolean);

  if (!gestureEl || !applyEls.length){
    return {
      requestGyroPermission: async()=>false,
      destroy(){},
      get(){ return { x:0, y:0 }; }
    };
  }

  const maxShiftPx = clamp(opts.maxShiftPx ?? 170, 40, 360);
  const ease = clamp(opts.ease ?? 0.12, 0.02, 0.4);
  const enableGyro = (opts.enableGyro !== false);
  const invertX = !!opts.invertX;
  const invertY = !!opts.invertY;

  // internal state
  let running = true;

  // drag state
  let dragging = false;
  let p0x = 0, p0y = 0;
  let dragBaseX = 0, dragBaseY = 0;
  let dragTargetX = 0, dragTargetY = 0;

  // gyro state
  let gyroOn = false;
  let gyroTargetX = 0, gyroTargetY = 0;

  // applied (smoothed)
  let curX = 0, curY = 0;

  // prep applyEls
  for (const el of applyEls){
    try{
      el.style.willChange = 'transform';
      el.style.transform = 'translate3d(0px,0px,0px)';
      el.style.transformOrigin = '50% 50%';
    }catch(_){}
  }

  function apply(){
    if (!running) return;

    const tx = clamp((dragTargetX + gyroTargetX), -maxShiftPx, maxShiftPx);
    const ty = clamp((dragTargetY + gyroTargetY), -maxShiftPx, maxShiftPx);

    curX += (tx - curX) * ease;
    curY += (ty - curY) * ease;

    // write css vars to <body> for FX usage
    try{
      DOC?.body?.style?.setProperty('--lookX', `${curX.toFixed(2)}px`);
      DOC?.body?.style?.setProperty('--lookY', `${curY.toFixed(2)}px`);
    }catch(_){}

    // apply transform to all targets worlds (L/R)
    for (const el of applyEls){
      try{
        el.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
      }catch(_){}
    }

    ROOT.requestAnimationFrame(apply);
  }
  ROOT.requestAnimationFrame(apply);

  function getPt(ev){
    const x = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX) || 0;
    const y = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY) || 0;
    return { x, y };
  }

  function onDown(ev){
    if (!running) return;
    dragging = true;

    const pt = getPt(ev);
    p0x = pt.x; p0y = pt.y;
    dragBaseX = dragTargetX;
    dragBaseY = dragTargetY;

    try{ gestureEl.setPointerCapture?.(ev.pointerId); }catch(_){}
  }

  function onMove(ev){
    if (!running || !dragging) return;
    const pt = getPt(ev);
    const dx = pt.x - p0x;
    const dy = pt.y - p0y;

    const sx = invertX ? -dx : dx;
    const sy = invertY ? -dy : dy;

    dragTargetX = clamp(dragBaseX + sx, -maxShiftPx, maxShiftPx);
    dragTargetY = clamp(dragBaseY + sy, -maxShiftPx, maxShiftPx);
  }

  function onUp(ev){
    if (!running) return;
    dragging = false;

    // soften return a bit
    dragTargetX *= 0.92;
    dragTargetY *= 0.92;

    try{ gestureEl.releasePointerCapture?.(ev.pointerId); }catch(_){}
  }

  gestureEl.addEventListener('pointerdown', onDown, { passive:true });
  gestureEl.addEventListener('pointermove', onMove, { passive:true });
  gestureEl.addEventListener('pointerup', onUp, { passive:true });
  gestureEl.addEventListener('pointercancel', onUp, { passive:true });

  // gyro mapping
  function onOrientation(e){
    if (!running || !gyroOn) return;

    const g = Number(e.gamma);
    const b = Number(e.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    const nx = clamp(g / 30, -1, 1);
    const ny = clamp((b - 15) / 30, -1, 1);

    const sx = invertX ? -nx : nx;
    const sy = invertY ? -ny : ny;

    gyroTargetX = sx * (maxShiftPx * 0.70);
    gyroTargetY = sy * (maxShiftPx * 0.55);
  }

  function startGyro(){
    if (!enableGyro) return false;
    if (gyroOn) return true;
    gyroOn = true;
    gyroTargetX = 0; gyroTargetY = 0;
    ROOT.addEventListener('deviceorientation', onOrientation, { passive:true });
    return true;
  }

  function stopGyro(){
    if (!gyroOn) return;
    gyroOn = false;
    gyroTargetX = 0; gyroTargetY = 0;
    try{ ROOT.removeEventListener('deviceorientation', onOrientation); }catch(_){}
  }

  async function requestGyroPermission(){
    try{
      const DOE = ROOT.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function'){
        const res = await DOE.requestPermission();
        if (String(res).toLowerCase() === 'granted'){
          startGyro();
          return true;
        }
        return false;
      }
      startGyro();
      return true;
    }catch(_){
      return false;
    }
  }

  // auto start gyro on non-iOS
  try{
    const DOE = ROOT.DeviceOrientationEvent;
    if (enableGyro && !(DOE && typeof DOE.requestPermission === 'function')){
      startGyro();
    }
  }catch(_){}

  return {
    requestGyroPermission,
    destroy(){
      running = false;
      stopGyro();
      gestureEl.removeEventListener('pointerdown', onDown);
      gestureEl.removeEventListener('pointermove', onMove);
      gestureEl.removeEventListener('pointerup', onUp);
      gestureEl.removeEventListener('pointercancel', onUp);
      for (const el of applyEls){
        try{ el.style.transform = 'translate3d(0px,0px,0px)'; }catch(_){}
      }
      try{
        ROOT.document?.body?.style?.setProperty('--lookX', '0px');
        ROOT.document?.body?.style?.setProperty('--lookY', '0px');
      }catch(_){}
    },
    get(){ return { x:curX, y:curY, dragging, gyroOn }; }
  };
}