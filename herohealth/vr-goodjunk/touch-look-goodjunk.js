// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// GoodJunkVR — Touch/Gyro Look (PRODUCTION)
// ✅ exports: attachTouchLook
// ✅ drag to pan (PC/mobile) + optional gyro (best effort)
// ✅ moves ONLY target layer (so HUD stays fixed)
// ✅ smooth easing + clamp + safe defaults
// ✅ iOS permission handling (request on first user gesture)

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b){
  v = Number(v) || 0;
  return Math.max(a, Math.min(b, v));
}

function now(){
  return (ROOT.performance && performance.now) ? performance.now() : Date.now();
}

/**
 * attachTouchLook({
 *   layerEl: HTMLElement (required),
 *   crosshairEl?: HTMLElement,
 *   stageEl?: HTMLElement (defaults to document.getElementById('gj-stage') or document.body),
 *   maxShiftPx?: number (default 170),
 *   ease?: number (0.08..0.25 default 0.12),
 *   aimY?: number (0..1 default 0.62)  // used only for optional helper API
 *   enableGyro?: boolean (default true),
 *   gyroScale?: number (default 0.85),
 *   invertX?: boolean (default false),
 *   invertY?: boolean (default false),
 *   deadzone?: number (default 0.02),
 * })
 *
 * returns { destroy(), getShift(), setShift(), requestGyroPermission() }
 */
export function attachTouchLook(opts = {}){
  const DOC = ROOT.document;
  const layerEl = opts.layerEl;
  if (!DOC || !layerEl) {
    console.warn('[touch-look-goodjunk] missing document or layerEl');
    return {
      destroy(){},
      getShift(){ return { x:0, y:0 }; },
      setShift(){},
      requestGyroPermission: async ()=>false
    };
  }

  const stageEl =
    opts.stageEl ||
    DOC.getElementById('gj-stage') ||
    DOC.body;

  const crosshairEl = opts.crosshairEl || null;

  const maxShiftPx = clamp(opts.maxShiftPx ?? 170, 40, 420);
  const ease = clamp(opts.ease ?? 0.12, 0.05, 0.35);

  const enableGyroDefault = (opts.enableGyro !== false);
  const gyroScale = clamp(opts.gyroScale ?? 0.85, 0.2, 2.2);

  const invertX = !!opts.invertX;
  const invertY = !!opts.invertY;
  const deadzone = clamp(opts.deadzone ?? 0.02, 0, 0.2);

  // ---------- internal state ----------
  let alive = true;

  // pointer drag shift (px)
  let pTargetX = 0, pTargetY = 0;
  let pX = 0, pY = 0;

  // gyro shift (px)
  let gTargetX = 0, gTargetY = 0;
  let gX = 0, gY = 0;

  // combined output (px)
  let outX = 0, outY = 0;

  let dragging = false;
  let pid = null;
  let startX = 0, startY = 0;
  let baseX = 0, baseY = 0;

  // gyro
  let gyroEnabled = false;
  let gyroGranted = false;
  let lastOriAt = 0;
  let baseGamma = null;
  let baseBeta = null;

  // perf
  let raf = 0;

  // ---------- helpers ----------
  function setLayerTransform(x, y){
    // Move ONLY the target layer; keep HUD fixed
    // GPU-friendly
    layerEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    layerEl.style.willChange = 'transform';
  }

  function apply(){
    // Smooth ease
    pX += (pTargetX - pX) * ease;
    pY += (pTargetY - pY) * ease;

    gX += (gTargetX - gX) * (ease * 0.9);
    gY += (gTargetY - gY) * (ease * 0.9);

    // combine + clamp
    const x = clamp(pX + gX, -maxShiftPx, maxShiftPx);
    const y = clamp(pY + gY, -maxShiftPx, maxShiftPx);

    outX += (x - outX) * (ease * 0.95);
    outY += (y - outY) * (ease * 0.95);

    setLayerTransform(outX, outY);

    if (alive) raf = ROOT.requestAnimationFrame(apply);
  }

  function getViewport(){
    const W = ROOT.innerWidth || 360;
    const H = ROOT.innerHeight || 640;
    return { W, H };
  }

  function toShiftFromDrag(dx, dy){
    const { W, H } = getViewport();
    // normalize drag to px shift
    const nx = dx / Math.max(240, W);
    const ny = dy / Math.max(240, H);

    let sx = nx * maxShiftPx * 1.35;
    let sy = ny * maxShiftPx * 1.35;

    if (invertX) sx = -sx;
    if (invertY) sy = -sy;

    return { sx, sy };
  }

  function stopDrag(){
    dragging = false;
    pid = null;
  }

  // ---------- pointer drag ----------
  function onPointerDown(e){
    if (!alive) return;
    // allow drag anywhere EXCEPT when pressing on a target itself (targets handle their own input)
    // but stage click-to-shoot still works because targets stopPropagation and this only starts on pointerdown.
    const t = e.target;
    if (t && t.classList && t.classList.contains('gj-target')) return;

    dragging = true;
    pid = e.pointerId;
    startX = e.clientX || 0;
    startY = e.clientY || 0;
    baseX = pTargetX;
    baseY = pTargetY;

    try{ stageEl.setPointerCapture?.(pid); }catch(_){}
  }

  function onPointerMove(e){
    if (!alive || !dragging) return;
    if (pid != null && e.pointerId != null && e.pointerId !== pid) return;

    const dx = (e.clientX || 0) - startX;
    const dy = (e.clientY || 0) - startY;

    const { sx, sy } = toShiftFromDrag(dx, dy);

    pTargetX = clamp(baseX + sx, -maxShiftPx, maxShiftPx);
    pTargetY = clamp(baseY + sy, -maxShiftPx, maxShiftPx);
  }

  function onPointerUp(e){
    if (!alive) return;
    if (pid != null && e.pointerId != null && e.pointerId !== pid) return;
    stopDrag();
  }

  // ---------- gyro (best effort) ----------
  function normSmall(v){
    // deadzone
    if (Math.abs(v) < deadzone) return 0;
    // soften edges
    return clamp(v, -1, 1);
  }

  function onDeviceOrientation(ev){
    if (!alive || !gyroEnabled) return;

    // gamma: left-right tilt (-90..90)
    // beta : front-back tilt (-180..180)
    const gamma = Number(ev.gamma);
    const beta  = Number(ev.beta);

    if (!Number.isFinite(gamma) || !Number.isFinite(beta)) return;

    const t = now();
    lastOriAt = t;

    // establish baseline at first valid reading
    if (baseGamma == null) baseGamma = gamma;
    if (baseBeta  == null) baseBeta  = beta;

    // delta in degrees
    let dg = (gamma - baseGamma) / 25; // tune sensitivity
    let db = (beta  - baseBeta)  / 25;

    dg = normSmall(dg);
    db = normSmall(db);

    // map to px
    let gx = dg * maxShiftPx * gyroScale;
    let gy = db * maxShiftPx * gyroScale;

    // usually beta forward tilt should move view "up" a bit (feel VR-ish)
    // so invert Y by default? keep neutral; let opts.invertY control.
    if (invertX) gx = -gx;
    if (invertY) gy = -gy;

    // clamp
    gTargetX = clamp(gx, -maxShiftPx, maxShiftPx);
    gTargetY = clamp(gy, -maxShiftPx, maxShiftPx);
  }

  async function requestGyroPermission(){
    if (!enableGyroDefault) return false;

    try{
      const DOE = ROOT.DeviceOrientationEvent;
      if (!DOE) return false;

      // iOS requires user gesture + requestPermission
      if (typeof DOE.requestPermission === 'function'){
        const res = await DOE.requestPermission();
        gyroGranted = (String(res).toLowerCase() === 'granted');
        gyroEnabled = gyroGranted;
        if (gyroEnabled){
          ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
        }
        return gyroEnabled;
      }

      // other browsers: no permission API needed
      gyroGranted = true;
      gyroEnabled = true;
      ROOT.addEventListener('deviceorientation', onDeviceOrientation, { passive:true });
      return true;
    }catch(_){
      gyroEnabled = false;
      gyroGranted = false;
      return false;
    }
  }

  // ask permission automatically on first user gesture (safe)
  let askedGyroOnce = false;
  async function maybeAskGyroOnFirstGesture(){
    if (askedGyroOnce) return;
    askedGyroOnce = true;
    await requestGyroPermission();
  }

  function install(){
    // prepare layer
    layerEl.style.transform = 'translate3d(0px,0px,0)';
    layerEl.style.willChange = 'transform';

    // pointer drag
    stageEl.addEventListener('pointerdown', onPointerDown, { passive:true });
    stageEl.addEventListener('pointermove', onPointerMove, { passive:true });
    stageEl.addEventListener('pointerup', onPointerUp, { passive:true });
    stageEl.addEventListener('pointercancel', onPointerUp, { passive:true });

    // first-gesture gyro ask
    stageEl.addEventListener('pointerdown', maybeAskGyroOnFirstGesture, { passive:true });
    stageEl.addEventListener('click', maybeAskGyroOnFirstGesture, { passive:true });

    // start RAF loop
    raf = ROOT.requestAnimationFrame(apply);

    // if not iOS-gated, enable gyro immediately
    // (if iOS-gated, will be enabled after permission)
    if (enableGyroDefault){
      // try quick enable without prompting
      requestGyroPermission().catch(()=>{});
    }

    // keep crosshair visually stable (it already is fixed in CSS)
    // but if you ever want to compensate: don't. Crosshair should not move.
    void crosshairEl;
  }

  function destroy(){
    if (!alive) return;
    alive = false;

    try{ ROOT.cancelAnimationFrame(raf); }catch(_){}

    try{
      stageEl.removeEventListener('pointerdown', onPointerDown);
      stageEl.removeEventListener('pointermove', onPointerMove);
      stageEl.removeEventListener('pointerup', onPointerUp);
      stageEl.removeEventListener('pointercancel', onPointerUp);

      stageEl.removeEventListener('pointerdown', maybeAskGyroOnFirstGesture);
      stageEl.removeEventListener('click', maybeAskGyroOnFirstGesture);
    }catch(_){}

    try{
      ROOT.removeEventListener('deviceorientation', onDeviceOrientation);
    }catch(_){}

    // reset transform (optional)
    try{ layerEl.style.transform = 'translate3d(0px,0px,0)'; }catch(_){}
  }

  function getShift(){
    return { x: outX, y: outY, pX, pY, gX, gY, gyroEnabled, gyroGranted, lastOriAt };
  }

  function setShift(x, y){
    pTargetX = clamp(Number(x) || 0, -maxShiftPx, maxShiftPx);
    pTargetY = clamp(Number(y) || 0, -maxShiftPx, maxShiftPx);
  }

  install();

  return { destroy, getShift, setShift, requestGyroPermission };
}