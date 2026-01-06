// === /herohealth/hydration-vr/hydration.fs.js ===
// Hydration FS/Orientation Helper — PRODUCTION (B)
// ✅ Best-effort: requestFullscreen + lock landscape (must be from user gesture)
// ✅ Smart: on Start click -> try fullscreen & landscape on mobile
// ✅ Auto: keep cVR soft mode when (mobile + fullscreen + landscape)
// ✅ Safe: never hard-fail, never blocks gameplay

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_FS__) return;
  WIN.__HHA_HYDRATION_FS__ = true;

  const body = DOC.body;

  function isLikelyMobile(){
    try{
      const ua = navigator.userAgent || '';
      const coarse = WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches;
      const small = Math.min(WIN.innerWidth||9999, WIN.innerHeight||9999) < 760;
      return coarse || small || /Android|iPhone|iPad|iPod/i.test(ua);
    }catch(_){ return false; }
  }

  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' });
      }
    }catch(_){}
  }

  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if (o && o.lock){
        await o.lock('landscape');
      }
    }catch(_){}
  }

  async function bestEffortFS(){
    await requestFullscreen();
    await lockLandscape();
  }

  // cVR soft mode: when mobile + fullscreen + landscape, toggle view-cvr
  function setLayers(){
    const cfg = WIN.HHA_VIEW || (WIN.HHA_VIEW = {});
    if (body.classList.contains('cardboard')){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
  }

  function maybeEnableCVRSoft(){
    try{
      if (!isLikelyMobile()) return;
      if (body.classList.contains('cardboard')) return; // real VR already

      const landscape = (WIN.innerWidth||0) > (WIN.innerHeight||0);
      const fs = !!DOC.fullscreenElement;

      // If in fullscreen landscape => strict crosshair mode
      if (landscape && fs){
        body.classList.remove('view-pc','view-mobile');
        body.classList.add('view-cvr');
        setLayers();
      } else {
        // revert to mobile touch mode (only if we previously enabled cVR soft)
        if (body.classList.contains('view-cvr')){
          body.classList.remove('view-cvr');
          body.classList.add('view-mobile');
          setLayers();
        }
      }
    }catch(_){}
  }

  // Hook: Start button gesture
  function bindStartButton(){
    // Default id used in hydration-vr.html that I gave: #btnStart
    const btn = DOC.getElementById('btnStart');
    if (!btn) return false;

    btn.addEventListener('click', async ()=>{
      // Must be a user gesture: do FS + lock now
      await bestEffortFS();
      // Let layout settle then apply cVR soft if applicable
      setTimeout(maybeEnableCVRSoft, 120);
      setTimeout(maybeEnableCVRSoft, 520);
    }, { passive:false });

    return true;
  }

  // Hook: any user gesture fallback (tap/click) first time
  function bindFirstGestureFallback(){
    let done=false;
    function onGesture(){
      if (done) return;
      done=true;
      DOC.removeEventListener('pointerdown', onGesture, true);
      DOC.removeEventListener('touchstart', onGesture, true);
      // do nothing aggressive — just evaluate cVR
      setTimeout(maybeEnableCVRSoft, 80);
    }
    DOC.addEventListener('pointerdown', onGesture, true);
    DOC.addEventListener('touchstart', onGesture, true);
  }

  // Keep checking after changes
  WIN.addEventListener('resize', maybeEnableCVRSoft);
  DOC.addEventListener('fullscreenchange', maybeEnableCVRSoft);
  WIN.addEventListener('orientationchange', ()=>setTimeout(maybeEnableCVRSoft, 120));

  // Init
  bindFirstGestureFallback();
  bindStartButton();

  // First pass
  setTimeout(maybeEnableCVRSoft, 180);
})();