// === /herohealth/vr-groups/view-helper.js ===
// View Helper — PRODUCTION
// ✅ Fullscreen best-effort (mobile/pc)
// ✅ Landscape lock best-effort (cardboard/cVR)
// ✅ cVR strict: disable target pointer events (tap-to-shoot only via vr-ui.js -> hha:shoot)
// ✅ tryImmersiveForCVR(): attempt click Enter VR button created by vr-ui.js (if present)
// ✅ Safe: never throws

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function addCssOnce(id, css){
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = css;
    DOC.head.appendChild(st);
  }

  function requestFullscreen(){
    const el = DOC.documentElement;
    try{
      if (DOC.fullscreenElement) return Promise.resolve(true);
      if (el.requestFullscreen) return el.requestFullscreen().then(()=>true).catch(()=>false);
      const any = el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (any) { any.call(el); return Promise.resolve(true); }
    }catch(_){}
    return Promise.resolve(false);
  }

  async function lockLandscape(){
    try{
      const scr = screen && screen.orientation;
      if (scr && scr.lock) {
        await scr.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  function applySafeAreaVars(){
    // (optional) if user wants future use; currently CSS uses env() directly
    const r = DOC.documentElement;
    try{
      r.style.setProperty('--sat', 'env(safe-area-inset-top, 0px)');
      r.style.setProperty('--sar', 'env(safe-area-inset-right, 0px)');
      r.style.setProperty('--sab', 'env(safe-area-inset-bottom, 0px)');
      r.style.setProperty('--sal', 'env(safe-area-inset-left, 0px)');
    }catch(_){}
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
  }

  function isCVR(view){
    return String(view||'').toLowerCase() === 'cvr';
  }
  function isCardboard(view){
    const v = String(view||'').toLowerCase();
    return v === 'vr' || v === 'cvr';
  }

  function enableCVRStrict(on){
    // Strict: targets should NOT be tappable; only tap-to-shoot via vr-ui.js -> hha:shoot
    DOC.body.classList.toggle('cvr-strict', !!on);
    addCssOnce('hha-cvr-strict-css', `
      body.view-cvr.cvr-strict .fg-target{ pointer-events:none !important; }
      body.view-cvr.cvr-strict .playLayer{ pointer-events:auto; }
    `);
  }

  function hookAutoFS(){
    // Best-effort: request fullscreen on first user gesture if ?fs=1 (or for VR-ish views)
    const fsParam = String(qs('fs','')||'').toLowerCase();
    const wantFS = (fsParam === '1' || fsParam === 'true');
    if (!wantFS) return;

    let done = false;
    const once = async ()=>{
      if (done) return;
      done = true;
      try{ await requestFullscreen(); }catch(_){}
      DOC.removeEventListener('pointerdown', once, true);
      DOC.removeEventListener('touchstart', once, true);
    };
    DOC.addEventListener('pointerdown', once, true);
    DOC.addEventListener('touchstart', once, true);
  }

  function hookAutoLandscape(view){
    // Best-effort: lock landscape for cardboard/cVR if ?land=1 or view is VR-ish
    const landParam = String(qs('land','')||'').toLowerCase();
    const want = (landParam === '1' || landParam === 'true' || isCardboard(view));
    if (!want) return;

    let done = false;
    const once = async ()=>{
      if (done) return;
      done = true;
      try{ await lockLandscape(); }catch(_){}
      DOC.removeEventListener('pointerdown', once, true);
      DOC.removeEventListener('touchstart', once, true);
    };
    DOC.addEventListener('pointerdown', once, true);
    DOC.addEventListener('touchstart', once, true);
  }

  function tryImmersiveForCVR(){
    // Try to click "ENTER VR" button created by /herohealth/vr/vr-ui.js (if present)
    try{
      const btn = DOC.querySelector('[data-hha-vrui="enter"]')
             || DOC.querySelector('#hhaEnterVR')
             || DOC.querySelector('button[aria-label*="Enter"]')
             || DOC.querySelector('button[id*="Enter"]');
      if (btn) { btn.click(); return true; }
    }catch(_){}
    return false;
  }

  // Public API
  NS.ViewHelper = {
    init({view}={}){
      const v = String(view || qs('view','mobile') || 'mobile').toLowerCase();
      setBodyView(v);

      applySafeAreaVars();

      // cVR strict ON by default
      enableCVRStrict(isCVR(v));

      hookAutoFS();
      hookAutoLandscape(v);
    },
    requestFullscreen,
    lockLandscape,
    tryImmersiveForCVR,
    enableCVRStrict
  };

})();