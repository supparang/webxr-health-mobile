/* === /herohealth/vr-groups/view-helper.js ===
View Helper — PRODUCTION
✅ init({view})
✅ tryImmersiveForCVR(): fullscreen + orientation lock best effort
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function setBodyView(view){
    view = String(view||'mobile').toLowerCase();
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
  }

  async function requestFullscreen(){
    const el = DOC.documentElement;
    if (DOC.fullscreenElement) return true;
    try{
      if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI:'hide' }); return true; }
    }catch(_){}
    return false;
  }

  async function lockLandscape(){
    try{
      if (screen && screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  const ViewHelper = {
    init({ view } = {}){
      const v = String(view || qs('view','mobile') || 'mobile').toLowerCase();
      setBodyView(v);

      // helpful flags
      DOC.body.classList.toggle('is-cvr', v==='cvr');
      DOC.body.classList.toggle('is-vr',  v==='vr');

      return v;
    },

    async tryImmersiveForCVR(){
      // best-effort: do not hard fail
      await requestFullscreen();
      await lockLandscape();
      return true;
    }
  };

  NS.ViewHelper = ViewHelper;

})(typeof window !== 'undefined' ? window : globalThis);