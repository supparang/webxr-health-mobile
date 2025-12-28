// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro "VR-feel look" for DOM overlay games (GoodJunk)
// ✅ ESM export: attachTouchLook
// ✅ drag-to-look (pointer) + optional gyro
// ✅ smooth easing, clamp, safe on iOS (permission request helper)
// Usage: const ctl = attachTouchLook({ stageEl, maxShiftPx, ease, enableGyro:true });
//        await ctl.requestGyroPermission?.()

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

export function attachTouchLook(opts = {}){
  const stageEl = opts.stageEl || ROOT.document?.getElementById('gj-stage');
  if (!stageEl) {
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

  // prepare stage
  stageEl.style.willChange = 'transform';
  stageEl.style.transform = 'translate3d(0px,0px,0px)';
  stageEl.style.transformOrigin = '50% 50%';

  // apply helper
  function apply(){
    if (!running) return;

    const tx = clamp((dragTargetX + gyroTargetX), -maxShiftPx, maxShiftPx);
    const ty = clamp((dragTargetY + gyroTargetY), -maxShiftPx, maxShiftPx);

    curX += (tx - curX) * ease;
    curY += (ty - curY) * ease;

    // write both transform + css vars (optional usage)
    stageEl.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
    stageEl.style.setProperty('--lookX', `${curX.toFixed(2)}px`);
    stageEl.style.setProperty('--lookY', `${curY.toFixed(2)}px`);

    ROOT.requestAnimationFrame(apply);
  }
  ROOT.requestAnimationFrame(apply);

  // pointer (drag)
  function onDown(ev){
    if (!running) return;
    dragging = true;

    const pt = getPt(ev);
    p0x = pt.x; p0y = pt.y;
    dragBaseX = dragTargetX;
    dragBaseY = dragTargetY;

    try{ stageEl.setPointerCapture?.(ev.pointerId); }catch(_){}
  }
  function onMove(ev){
    if (!running || !dragging) return;
    const pt = getPt(ev);
    const dx = pt.x - p0x;
    const dy = pt.y - p0y;

    // “ลากแล้วโลกเลื่อน” 느낌 VR
    const sx = invertX ? -dx : dx;
    const sy = invertY ? -dy : dy;

    dragTargetX = clamp(dragBaseX + sx, -maxShiftPx, maxShiftPx);
    dragTargetY = clamp(dragBaseY + sy, -maxShiftPx, maxShiftPx);
  }
  function onUp(ev){
    if (!running) return;
    dragging = false;

    // soften return a bit (optional)
    dragTargetX *= 0.92;
    dragTargetY *= 0.92;

    try{ stageEl.releasePointerCapture?.(ev.pointerId); }catch(_){}
  }

  function getPt(ev){
    const x = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX) || 0;
    const y = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY) || 0;
    return { x, y };
  }

  stageEl.addEventListener('pointerdown', onDown, { passive:true });
  stageEl.addEventListener('pointermove', onMove, { passive:true });
  stageEl.addEventListener('pointerup', onUp, { passive:true });
  stageEl.addEventListener('pointercancel', onUp, { passive:true });

  // gyro mapping
  function onOrientation(e){
    if (!running || !gyroOn) return;

    // gamma: left/right (-90..90), beta: front/back (-180..180)
    const g = Number(e.gamma);
    const b = Number(e.beta);

    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    // normalize to [-1..1] with gentle clamp
    const nx = clamp(g / 30, -1, 1);
    const ny = clamp((b - 15) / 30, -1, 1); // slight forward bias for comfortable view

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
      // iOS 13+
      const DOE = ROOT.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function'){
        const res = await DOE.requestPermission();
        if (String(res).toLowerCase() === 'granted'){
          startGyro();
          return true;
        }
        return false;
      }
      // other platforms
      startGyro();
      return true;
    }catch(_){
      return false;
    }
  }

  // auto start gyro on non-iOS (no permission)
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
      stageEl.removeEventListener('pointerdown', onDown);
      stageEl.removeEventListener('pointermove', onMove);
      stageEl.removeEventListener('pointerup', onUp);
      stageEl.removeEventListener('pointercancel', onUp);
      try{ stageEl.style.transform = 'translate3d(0px,0px,0px)'; }catch(_){}
    },
    get(){ return { x:curX, y:curY, dragging, gyroOn }; }
  };
}