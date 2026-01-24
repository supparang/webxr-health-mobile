// === /herohealth/vr-groups/view-helper.js ===
// View helper: fullscreen/orientation best-effort + cVR strict tuning
// API:
//   window.GroupsVR.ViewHelper.init({view})
//   window.GroupsVR.ViewHelper.tryImmersiveForCVR()

(function(){
  'use strict';
  const W = window;
  const D = document;
  const NS = W.GroupsVR = W.GroupsVR || {};
  const VH = NS.ViewHelper = NS.ViewHelper || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function isMobile(){
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function setRootVars(){
    // safe-area vars already in css, but we can expose viewport size if wanted
    try{
      const r = D.documentElement;
      r.style.setProperty('--vw', (W.innerWidth||0) + 'px');
      r.style.setProperty('--vh', (W.innerHeight||0) + 'px');
    }catch(_){}
  }

  async function tryFullscreen(){
    try{
      const el = D.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      return true;
    }catch(_){ return false; }
  }

  async function tryLandscape(){
    try{
      const s = screen.orientation;
      if (s && s.lock) { await s.lock('landscape'); return true; }
    }catch(_){}
    return false;
  }

  VH.init = function({view}){
    view = String(view||qs('view','mobile')||'mobile').toLowerCase();
    setRootVars();
    W.addEventListener('resize', setRootVars, {passive:true});

    // cVR strict: prefer center-shoot, keep DOM targets tappable but aim-based
    if (view === 'cvr'){
      D.body.classList.add('view-cvr');
      // no extra work here; vr-ui.js already emits hha:shoot
    }
    if (view === 'vr'){
      D.body.classList.add('view-vr');
    }
  };

  VH.tryImmersiveForCVR = async function(){
    // Best effort for mobile: fullscreen + landscape (user gesture usually required)
    if (!isMobile()) return false;

    const wantFS = String(qs('fs','1')||'1') !== '0';
    const wantLS = String(qs('ls','1')||'1') !== '0';

    let ok = false;
    if (wantFS) ok = await tryFullscreen();
    if (wantLS) await tryLandscape();
    return ok;
  };
})();