// === /herohealth/hydration-vr/hydration.autoview.js ===
// Hydration Auto View Detect — PRODUCTION (NO OVERRIDE)
// ✅ No menu, no ?view= override (ignored on purpose)
// ✅ Decide view: pc / mobile / cardboard / cvr
// ✅ Cardboard when: (fullscreen+landscape+mobile) OR (query hint ?cardboard=1) [optional - remove if you want]
// ✅ cVR when: mobile + (gyro present) + (not split cardboard)  => crosshair + tap-to-shoot
// ✅ Expose: window.HHA_VIEW = { mode, layers }
// ✅ Emits: hha:start once DOM ready (after view applied)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_AUTOVIEW__) return;
  WIN.__HHA_HYDRATION_AUTOVIEW__ = true;

  const body = DOC.body;
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  // IMPORTANT: "ห้าม override"
  // We IGNORE ?view= completely.
  // (Optional hint: allow ?cardboard=1 for debugging; comment out if you want super strict)
  const hintCardboard = String(qs('cardboard','')||'').toLowerCase()==='1';

  function isMobile(){
    const ua = navigator.userAgent || '';
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    const small = Math.min(screen.width||9999, screen.height||9999) <= 820;
    return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && small);
  }

  function isLandscape(){
    try{
      const o = screen.orientation?.type || '';
      if (/landscape/.test(o)) return true;
    }catch(_){}
    return (WIN.innerWidth > WIN.innerHeight);
  }

  function isFullscreen(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }

  function hasGyro(){
    // presence heuristic (permission on iOS may be denied; still ok)
    return ('DeviceOrientationEvent' in WIN) || ('DeviceMotionEvent' in WIN);
  }

  function chooseMode(){
    const mobile = isMobile();
    const land = isLandscape();
    const fs = isFullscreen();

    // Cardboard split: mobile + landscape + fullscreen (common in your flow)
    if (hintCardboard) return 'cardboard';
    if (mobile && land && fs) return 'cardboard';

    // cVR strict: mobile + gyro-ish (even without fullscreen) -> crosshair tap-to-shoot
    if (mobile && hasGyro()) return 'cvr';

    // Mobile normal
    if (mobile) return 'mobile';

    // Desktop
    return 'pc';
  }

  function applyBodyMode(mode){
    body.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (mode === 'cardboard') body.classList.add('cardboard');
    else if (mode === 'cvr') body.classList.add('view-cvr');
    else if (mode === 'mobile') body.classList.add('view-mobile');
    else body.classList.add('view-pc');
  }

  function setLayers(){
    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  }

  function hideStartOverlayIfAny(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }

  function init(){
    const mode = chooseMode();
    applyBodyMode(mode);
    setLayers();
    hideStartOverlayIfAny();

    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
    cfg.mode = mode;
    cfg.noOverride = true;

    // Start once after view applied
    setTimeout(()=>{ 
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }, 50);
  }

  // re-evaluate on fullscreen/orientation change (e.g., user enters fullscreen -> switch to cardboard)
  function reEval(){
    const prev = (WIN.HHA_VIEW && WIN.HHA_VIEW.mode) || '';
    const next = chooseMode();
    if (next && next !== prev){
      applyBodyMode(next);
      setLayers();
      const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
      cfg.mode = next;

      // NOTE: we do NOT restart game here; safe.js already started
      // This is just layout/layers for future spawns.
    }
  }

  WIN.addEventListener('fullscreenchange', ()=>setTimeout(reEval, 80));
  WIN.addEventListener('orientationchange', ()=>setTimeout(reEval, 120));
  WIN.addEventListener('resize', ()=>setTimeout(reEval, 160));

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();