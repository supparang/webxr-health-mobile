// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch / Look helper for GoodJunkVR (ESM)
// ✅ export attachTouchLook
// ✅ Shift world element (#gj-world) with drag + optional gyro
// ✅ requestMotionPermission() for iOS
// ✅ Smooth easing

'use strict';

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

export function attachTouchLook(opts = {}){
  const doc = (typeof document !== 'undefined') ? document : null;
  const win = (typeof window !== 'undefined') ? window : null;
  if (!doc || !win) return { requestMotionPermission: async()=>false };

  const stageEl = opts.stageEl || doc.getElementById('gj-stage') || doc.body;
  const layerEl = opts.layerEl || doc.getElementById('gj-world') || doc.getElementById('gj-layer') || doc.body;

  const maxShiftPx = Number(opts.maxShiftPx ?? 170);
  const ease = clamp(Number(opts.ease ?? 0.12), 0.02, 0.35);

  // crosshair is only used for “feel” (not required)
  const crosshairEl = opts.crosshairEl || doc.getElementById('gj-crosshair');

  // internal state
  let dragging = false;
  let startX = 0, startY = 0;
  let dragDX = 0, dragDY = 0;

  let tgtX = 0, tgtY = 0; // target shift
  let curX = 0, curY = 0; // eased shift
  let raf = 0;

  // gyro
  let useMotion = !!opts.useMotion;  // default false in your boot, can be turned on later
  let motionGranted = false;
  let gyroX = 0, gyroY = 0;
  let gyroBaseSet = false;
  let baseGamma = 0, baseBeta = 0;

  function applyTransform(){
    // Ease toward target
    curX += (tgtX - curX) * ease;
    curY += (tgtY - curY) * ease;

    const x = clamp(curX, -maxShiftPx, maxShiftPx);
    const y = clamp(curY, -maxShiftPx, maxShiftPx);

    layerEl.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;

    raf = win.requestAnimationFrame(applyTransform);
  }

  function ensureRAF(){
    if (!raf) raf = win.requestAnimationFrame(applyTransform);
  }

  function stopRAF(){
    if (raf){ win.cancelAnimationFrame(raf); raf = 0; }
  }

  function setTargetFromInputs(){
    // combine drag + gyro
    const gx = useMotion ? gyroX : 0;
    const gy = useMotion ? gyroY : 0;

    tgtX = clamp(dragDX + gx, -maxShiftPx, maxShiftPx);
    tgtY = clamp(dragDY + gy, -maxShiftPx, maxShiftPx);
  }

  function onPointerDown(e){
    if (!stageEl) return;
    dragging = true;
    const p = getPoint(e);
    startX = p.x;
    startY = p.y;
    stageEl.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e){
    if (!dragging) return;
    const p = getPoint(e);
    const dx = p.x - startX;
    const dy = p.y - startY;

    // invert a bit so drag “moves camera”
    dragDX = clamp(dx * 0.55, -maxShiftPx, maxShiftPx);
    dragDY = clamp(dy * 0.55, -maxShiftPx, maxShiftPx);

    setTargetFromInputs();
    ensureRAF();
  }

  function onPointerUp(e){
    dragging = false;
    stageEl.releasePointerCapture?.(e.pointerId);

    // spring back a little (don’t snap to 0, feels VR-ish)
    dragDX *= 0.35;
    dragDY *= 0.35;

    setTargetFromInputs();
    ensureRAF();
  }

  function getPoint(e){
    if (e.touches && e.touches[0]){
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX ?? 0, y: e.clientY ?? 0 };
  }

  function onDeviceOrientation(ev){
    if (!useMotion) return;
    // gamma: left-right tilt, beta: front-back tilt
    const gamma = Number(ev.gamma ?? 0);
    const beta  = Number(ev.beta  ?? 0);

    if (!gyroBaseSet){
      gyroBaseSet = true;
      baseGamma = gamma;
      baseBeta = beta;
    }

    // delta tilt from baseline
    let dg = gamma - baseGamma;
    let db = beta  - baseBeta;

    // clamp to reasonable angles
    dg = clamp(dg, -25, 25);
    db = clamp(db, -25, 25);

    // map angle -> px
    gyroX = clamp(dg * (maxShiftPx / 28), -maxShiftPx, maxShiftPx);
    gyroY = clamp(db * (maxShiftPx / 32), -maxShiftPx, maxShiftPx);

    setTargetFromInputs();
    ensureRAF();
  }

  async function requestMotionPermission(){
    try{
      // iOS 13+ requires user gesture + permission request
      const DOE = win.DeviceOrientationEvent;
      if (!DOE) return false;

      if (typeof DOE.requestPermission === 'function'){
        const res = await DOE.requestPermission();
        motionGranted = (String(res).toLowerCase() === 'granted');
      } else {
        motionGranted = true;
      }

      if (motionGranted){
        useMotion = true;
        gyroBaseSet = false;
        win.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
        ensureRAF();
        return true;
      }
      return false;
    }catch(_){
      return false;
    }
  }

  // Bind
  if (stageEl){
    stageEl.style.touchAction = 'none';

    stageEl.addEventListener('pointerdown', onPointerDown, { passive:false });
    stageEl.addEventListener('pointermove', onPointerMove, { passive:false });
    stageEl.addEventListener('pointerup', onPointerUp, { passive:false });
    stageEl.addEventListener('pointercancel', onPointerUp, { passive:false });

    // fallback touch
    stageEl.addEventListener('touchstart', onPointerDown, { passive:false });
    stageEl.addEventListener('touchmove', onPointerMove, { passive:false });
    stageEl.addEventListener('touchend', onPointerUp, { passive:false });
  }

  // Start RAF (idle)
  ensureRAF();

  // Public API
  return {
    requestMotionPermission,
    setUseMotion(v){
      useMotion = !!v;
      if (!useMotion){
        gyroX = 0; gyroY = 0;
        setTargetFromInputs();
      }
    },
    reset(){
      dragDX = dragDY = 0;
      gyroX = gyroY = 0;
      tgtX = tgtY = 0;
      curX = curY = 0;
      layerEl.style.transform = 'translate3d(0px,0px,0)';
    },
    destroy(){
      stopRAF();
      try{
        stageEl.removeEventListener('pointerdown', onPointerDown);
        stageEl.removeEventListener('pointermove', onPointerMove);
        stageEl.removeEventListener('pointerup', onPointerUp);
        stageEl.removeEventListener('pointercancel', onPointerUp);
        stageEl.removeEventListener('touchstart', onPointerDown);
        stageEl.removeEventListener('touchmove', onPointerMove);
        stageEl.removeEventListener('touchend', onPointerUp);
      }catch(_){}
      try{ win.removeEventListener('deviceorientation', onDeviceOrientation); }catch(_){}
    }
  };
}