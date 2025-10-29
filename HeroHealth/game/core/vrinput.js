// === Hero Health Academy — core/vrinput.js (v2.4 gaze+UX: hover, cooldown, long-press, callbacks) ===
// Public API (back-compatible):
//   VRInput.init({ engine, sfx, THREE })
//   VRInput.toggleVR()
//   VRInput.isXRActive(), VRInput.isGazeMode()
//   VRInput.setDwellMs(ms)              // 400..2000
//   VRInput.setSelectors(css)           // default: 'button,.item,[data-action],[data-modal-open],[data-result]'
//   VRInput.setAimHost(el)              // e.g., document.getElementById('gameLayer')
//   VRInput.calibrate(dx,dy)            // offset px
//   VRInput.pause()/resume()/dispose()
// New (non-breaking):
//   VRInput.setCooldownMs(ms)           // default 350
//   VRInput.setOnFire(fn)               // fn(el) -> boolean | void (return false to cancel .click())
//   VRInput.setReticleStyle({size,border,progress})
//
// Notes:
// • Reticle uses conic-gradient progress; never consumes pointer-events.
// • Adds [data-gaze="focus"] to current target (+ synthetic pointerenter/leave).
// • Long-press helper: elements with data-modal-open will open when fully dwelled.

export const VRInput = (() => {
  let THREERef = null, engine = null, sfx = null;

  // XR session
  let xrSession = null, xrRefSpace = null;

  // Gaze
  let ret = null;
  let dwellMs = 850;
  let cooldownMs = 350;
  let dwellStart = 0;
  let dwellTarget = null;
  let dwellCooldownUntil = 0;
  let isGaze = false;
  let paused = false;
  let rafId = 0;

  // Aim center
  let aimHost = null;
  let aimOffset = { x:0, y:0 };

  // Config
  let CLICK_SEL = 'button,.item,[data-action],[data-modal-open],[data-result]';
  let onFire = null; // optional callback before .click()
  const msNow = () => performance?.now?.() || Date.now();
  const clamp = (n,a,b)=> Math.max(a, Math.min(b,n));

  /* ============ Reticle ============ */
  function ensureReticle(){
    if (ret && document.body.contains(ret.host)) return ret;
    const host = document.createElement('div');
    host.id = 'xrReticle';
    host.style.cssText = `
      position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
      width:28px;height:28px;border:3px solid #fff;border-radius:50%;
      box-shadow:0 0 12px #000a;z-index:9999;pointer-events:none;opacity:.0;transition:opacity .15s;
    `;
    const prog = document.createElement('div');
    prog.className = 'xrReticle-progress';
    prog.style.cssText = `position:absolute;inset:3px;border-radius:50%;
      background:conic-gradient(#ffd54a 0deg,#0000 0deg);
      opacity:.9;mix-blend-mode:screen;pointer-events:none;`;
    host.appendChild(prog);
    document.body.appendChild(host);
    ret = { host, prog, cfg:{ size:28, border:'#fff', progress:'#ffd54a' } };
    return ret;
  }
  function showReticle(on){ ensureReticle().host.style.opacity = on ? '1' : '.0'; }
  function setReticlePct(p){
    const deg = clamp(p, 0, 1) * 360;
    const color = ensureReticle().cfg.progress;
    ret.prog.style.background = `conic-gradient(${color} ${deg}deg,#0000 ${deg}deg)`;
  }
  function setReticleStyle({ size, border, progress } = {}){
    ensureReticle();
    if (Number.isFinite(size) && size>14 && size<120){
      ret.cfg.size = size|0;
      ret.host.style.width  = ret.host.style.height = `${ret.cfg.size}px`;
      ret.prog.style.inset = '3px';
    }
    if (border){ ret.cfg.border = String(border); ret.host.style.borderColor = ret.cfg.border; }
    if (progress){ ret.cfg.progress = String(progress); }
  }

  /* ============ Config helpers ============ */
  function cfgDwell(ms){
    if (Number.isFinite(ms)) {
      dwellMs = clamp(ms|0, 400, 2000);
      try { localStorage.setItem('hha_dwell_ms', String(dwellMs)); } catch {}
      return;
    }
    const v = parseInt(localStorage.getItem('hha_dwell_ms')||'', 10);
    dwellMs = Number.isFinite(v) ? clamp(v, 400, 2000) : 850;
  }
  function setCooldownMs(ms){
    cooldownMs = clamp(ms|0, 120, 2000);
  }

  /* ============ XR toggle ============ */
  async function toggleVR(){
    try{
      if (xrSession){ await xrSession.end(); return; }
      if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-vr'))){
        enableGaze();
        return;
      }
      xrSession = await navigator.xr.requestSession('immersive-vr', { requiredFeatures:['local-floor'] });
      xrRefSpace = await xrSession.requestReferenceSpace('local-floor');
      enableGaze(); // still use gaze for UI HUD in VR
      xrSession.addEventListener('end', onXREnd, { once:true });
    }catch(e){
      console.warn('[VRInput] toggle error', e);
      enableGaze();
    }
  }
  function onXREnd(){
    xrSession = null; xrRefSpace = null;
    isGaze = false;
    _setFocusEl(null);
    showReticle(false);
    cancelAnimationFrame(rafId);
  }
  function enableGaze(){
    isGaze = true; paused = false;
    cfgDwell();
    showReticle(true);
    // auto aimHost: #gameLayer if present
    try {
      const gh = document.getElementById('gameLayer');
      if (gh) setAimHost(gh);
    } catch {}
    loopGaze();
  }

  /* ============ Aim center ============ */
  function aimCenter(){
    if (aimHost && aimHost.getBoundingClientRect){
      const r = aimHost.getBoundingClientRect();
      return { x: Math.round(r.left + r.width/2 + aimOffset.x),
               y: Math.round(r.top  + r.height/2 + aimOffset.y) };
    }
    return { x: (innerWidth>>1) + (aimOffset.x|0), y: (innerHeight>>1) + (aimOffset.y|0) };
  }

  /* ============ Focus hover helpers ============ */
  let _lastHoverEl = null;
  function _dispatch(el, type){
    try { el?.dispatchEvent?.(new Event(type, { bubbles:true, cancelable:true })); } catch {}
  }
  function _setFocusEl(el){
    if (el === _lastHoverEl) return;
    if (_lastHoverEl){
      try { _lastHoverEl.removeAttribute('data-gaze'); } catch {}
      _dispatch(_lastHoverEl,'pointerleave');
    }
    _lastHoverEl = el || null;
    if (_lastHoverEl){
      try { _lastHoverEl.setAttribute('data-gaze','focus'); } catch {}
      _dispatch(_lastHoverEl,'pointerenter');
    }
  }

  /* ============ Long-press helper ============ */
  function _fireLongPress(el){
    // If element declares data-modal-open, open it on dwell complete
    const sel = el?.getAttribute?.('data-modal-open');
    if (!sel) return false;
    const modal = document.querySelector(sel);
    if (!modal) return false;
    try {
      // conventional modal: display:flex
      modal.style.display = 'flex';
      return true;
    } catch { return false; }
  }

  /* ============ Main gaze loop ============ */
  function loopGaze(){
    cancelAnimationFrame(rafId);
    const step = ()=>{
      if (!isGaze || paused){ setReticlePct(0); return; }

      const { x, y } = aimCenter();
      const el = document.elementFromPoint(x, y);
      const clickable = el?.closest?.(CLICK_SEL) || null;

      const now = msNow();

      // Hover/focus visuals
      _setFocusEl(clickable);

      if (clickable){
        if (dwellTarget !== clickable){
          dwellTarget = clickable;
          dwellStart = now;
        }
        const p = Math.min(1, (now - dwellStart) / dwellMs);
        setReticlePct(p);

        const cooled = now >= dwellCooldownUntil;
        if (p >= 1 && cooled){
          // Try long-press helper first (e.g., help modal)
          const used = _fireLongPress(clickable);

          // Callback hook may cancel click
          let ok = true;
          if (typeof onFire === 'function'){
            try { const r = onFire(clickable); if (r === false) ok = false; } catch {}
          }

          if (ok && !used){
            try { clickable.click?.(); } catch {}
          }

          try { sfx?.good?.(); } catch {}
          dwellCooldownUntil = now + cooldownMs;
          dwellTarget = null;
          dwellStart = now;
          setReticlePct(0);
        }
      } else {
        dwellTarget = null;
        setReticlePct(0);
      }

      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  /* ============ Visibility/Focus handling ============ */
  function onBlur(){ pause(true); }
  function onFocus(){ resume(true); }
  function onVis(){ document.hidden ? pause(true) : resume(true); }

  /* ============ Public controls ============ */
  function init({ engine:engRef, sfx:sfxRef, THREE:threeRef } = {}){
    engine = engRef || engine;
    sfx    = sfxRef  || sfx;
    THREERef = threeRef || THREERef;
    cfgDwell();
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
  function setOnFire(fn){ onFire = (typeof fn === 'function') ? fn : null; }

  function setCooldown(ms){ setCooldownMs(ms); } // alias
  function setCooldownMsPublic(ms){ setCooldownMs(ms); }

  function isXRActive(){ return !!xrSession; }
  function isGazeMode(){ return !!isGaze; }

  function pause(internal=false){
    if (paused) return;
    paused = true;
    setReticlePct(0);
    cancelAnimationFrame(rafId);
    if (!internal) console.debug('[VRInput] paused');
  }

  function resume(internal=false){
    if (!isGaze) return;
    if (!paused) return;
    paused = false;
    loopGaze();
    if (!internal) console.debug('[VRInput] resumed');
  }

  function dispose(){
    pause();
    _setFocusEl(null);
    showReticle(false);
    try { ret?.host?.remove(); } catch {}
    ret = null;
    try {
      window.removeEventListener('blur', onBlur, { passive:true });
      window.removeEventListener('focus', onFocus, { passive:true });
      document.removeEventListener('visibilitychange', onVis, { passive:true });
    } catch {}
    if (xrSession){ try { xrSession.end(); } catch {} }
    xrSession = null; xrRefSpace = null; isGaze = false;
  }

  return {
    init, toggleVR, isXRActive, isGazeMode,
    setDwellMs, setSelectors, setAimHost, calibrate,
    setOnFire, setCooldown: setCooldownMsPublic, setCooldownMs: setCooldownMsPublic,
    setReticleStyle,
    pause, resume, dispose
  };
})();

// Global quick version ping
try { window.__HHA_VRINPUT_VER__ = 'v2.4'; } catch {}
