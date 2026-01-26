/* === /herohealth/vr-groups/view-helper.js ===
View Helper — PACK 12/14 support
✅ init({view})
✅ best-effort fullscreen + landscape lock for cVR
✅ tryImmersiveForCVR(): helps WebXR enter for cardboard
*/
(function(root){
  'use strict';
  const DOC = root.document;
  const NS = root.GroupsVR = root.GroupsVR || {};
  const VH = NS.ViewHelper = NS.ViewHelper || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  async function requestFullscreen(){
    const el = DOC.documentElement;
    if (!el) return false;
    try{
      if (DOC.fullscreenElement) return true;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!fn) return false;
      await fn.call(el);
      return true;
    }catch{ return false; }
  }

  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if (!o || !o.lock) return false;
      await o.lock('landscape');
      return true;
    }catch{ return false; }
  }

  VH.init = function(cfg){
    cfg = cfg || {};
    const view = String(cfg.view || qs('view','mobile') || 'mobile').toLowerCase();

    DOC.body.classList.toggle('view-cvr', view==='cvr');
    DOC.body.classList.toggle('view-vr', view==='vr');
    DOC.body.classList.toggle('view-pc', view==='pc');
    DOC.body.classList.toggle('view-mobile', view==='mobile');

    // cVR best-effort
    if (view==='cvr'){
      // only try after a user gesture; we call again from buttons/taps elsewhere
      // here we just mark hints
      DOC.body.classList.add('hint-cvr');
    }
  };

  VH.tryImmersiveForCVR = async function(){
    // user gesture recommended; call from click/tap flows
    await requestFullscreen();
    await lockLandscape();
    return true;
  };

})(typeof window!=='undefined' ? window : globalThis);