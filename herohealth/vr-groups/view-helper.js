// === /herohealth/vr-groups/view-helper.js ===
// View Helper — PRODUCTION (GroupsVR)
// ✅ Sets body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Safe-area CSS vars + re-measure hooks (mobile notch friendly)
// ✅ Fullscreen + best-effort orientation lock for mobile/cVR
// ✅ tryImmersiveForCVR(): nudges fullscreen/landscape on first user gesture
// ✅ Guard: never throws, works even if APIs missing
//
// Conventions:
// - "cvr" = Cardboard style: crosshair center + tap-to-shoot (via vr-ui.js)
// - "vr"  = WebXR immersive; still safe to run on mobile
//
// Notes:
// - Does NOT auto-redirect or override URL params (launcher handles that).
// - This file only helps layout + platform UX.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.ViewHelper && WIN.GroupsVR.ViewHelper.__loaded) return;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function normView(v){
    v = String(v||'').toLowerCase().trim();
    if (v === 'cardboard') v = 'cvr';
    if (v === 'mobile') return 'mobile';
    if (v === 'pc') return 'pc';
    if (v === 'vr') return 'vr';
    if (v === 'cvr') return 'cvr';
    return ''; // unknown
  }

  function detectViewFallback(){
    // Only used if caller passes empty.
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (!isMobile) return 'pc';
    // Heuristic: treat coarse pointer mobile as mobile; let launcher decide cvr mostly
    return 'mobile';
  }

  // -------- Safe-area + viewport units --------
  function setCssVar(name, val){
    try{ DOC.documentElement.style.setProperty(name, String(val)); }catch(_){}
  }

  function measureSafeArea(){
    // Use visualViewport when available for mobile address-bar shrink/expand behavior
    try{
      const vv = WIN.visualViewport;
      const w = vv ? vv.width : WIN.innerWidth;
      const h = vv ? vv.height : WIN.innerHeight;

      setCssVar('--vh', (h * 0.01) + 'px');
      setCssVar('--vw', (w * 0.01) + 'px');

      // Some layouts like to know if "short height"
      setCssVar('--hha-short', (h < 620) ? '1' : '0');
    }catch(_){}
  }

  let _measT = 0;
  function scheduleMeasure(){
    clearTimeout(_measT);
    _measT = setTimeout(measureSafeArea, 40);
  }

  // -------- Fullscreen / Orientation --------
  function canFullscreen(){
    const el = DOC.documentElement;
    return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
  }

  function isFullscreen(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }

  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!el) return false;
      if (isFullscreen()) return true;

      if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI: 'hide' }); return true; }
      if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return true; }
      return false;
    }catch(_){
      return false;
    }
  }

  async function lockLandscape(){
    // best effort — only works on some mobile browsers + only after user gesture
    try{
      const scr = screen;
      const so = scr && scr.orientation;
      if (so && so.lock){
        await so.lock('landscape');
        return true;
      }
      // iOS Safari: no lock; return false
      return false;
    }catch(_){
      return false;
    }
  }

  function hintInstallTouchStart(fn){
    // ensure a "user gesture" hook runs once
    let done = false;
    function once(){
      if (done) return;
      done = true;
      try{ fn(); }catch(_){}
      try{
        DOC.removeEventListener('touchstart', once, { passive:true });
        DOC.removeEventListener('mousedown', once);
        DOC.removeEventListener('pointerdown', once);
      }catch(_){}
    }
    try{ DOC.addEventListener('touchstart', once, { passive:true }); }catch(_){}
    try{ DOC.addEventListener('pointerdown', once, { passive:true }); }catch(_){}
    try{ DOC.addEventListener('mousedown', once); }catch(_){}
  }

  // -------- Body class / UI guards --------
  function setBodyViewClass(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);

    // helpful attribute for CSS / debugging
    try{ b.setAttribute('data-view', view); }catch(_){}
  }

  function applyTouchOptimizations(view){
    // prevent scroll bounce during play
    try{
      DOC.documentElement.style.overscrollBehavior = 'none';
      DOC.body.style.overscrollBehavior = 'none';
      DOC.body.style.touchAction = 'manipulation';
    }catch(_){}

    // in cVR/mobile we often want to block accidental selection
    if (view === 'mobile' || view === 'cvr'){
      try{
        DOC.body.style.userSelect = 'none';
        DOC.body.style.webkitUserSelect = 'none';
      }catch(_){}
    }
  }

  function ensureVrUiNotBlocked(){
    // When HUD overlays exist, make sure VR UI buttons remain clickable.
    // Convention: vr-ui.js creates a fixed layer; we can't depend on its id, so we just reduce pointer interception at edges.
    // Your CSS should already do this, but this is a safety guard.
    try{
      // ensure any top overlays don't swallow pointer events in the extreme top zone
      const hud = DOC.querySelector('.hud');
      if (hud){
        // Let HUD remain interactive, but do not block top-most UI (ENTER VR / RECENTER) that sits near top
        hud.style.paddingTop = 'max(8px, env(safe-area-inset-top, 0px))';
      }
    }catch(_){}
  }

  // -------- Public API --------
  const API = {
    __loaded: true,

    getView(){
      return normView(qs('view','')) || detectViewFallback();
    },

    isCVR(){
      const v = API.getView();
      return v === 'cvr';
    },

    isMobile(){
      const v = API.getView();
      return (v === 'mobile' || v === 'cvr');
    },

    init(opts={}){
      // opts: { view }
      const view = normView(opts.view) || API.getView();

      setBodyViewClass(view);
      applyTouchOptimizations(view);
      ensureVrUiNotBlocked();

      // First measure + listeners
      measureSafeArea();
      try{
        WIN.addEventListener('resize', scheduleMeasure, { passive:true });
        if (WIN.visualViewport){
          WIN.visualViewport.addEventListener('resize', scheduleMeasure, { passive:true });
          WIN.visualViewport.addEventListener('scroll', scheduleMeasure, { passive:true });
        }
        // manual hook for engine/layout adjustments
        WIN.addEventListener('groups:measureSafe', scheduleMeasure, { passive:true });
      }catch(_){}

      // For mobile/cVR: best effort to prep fullscreen/landscape on first gesture
      if (view === 'mobile' || view === 'cvr'){
        hintInstallTouchStart(async ()=>{
          // don't force; best effort only
          if (canFullscreen() && !isFullscreen()){
            await requestFullscreen();
          }
          await lockLandscape();
          scheduleMeasure();
        });
      }

      return view;
    },

    // Call this from run page after E.start(...) if you want to encourage immersive UX for cVR.
    // (It DOES NOT enter WebXR; it only tries fullscreen+landscape after gesture.)
    tryImmersiveForCVR(){
      const view = API.getView();
      if (view !== 'cvr') return;

      hintInstallTouchStart(async ()=>{
        // try fullscreen + landscape, but don't block gameplay
        await requestFullscreen();
        await lockLandscape();
        scheduleMeasure();
      });
    },

    requestFullscreen,
    lockLandscape,
    measureSafeArea
  };

  WIN.GroupsVR.ViewHelper = API;

})();