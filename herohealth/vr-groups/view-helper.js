// === /herohealth/vr-groups/view-helper.js ===
// GroupsVR ViewHelper — PRODUCTION (SAFE)
// ✅ Determines/locks view: pc | mobile | vr | cvr
// ✅ Fullscreen helper (best-effort) + landscape lock on mobile/cVR
// ✅ cVR strict: shoot from crosshair center (ignore pointer events on targets)
// ✅ Prevent HUD from blocking VR UI buttons (safe top inset class)
// ✅ Optional: tryImmersiveForCVR() (doesn't force, just best-effort)
// Exposes: window.GroupsVR.ViewHelper.init({view}), .tryImmersiveForCVR(), .get()

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  const VH = WIN.GroupsVR.ViewHelper = WIN.GroupsVR.ViewHelper || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  };

  const S = {
    view: 'pc',
    inited: false,
    // ui safe top (avoid covering vr-ui.js buttons)
    safeTopPx: 86
  };

  function setBodyView(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-'+view);

    // cVR strict mode: disable target pointer events so shooting uses crosshair center
    // (targets should still be "hit" via engine mapping + hha:shoot)
    if (view === 'cvr'){
      b.classList.add('strict-cvr');
    }else{
      b.classList.remove('strict-cvr');
    }
  }

  function isMobile(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua);
  }

  function bestView(){
    const v = String(qs('view','')||'').toLowerCase();
    if (v) return v;
    // if explicit none, fallback by UA
    return isMobile() ? 'mobile' : 'pc';
  }

  function getScene(){
    return DOC.querySelector('a-scene');
  }

  function requestFullscreen(el){
    if (!el) return Promise.resolve(false);
    try{
      const f = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (!f) return Promise.resolve(false);
      const out = f.call(el);
      return Promise.resolve(out).then(()=>true).catch(()=>false);
    }catch(_){ return Promise.resolve(false); }
  }

  async function lockLandscape(){
    // Best-effort. Not all browsers allow it without user gesture.
    try{
      const ori = screen && screen.orientation;
      if (ori && ori.lock){
        await ori.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  function measureSafeTop(){
    // Try detect vr-ui top buttons area; fallback to fixed
    // We want HUD/Quest not to cover vr-ui.js buttons.
    let px = S.safeTopPx;

    try{
      const btn = DOC.querySelector('.hha-vrui-bar, .hha-vrui, .hha-vrui-top, #hhaVruI, .hha-vrui-btn');
      if (btn){
        const r = btn.getBoundingClientRect();
        px = Math.max(px, Math.round(r.bottom + 10));
      }
    }catch(_){}

    // clamp for mobile
    px = clamp(px, 64, 140);
    S.safeTopPx = px;

    try{
      DOC.documentElement.style.setProperty('--hha-safeTop', px + 'px');
    }catch(_){}
  }

  function applySafeTopClass(){
    // add a class to body so CSS can use padding-top: var(--hha-safeTop)
    try{
      DOC.body && DOC.body.classList.add('hha-safeTop');
      measureSafeTop();
      // remeasure after a short delay (vr-ui may mount later)
      setTimeout(measureSafeTop, 200);
      setTimeout(measureSafeTop, 700);
    }catch(_){}
  }

  function ensureCVRStrict(){
    // In cVR strict: targets should not catch clicks (shoot from crosshair)
    try{
      const b = DOC.body;
      if (!b) return;
      if (S.view === 'cvr') b.classList.add('strict-cvr');
      else b.classList.remove('strict-cvr');
    }catch(_){}
  }

  VH.get = function(){
    return { view: S.view, safeTopPx: S.safeTopPx, inited: S.inited };
  };

  VH.init = function(opts){
    try{
      opts = opts || {};
      const view = String(opts.view || bestView() || 'pc').toLowerCase();

      S.view = (view==='cvr'||view==='vr'||view==='mobile'||view==='pc') ? view : 'pc';
      setBodyView(S.view);
      ensureCVRStrict();
      applySafeTopClass();

      // If mobile/cVR, try to set meta/behavioral hints
      if (S.view === 'mobile' || S.view === 'cvr'){
        // prevent double-tap zoom
        DOC.addEventListener('touchstart', ()=>{}, {passive:true});
      }

      // Recompute safeTop on resize/orientation
      WIN.addEventListener('resize', ()=>{ measureSafeTop(); }, {passive:true});
      WIN.addEventListener('orientationchange', ()=>{ setTimeout(measureSafeTop, 250); }, {passive:true});

      S.inited = true;
      return true;
    }catch(_){
      return false;
    }
  };

  // Best-effort helper for cVR:
  // 1) fullscreen body
  // 2) landscape lock
  // 3) (optional) ask a-scene to enter VR via vr-ui.js buttons (we don't force here)
  VH.tryImmersiveForCVR = async function(){
    try{
      if (S.view !== 'cvr') return false;

      // try fullscreen on body / scene
      const sc = getScene();
      const okFs = await requestFullscreen(sc || DOC.documentElement || DOC.body);

      // try lock landscape
      await lockLandscape();

      // remeasure safeTop (vr-ui may shift)
      setTimeout(measureSafeTop, 350);

      return !!okFs;
    }catch(_){
      return false;
    }
  };

})();