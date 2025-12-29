// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro look for GoodJunkVR (ESM)
// ✅ export attachTouchLook
// ✅ supports layerEl or layerEls[] (cardboard)
// ✅ iOS DeviceOrientation permission helper

export function attachTouchLook(opts = {}) {
  const DOC = document;
  const layerEls = Array.isArray(opts.layerEls)
    ? opts.layerEls.filter(Boolean)
    : (opts.layerEl ? [opts.layerEl] : []);
  const crosshairEl = opts.crosshairEl || null;

  const maxShiftPx = Number(opts.maxShiftPx ?? 170);
  const ease = Number(opts.ease ?? 0.12);

  let enabled = true;

  // drag state
  let dragging = false;
  let startX = 0, startY = 0;
  let baseX = 0, baseY = 0;

  // target shift (from drag + gyro)
  let tX = 0, tY = 0;
  let cX = 0, cY = 0;

  // gyro state
  let gyroOn = false;
  let gX = 0, gY = 0;

  function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function applyShift(x, y){
    for (const el of layerEls){
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      el.style.willChange = 'transform';
    }
  }

  function onPointerDown(e){
    if (!enabled) return;
    dragging = true;
    startX = e.clientX || 0;
    startY = e.clientY || 0;
    baseX = tX;
    baseY = tY;
  }
  function onPointerMove(e){
    if (!enabled || !dragging) return;
    const dx = (e.clientX||0) - startX;
    const dy = (e.clientY||0) - startY;
    // invert feel slightly VR-like (drag to “move world”)
    tX = clamp(baseX + dx * 0.55, -maxShiftPx, maxShiftPx);
    tY = clamp(baseY + dy * 0.55, -maxShiftPx, maxShiftPx);
  }
  function onPointerUp(){
    dragging = false;
  }

  // Map device orientation -> shift
  function onDeviceOri(e){
    if (!enabled || !gyroOn) return;

    // gamma: left/right [-90..90], beta: front/back [-180..180]
    const gamma = Number(e.gamma || 0);
    const beta  = Number(e.beta  || 0);

    // normalize to [-1..1] around comfortable range
    const nx = clamp(gamma / 35, -1, 1);
    const ny = clamp((beta - 15) / 35, -1, 1); // a bit forward bias

    gX = nx * maxShiftPx * 0.85;
    gY = ny * maxShiftPx * 0.65;
  }

  function tick(){
    // blend drag + gyro
    const wantX = clamp(tX + gX, -maxShiftPx, maxShiftPx);
    const wantY = clamp(tY + gY, -maxShiftPx, maxShiftPx);

    cX += (wantX - cX) * ease;
    cY += (wantY - cY) * ease;

    applyShift(cX, cY);

    raf = requestAnimationFrame(tick);
  }

  // iOS permission helper
  async function requestGyroPermission(){
    try{
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return true;

      // iOS 13+
      if (typeof DOE.requestPermission === 'function'){
        const res = await DOE.requestPermission();
        return res === 'granted';
      }
      return true;
    }catch(_){
      return false;
    }
  }

  async function enableGyro(){
    const ok = await requestGyroPermission();
    if (!ok) return false;

    if (!gyroOn){
      gyroOn = true;
      window.addEventListener('deviceorientation', onDeviceOri, { passive:true });
    }
    return true;
  }

  function disableGyro(){
    gyroOn = false;
    window.removeEventListener('deviceorientation', onDeviceOri);
    gX = 0; gY = 0;
  }

  function setEnabled(v){
    enabled = !!v;
    if (!enabled){
      dragging = false;
      disableGyro();
      tX = 0; tY = 0;
      gX = 0; gY = 0;
    }
  }

  function destroy(){
    setEnabled(false);
    DOC.removeEventListener('pointerdown', onPointerDown);
    DOC.removeEventListener('pointermove', onPointerMove);
    DOC.removeEventListener('pointerup', onPointerUp);
    DOC.removeEventListener('pointercancel', onPointerUp);
    try{ cancelAnimationFrame(raf); }catch(_){}
  }

  // bind drag on whole doc (world drag feel)
  DOC.addEventListener('pointerdown', onPointerDown, { passive:true });
  DOC.addEventListener('pointermove', onPointerMove, { passive:true });
  DOC.addEventListener('pointerup', onPointerUp, { passive:true });
  DOC.addEventListener('pointercancel', onPointerUp, { passive:true });

  let raf = requestAnimationFrame(tick);

  return { enableGyro, disableGyro, setEnabled, destroy };
}