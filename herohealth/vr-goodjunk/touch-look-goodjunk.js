// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// Touch + Gyro look (VR-feel) for GoodJunkVR (DOM)
// ✅ ESM export: attachTouchLook (แก้ error import)
// ✅ drag to look (desktop/mobile)
// ✅ deviceorientation (mobile) best-effort
// ✅ works with mono layerEl or stereo eye wrappers
'use strict';

function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

function qs(name, def=null){
  try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}

function supportsGyro(){
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

async function requestGyroPermissionIfNeeded(){
  try{
    // iOS requires explicit permission
    if (typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function'){
      const r = await DeviceOrientationEvent.requestPermission();
      return r === 'granted';
    }
  }catch(_){}
  return true; // Android / non-iOS
}

function setCrosshairY(crosshairEl, aimY){
  if (!crosshairEl) return;
  const y = clamp(aimY, 0.28, 0.78) * 100;
  crosshairEl.style.top = `${y}%`;
}

function setShift(el, dx, dy){
  if (!el) return;
  el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
}

export function attachTouchLook(opts = {}){
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  const crosshairEl = opts.crosshairEl || document.getElementById('gj-crosshair');

  // stereo support (optional)
  const stereo = !!opts.stereo;
  const eyeWrapL = opts.eyeWrapL || document.getElementById('gj-eyeL');
  const eyeWrapR = opts.eyeWrapR || document.getElementById('gj-eyeR');

  const aimY = Number(opts.aimY ?? 0.62);
  const maxShiftPx = Number(opts.maxShiftPx ?? 170);
  const ease = clamp(opts.ease ?? 0.12, 0.04, 0.28);

  // slight stereo parallax
  const parallaxPx = stereo ? clamp(opts.parallaxPx ?? 10, 0, 28) : 0;

  setCrosshairY(crosshairEl, aimY);
  if (stereo){
    setCrosshairY(document.getElementById('gj-crosshairL'), aimY);
    setCrosshairY(document.getElementById('gj-crosshairR'), aimY);
  }

  const state = {
    active: true,
    dx: 0, dy: 0,
    tx: 0, ty: 0,
    dragging: false,
    lastX: 0, lastY: 0,
    gyroOK: false,
    gyroBase: null,
    gyroDX: 0, gyroDY: 0,
    isCoarse: window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
  };

  // apply transform target
  function apply(){
    if (!state.active) return;

    // blend drag + gyro
    const gx = state.gyroDX;
    const gy = state.gyroDY;

    const targetX = clamp(state.tx + gx, -maxShiftPx, maxShiftPx);
    const targetY = clamp(state.ty + gy, -maxShiftPx, maxShiftPx);

    state.dx += (targetX - state.dx) * ease;
    state.dy += (targetY - state.dy) * ease;

    // mono
    if (!stereo){
      setShift(layerEl, state.dx, state.dy);
    } else {
      // stereo: shift wrappers equally, add small parallax split
      setShift(eyeWrapL, state.dx - parallaxPx, state.dy);
      setShift(eyeWrapR, state.dx + parallaxPx, state.dy);
    }

    requestAnimationFrame(apply);
  }
  requestAnimationFrame(apply);

  // pointer drag
  function onDown(e){
    if (!state.active) return;
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
  }
  function onMove(e){
    if (!state.active || !state.dragging) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    // invert feel a bit (เหมือนหันกล้อง)
    state.tx = clamp(state.tx + dx * 0.85, -maxShiftPx, maxShiftPx);
    state.ty = clamp(state.ty + dy * 0.85, -maxShiftPx, maxShiftPx);
  }
  function onUp(){
    state.dragging = false;
  }

  const stage = document.getElementById('gj-stage') || document.body;
  stage.addEventListener('pointerdown', onDown, { passive:true });
  window.addEventListener('pointermove', onMove, { passive:true });
  window.addEventListener('pointerup', onUp, { passive:true });
  window.addEventListener('pointercancel', onUp, { passive:true });

  // gyro
  async function enableGyro(){
    if (!supportsGyro()) return;
    const ok = await requestGyroPermissionIfNeeded();
    if (!ok) return;

    state.gyroOK = true;
    document.body.classList.add('gj-gyro');

    window.addEventListener('deviceorientation', (ev)=>{
      if (!state.active || !state.gyroOK) return;

      // beta: front-back, gamma: left-right
      const beta = Number(ev.beta);
      const gamma = Number(ev.gamma);
      if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

      if (!state.gyroBase){
        state.gyroBase = { beta, gamma };
        return;
      }
      const db = beta - state.gyroBase.beta;
      const dg = gamma - state.gyroBase.gamma;

      // map to px shift
      const kx = state.isCoarse ? 3.1 : 2.2;
      const ky = state.isCoarse ? 2.6 : 1.9;

      state.gyroDX = clamp(dg * kx, -maxShiftPx, maxShiftPx);
      state.gyroDY = clamp(db * ky, -maxShiftPx, maxShiftPx);
    }, { passive:true });
  }

  // auto enable gyro if asked
  const wantGyro = String(opts.gyro ?? qs('gyro','1')).toLowerCase() !== '0';
  if (wantGyro) enableGyro();

  return {
    destroy(){
      state.active = false;
      try{ stage.removeEventListener('pointerdown', onDown); }catch(_){}
      try{ window.removeEventListener('pointermove', onMove); }catch(_){}
      try{ window.removeEventListener('pointerup', onUp); }catch(_){}
      try{ window.removeEventListener('pointercancel', onUp); }catch(_){}
    }
  };
}