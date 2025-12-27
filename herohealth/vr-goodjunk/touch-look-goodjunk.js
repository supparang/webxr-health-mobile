// === /herohealth/vr-goodjunk/touch-look-goodjunk.js ===
// VR-look for GoodJunk (DOM/VR): drag-to-look + deviceorientation-to-look + light inertia
// Works on #gj-camera (A-Frame entity). Blends drag + gyro. Smooth + clamp pitch.
// ✅ PATCH: publish window.__GJ_CAM_OFFSET__ (+ __GJ_AIM_POINT__) for DOM targets to pan like VR
// ✅ PATCH: publish window.__GJ_LAYER_SHIFT__ (HHA Standard) for hazards/world-shift in goodjunk.safe.js
// ✅ PATCH: ignore drags on HUD/buttons/targets to keep clicks reliable

'use strict';

function clamp(v, min, max){
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
function wrapPI(a){
  // keep angle around [-pi, pi] to reduce drift
  a = Number(a) || 0;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return a;
}

export function attachTouchLook(cameraEl, opts = {}){
  if (!cameraEl) return;

  const areaEl = opts.areaEl || document.body;
  const sens = Number(opts.sensitivity ?? 0.26);

  // px offset strength (rad -> px)
  const pxPerRadX = Number(opts.pxPerRadX ?? (innerWidth * 0.42));
  const pxPerRadY = Number(opts.pxPerRadY ?? (innerHeight * 0.32));

  // clamp how far the "world" can pan in DOM
  const maxPanX = Number(opts.maxPanX ?? (innerWidth * 0.30));
  const maxPanY = Number(opts.maxPanY ?? (innerHeight * 0.24));

  // smoothing for cam offset (0..1). smaller = smoother
  const camSmooth = clamp(opts.camSmooth ?? 0.16, 0.05, 0.45);

  // Disable A-Frame default look-controls (avoid double)
  try{ cameraEl.setAttribute('look-controls', 'enabled: false'); }catch(_){}

  const S = {
    yaw: 0,
    pitch: 0,
    vYaw: 0,
    vPitch: 0,
    inertia: 0.86,
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

    // base reference for cam-pan
    baseYaw: 0,
    basePitch: 0,

    // published cam offset (smoothed)
    camX: 0,
    camY: 0,

    raf: 0
  };

  function baseAim(){
    return { x: (innerWidth * 0.5) | 0, y: (innerHeight * 0.62) | 0 };
  }

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
    S.baseYaw = S.yaw;
    S.basePitch = S.pitch;
  }catch(_){}

  function publishCam(){
    // convert relative yaw/pitch to DOM "world pan"
    const relYaw = wrapPI(S.yaw - (S.baseYaw || 0));
    const relPitch = clamp(S.pitch - (S.basePitch || 0), -S.maxPitch, S.maxPitch);

    // target offsets
    const targetX = clamp(relYaw * pxPerRadX, -maxPanX, maxPanX);
    const targetY = clamp(relPitch * pxPerRadY, -maxPanY, maxPanY);

    // smooth (avoid jitter)
    S.camX = S.camX * (1 - camSmooth) + targetX * camSmooth;
    S.camY = S.camY * (1 - camSmooth) + targetY * camSmooth;

    // publish globals used by goodjunk.safe.js
    // cam offset = how much the "world" shifts due to look (compat/legacy)
    window.__GJ_CAM_OFFSET__ = { x: S.camX, y: S.camY };

    // aim point stays as crosshair (center-ish) in DOM, like VR reticle
    const a = baseAim();
    window.__GJ_AIM_POINT__ = { x: a.x, y: a.y };

    // ✅ HHA Standard: world shift used by hazards + transform syncing
    window.__GJ_LAYER_SHIFT__ = { x: S.camX, y: S.camY };
  }

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
      const blend = 0.08;
      // blend around wrap domain
      const gy = wrapPI(S.gyroYaw);
      S.yaw = wrapPI(S.yaw*(1-blend) + gy*blend);
      S.pitch = S.pitch*(1-blend) + S.gyroPitch*blend;
    }

    S.pitch = clamp(S.pitch, -S.maxPitch, S.maxPitch);

    r.y = S.yaw;
    r.x = S.pitch;
    r.z = 0;

    publishCam();
  }

  function tick(){
    apply();
    S.raf = requestAnimationFrame(tick);
  }
  S.raf = requestAnimationFrame(tick);

  // --------- input guards (don't drag on UI/targets) ----------
  function shouldIgnoreStart(e){
    const t = e?.target;
    if (!t || !t.closest) return false;

    // ignore when pressing targets (hit should work)
    if (t.closest('.gj-target')) return true;

    // ignore HUD/buttons/overlays
    if (t.closest('.hud, .hud-top, .hud-bottom, .hud-left, .hud-right')) return true;
    if (t.closest('#btn-vr, #logbadge, #coach-bubble')) return true;
    if (t.closest('.hha-overlay, .start-overlay, .modal, .dialog')) return true;
    if (t.closest('.a-enter-vr, .a-enter-ar')) return true;

    return false;
  }

  // pointer drag look
  function onDown(e){
    if (shouldIgnoreStart(e)) return;

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

    S.yaw = wrapPI(S.yaw + dYaw);
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
    const alpha = ev.alpha, beta = ev.beta, gamma = ev.gamma;
    if (![alpha,beta,gamma].some(v => typeof v === 'number')) return;

    // naive mapping
    let yaw = rad(alpha);
    let pitch = rad(beta);

    pitch = clamp(pitch, -S.maxPitch, S.maxPitch);

    if (baseYaw === null){
      baseYaw = yaw;
      basePitch = pitch;

      // also lock reference so cam-pan doesn't jump on gyro start
      S.baseYaw = S.yaw;
      S.basePitch = S.pitch;
    }

    yaw = wrapPI(yaw - baseYaw);
    pitch = clamp(pitch - basePitch, -S.maxPitch, S.maxPitch);

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
      window.addEventListener('deviceorientation', handleOrientation, { passive:true });
      return true;
    }catch(_){
      return false;
    }
  }

  requestGyroPermissionIfNeeded();

  // initial publish so safe.js can render correctly immediately
  try{
    publishCam();
  }catch(_){}

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

      // cleanup globals
      try{ delete window.__GJ_CAM_OFFSET__; }catch(_){}
      try{ delete window.__GJ_AIM_POINT__; }catch(_){}
      try{ delete window.__GJ_LAYER_SHIFT__; }catch(_){}
    }
  };
}