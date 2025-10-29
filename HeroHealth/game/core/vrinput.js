// === Hero Health Academy — core/vrinput.js (v2 hardened; gaze dwell + XR toggle + cleanup) ===
// API-compatible with your previous version:
//   VRInput.init({ engine, sfx, THREE })
//   VRInput.toggleVR()
//   VRInput.isXRActive(), VRInput.isGazeMode()
// New (non-breaking) helpers:
//   VRInput.setDwellMs(ms)            // 400..2000
//   VRInput.setSelectors(css)         // custom clickable selector
//   VRInput.setAimHost(el)            // aim center within a host rect (e.g., #gameLayer)
//   VRInput.dispose()                 // unbind listeners & remove reticle
//   VRInput.pause()/resume()          // manual control (auto on blur/visibilitychange)
//   VRInput.calibrate(offsetX, offsetY) // fine tune aim in px
//
// Notes:
// • When WebXR "immersive-vr" not supported, it falls back to Gaze mode on HTML UI.
// • Dwell progress ring is driven with conic-gradient for performance.
// • Click fire has a short cooldown to prevent double-trigger on sticky targets.
// • Reticle never consumes pointer events; we use document.elementFromPoint center of host.

export const VRInput = (() => {
  // ---- External refs (optional) ----
  let THREERef = null, engine = null, sfx = null;

  // ---- XR state ----
  let xrSession = null, xrRefSpace = null;

  // ---- Gaze/reticle state ----
  let reticle = null;
  let dwellMs = 850;
  let dwellStart = 0;
  let dwellTarget = null;
  let dwellCooldownUntil = 0;
  let isGaze = false;
  let paused = false;
  let rafId = 0;

  // Aim center host (defaults to window center)
  let aimHost = null;                // HTMLElement or null
  let aimOffset = { x: 0, y: 0 };    // calibration (px)

  // Clickable selector (configurable)
  let CLICK_SEL = 'button,.item,[data-action],[data-modal-open],[data-result]';

  // Helpers
  const msNow = () => performance?.now?.() || Date.now();
  const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));
  const cfgDwell = (ms) => {
    if (Number.isFinite(ms)) {
      dwellMs = clamp(ms|0, 400, 2000);
      try { localStorage.setItem('hha_dwell_ms', String(dwellMs)); } catch {}
      return;
    }
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'', 10);
    dwellMs = Number.isFinite(v) ? clamp(v, 400, 2000) : 850;
  };

  // ---- Reticle ----
  function ensureReticle(){
    if (reticle && document.body.contains(reticle.host)) return reticle;

    const host = document.createElement('div');
    host.id = 'xrReticle';
    host.style.cssText = `
      position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
      width:28px;height:28px;border:3px solid #fff;border-radius:50%;
      box-shadow:0 0 12px #000a;z-index:9999;pointer-events:none;opacity:.0;transition:opacity .15s;
    `;

    const prog = document.createElement('div');
    prog.className = 'xrReticle-progress';
    prog.style.cssText = `
      position:absolute;inset:3px;border-radius:50%;
      background:conic-gradient(#ffd54a 0deg,#0000 0deg);
      opacity:.9;mix-blend-mode:screen;transition:none;pointer-events:none;
    `;

    host.appendChild(prog);
    document.body.appendChild(host);
    reticle = { host, prog };
    return reticle;
  }
  function showReticle(on){ ensureReticle().host.style.opacity = on ? '1' : '.0'; }
  function setReticlePct(p){
    const deg = clamp(p, 0, 1) * 360;
    ensureReticle().prog.style.background = `conic-gradient(#ffd54a ${deg}deg,#0000 ${deg}deg)`;
  }

  // ---- XR toggle ----
  async function toggleVR(){
    try{
      if (xrSession){
        await xrSession.end();
        return;
      }
      if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr'))){
        // Fallback to Gaze-only UI mode
        isGaze = true;
        cfgDwell();
        paused = false;
        showReticle(true);
        loopGaze();
        return;
      }
      xrSession = await navigator.xr.requestSession('immersive-vr', { requiredFeatures:['local-floor'] });
      xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
      isGaze = true;                // we still use gaze for UI elements in VR HUD
      paused = false;
      cfgDwell();
      showReticle(true);
      xrSession.addEventListener('end', onXREnd, { once:true });
      loopGaze();
    }catch(e){
      console.warn('[VRInput] toggle error', e);
      // As a fallback, still enable gaze mode
      isGaze = true; paused = false; cfgDwell(); showReticle(true); loopGaze();
    }
  }

  function onXREnd(){
    xrSession = null; xrRefSpace = null;
    isGaze = false;
    showReticle(false);
    cancelAnimationFrame(rafId);
  }

  // ---- Aiming center ----
  function aimCenter(){
    // Use aimHost center when present; else window center
    if (aimHost && aimHost.getBoundingClientRect){
      const r = aimHost.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2 + aimOffset.x),
               y: Math.round(r.top  + r.height/2 + aimOffset.y) };
    }
    return { x: (innerWidth>>1) + (aimOffset.x|0), y: (innerHeight>>1) + (aimOffset.y|0) };
  }

  // ---- Gaze loop ----
  function loopGaze(){
    cancelAnimationFrame(rafId);
    const step = ()=>{
      if (!isGaze || paused){ setReticlePct(0); return; }

      // Use center ray on DOM
      const { x, y } = aimCenter();
      const target = document.elementFromPoint(x, y);
      // Ignore the reticle itself (pointer-events:none already, but just in case)
      const clickable = target?.closest?.(CLICK_SEL) || null;

      const now = msNow();

      if (clickable){
        // Reset when new target acquired
        if (dwellTarget !== clickable){
          dwellTarget = clickable;
          dwellStart = now;
        }
        // Progress
        const p = Math.min(1, (now - dwellStart) / dwellMs);
        setReticlePct(p);

        // Cooldown window prevents double-trigger on sticky overlays
        const cooled = now >= dwellCooldownUntil;

        if (p >= 1 && cooled){
          // Fire synthetic click
          try {
            clickable.click?.();
            sfx?.play?.('sfx-good');
          } catch {}
          // Apply brief cooldown & reset progress
          dwellCooldownUntil = now + 350;
          dwellTarget = null;
          dwellStart = now;
          setReticlePct(0);
        }
      } else {
        // No target -> reset
        dwellTarget = null;
        setReticlePct(0);
      }

      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  // ---- Visibility/Focus handling ----
  function onBlur(){ pause(true); }
  function onFocus(){ resume(true); }
  function onVis(){ document.hidden ? pause(true) : resume(true); }

  // ---- Public controls ----
  function init({ engine:engRef, sfx:sfxRef, THREE:threeRef } = {}){
    engine = engRef || engine;
    sfx    = sfxRef  || sfx;
    THREERef = threeRef || THREERef;
    cfgDwell();

    // bind focus management
    try {
      window.addEventListener('blur', onBlur, { passive:true });
      window.addEventListener('focus', onFocus, { passive:true });
      document.addEventListener('visibilitychange', onVis, { passive:true });
    } catch {}
  }

  function setDwellMs(ms){ cfgDwell(ms); }
  function setSelectors(css){ if (css && typeof css === 'string') CLICK_SEL = css; }
  function setAimHost(el){ aimHost = (el && el.getBoundingClientRect) ? el : null; }
  function calibrate(dx=0, dy=0){ aimOffset = { x: dx|0, y: dy|0 }; }

  function isXRActive(){ return !!xrSession; }
  function isGazeMode(){ return !!isGaze; }

  function pause(internal=false){
    if (paused) return;
    paused = true;
    // Keep reticle visible but frozen with 0 progress
    setReticlePct(0);
    // Stop RAF if any
    cancelAnimationFrame(rafId);
    if (!internal) console.debug('[VRInput] paused');
  }

  function resume(internal=false){
    if (!isGaze) return; // only relevant in gaze mode
    if (!paused) return;
    paused = false;
    loopGaze();
    if (!internal) console.debug('[VRInput] resumed');
  }

  function dispose(){
    pause();
    showReticle(false);
    try { reticle?.host?.remove(); } catch {}
    reticle = null;
    // Unbind global listeners
    try {
      window.removeEventListener('blur', onBlur, { passive:true });
      window.removeEventListener('focus', onFocus, { passive:true });
      document.removeEventListener('visibilitychange', onVis, { passive:true });
    } catch {}
    // End XR session if active
    if (xrSession){
      try { xrSession.end(); } catch {}
    }
    xrSession = null; xrRefSpace = null; isGaze = false;
  }

  return {
    init, toggleVR, isXRActive, isGazeMode,
    setDwellMs, setSelectors, setAimHost, calibrate,
    pause, resume, dispose
  };
})();
