// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// VR-look for GoodJunk (DOM/VR): drag-to-look + deviceorientation-to-look + light inertia
// Works on #gj-camera (A-Frame entity). Blends drag + gyro. Smooth + clamp pitch.

'use strict';

function clamp(v, min, max){
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function attachTouchLook(cameraEl, opts = {}){
  if (!cameraEl) return;

  const areaEl = opts.areaEl || document.body;
  const sens = Number(opts.sensitivity ?? 0.26);

  // Disable A-Frame default look-controls (avoid double)
  try{ cameraEl.setAttribute('look-controls', 'enabled: false'); }catch(_){}

  const S = {
    yaw: 0,
    pitch: 0,
    vYaw: 0,
    vPitch: 0,
    inertia: 0.86,           // light inertia
    friction: 0.90,
    maxPitch: 1.12,

    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,

    gyroEnabled: true,
    gyroYaw: 0,
    gyroPitch: 0,
    gyroReady: false,

    raf: 0
  };

  function getRot(){
    const r = cameraEl.object3D?.rotation;
    if (!r) return { yaw:0, pitch:0 };
    return { yaw: r.y, pitch: r.x };
  }

  // init from current rotation
  try{
    const r = getRot();
    S.yaw = r.yaw || 0;
    S.pitch = clamp(r.pitch || 0, -S.maxPitch, S.maxPitch);
  }catch(_){}

  function apply(){
    const r = cameraEl.object3D?.rotation;
    if (!r) return;

    // inertia smoothing
    S.yaw += S.vYaw;
    S.pitch += S.vPitch;
    S.vYaw *= S.friction;
    S.vPitch *= S.friction;

    // blend gyro
    if (S.gyroEnabled && S.gyroReady){
      // gentle follow gyro (not override)
      const blend = 0.08;
      S.yaw = S.yaw*(1-blend) + S.gyroYaw*blend;
      S.pitch = S.pitch*(1-blend) + S.gyroPitch*blend;
    }

    S.pitch = clamp(S.pitch, -S.maxPitch, S.maxPitch);

    r.y = S.yaw;
    r.x = S.pitch;
    r.z = 0;
  }

  function tick(){
    apply();
    S.raf = requestAnimationFrame(tick);
  }
  S.raf = requestAnimationFrame(tick);

  // pointer drag look
  function onDown(e){
    S.dragging = true;
    S.lastX = (e.touches?.[0]?.clientX ?? e.clientX) || 0;
    S.lastY = (e.touches?.[0]?.clientY ?? e.clientY) || 0;
    S.lastT = performance.now();
  }
  function onMove(e){
    if (!S.dragging) return;

    const x = (e.touches?.[0]?.clientX ?? e.clientX);
    const y = (e.touches?.[0]?.clientY ?? e.clientY);
    if (typeof x !== 'number' || typeof y !== 'number') return;

    const t = performance.now();
    const dt = Math.max(8, t - S.lastT);

    const dx = x - S.lastX;
    const dy = y - S.lastY;

    S.lastX = x; S.lastY = y; S.lastT = t;

    const k = 0.0032 * sens;
    const dYaw = -dx * k;
    const dPitch = -dy * k;

    S.yaw += dYaw;
    S.pitch = clamp(S.pitch + dPitch, -S.maxPitch, S.maxPitch);

    // inertia velocity (small)
    const inv = 1 / dt;
    S.vYaw = S.vYaw*S.inertia + dYaw*inv*18;
    S.vPitch = S.vPitch*S.inertia + dPitch*inv*18;

    e.preventDefault?.();
  }
  function onUp(){
    S.dragging = false;
  }

  areaEl.addEventListener('pointerdown', onDown, { passive:false });
  areaEl.addEventListener('pointermove', onMove, { passive:false });
  areaEl.addEventListener('pointerup', onUp, { passive:true });
  areaEl.addEventListener('pointercancel', onUp, { passive:true });

  areaEl.addEventListener('touchstart', onDown, { passive:false });
  areaEl.addEventListener('touchmove', onMove, { passive:false });
  areaEl.addEventListener('touchend', onUp, { passive:true });
  areaEl.addEventListener('touchcancel', onUp, { passive:true });

  // deviceorientation (mobile gyro)
  let baseYaw = null;
  let basePitch = null;

  function rad(deg){ return (Number(deg)||0) * Math.PI / 180; }

  function handleOrientation(ev){
    // alpha: compass-like, beta: front-back, gamma: left-right
    const alpha = ev.alpha, beta = ev.beta, gamma = ev.gamma;
    if (![alpha,beta,gamma].some(v => typeof v === 'number')) return;

    // naive mapping to yaw/pitch
    // yaw from alpha
    let yaw = rad(alpha);
    // pitch from beta (tilt forward/back)
    let pitch = rad(beta);

    // normalize pitch to reasonable range
    pitch = clamp(pitch, -S.maxPitch, S.maxPitch);

    if (baseYaw === null){
      baseYaw = yaw;
      basePitch = pitch;
    }

    // relative orientation
    yaw = yaw - baseYaw;
    pitch = pitch - basePitch;

    // clamp
    pitch = clamp(pitch, -S.maxPitch, S.maxPitch);

    // store
    S.gyroYaw = yaw;
    S.gyroPitch = pitch;
    S.gyroReady = true;
  }

  async function requestGyroPermissionIfNeeded(){
    try{
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function'){
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted'){
          window.addEventListener('deviceorientation', handleOrientation, { passive:true });
          return true;
        }
        return false;
      }
      // Android/most browsers: no permission prompt needed
      window.addEventListener('deviceorientation', handleOrientation, { passive:true });
      return true;
    }catch(_){
      return false;
    }
  }

  // call on first user gesture (Start already is a gesture)
  requestGyroPermissionIfNeeded();

  return {
    destroy(){
      try{ cancelAnimationFrame(S.raf); }catch(_){}
      try{
        areaEl.removeEventListener('pointerdown', onDown);
        areaEl.removeEventListener('pointermove', onMove);
        areaEl.removeEventListener('pointerup', onUp);
        areaEl.removeEventListener('pointercancel', onUp);

        areaEl.removeEventListener('touchstart', onDown);
        areaEl.removeEventListener('touchmove', onMove);
        areaEl.removeEventListener('touchend', onUp);
        areaEl.removeEventListener('touchcancel', onUp);

        window.removeEventListener('deviceorientation', handleOrientation);
      }catch(_){}
    }
  };
}