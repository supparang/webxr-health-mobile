/* === /herohealth/vr-groups/view-helper.js ===
GroupsVR ViewHelper — PACK 13 (Calibration/Recenter helper for Cardboard)
✅ init({view})
✅ tryImmersiveForCVR(): fullscreen + best-effort landscape
✅ recenter(): lightweight recenter hook (dom + aframe if available)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const H = NS.ViewHelper = NS.ViewHelper || {};

  let _view = 'mobile';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function isMobile(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua);
  }

  async function requestFullscreen(){
    const el = DOC.documentElement;
    try{
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI:'hide' }); return true; }
      if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return true; }
    }catch(_){}
    return false;
  }

  async function lockLandscape(){
    try{
      const so = screen.orientation;
      if (so && so.lock) { await so.lock('landscape'); return true; }
    }catch(_){}
    return false;
  }

  function nudgeScrollTop(){
    try{ root.scrollTo(0,0); }catch(_){}
  }

  function setBodyView(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
  }

  // lightweight “recenter”
  function recenter(){
    // 1) DOM nudge (helps some Cardboard webviews)
    nudgeScrollTop();

    // 2) A-Frame: if scene/camera exists, ask A-Frame to reset pose (best effort)
    try{
      const scene = DOC.querySelector('a-scene');
      if (scene && scene.renderer && scene.xr && scene.xr.getSession){
        // WebXR recenter is session/space dependent; best effort via entering/exiting not possible here
        // but we can dispatch a hint event for vr-ui.js or game code to use.
      }
    }catch(_){}

    try{
      root.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ view:_view, ts:Date.now() } }));
    }catch(_){}
  }

  async function tryImmersiveForCVR(){
    // Only for cVR/Cardboard
    if (_view !== 'cvr') return;

    // Fullscreen is most important; then orientation lock
    if (isMobile()){
      await requestFullscreen();
      await lockLandscape();
      nudgeScrollTop();
    }
    // Tell UI to show crosshair / remind user tap to shoot
    try{
      root.dispatchEvent(new CustomEvent('hha:cvr:ready', { detail:{ view:_view, ts:Date.now() } }));
    }catch(_){}
  }

  function init(opts){
    opts = opts || {};
    _view = String(opts.view || qs('view','mobile') || 'mobile').toLowerCase();
    if (_view !== 'pc' && _view !== 'mobile' && _view !== 'vr' && _view !== 'cvr') _view = 'mobile';
    setBodyView(_view);

    // If user rotates device, keep things stable
    root.addEventListener('orientationchange', ()=>{ setTimeout(nudgeScrollTop, 60); }, {passive:true});
    root.addEventListener('resize', ()=>{ setTimeout(nudgeScrollTop, 60); }, {passive:true});
  }

  H.init = init;
  H.tryImmersiveForCVR = tryImmersiveForCVR;
  H.recenter = recenter;

})(typeof window !== 'undefined' ? window : globalThis);