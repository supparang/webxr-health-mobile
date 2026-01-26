// === /herohealth/vr/view-helper.js ===
// HHA View Helper — PRODUCTION
// ✅ Auto-detect view (pc/mobile/vr/cvr) BUT never override if ?view= exists
// ✅ Applies body classes: view-pc/view-mobile/view-vr/view-cvr
// ✅ Best-effort fullscreen + landscape lock for (vr/cvr) on user gesture
// ✅ view=cvr strict: mark strict mode + helper APIs
// ✅ Exposes: window.HHAView = { getView, apply, requestImmersion, isMobile }
// ✅ Optional remember last view via localStorage key HHA_LAST_VIEW
//
// NOTE: ไม่ทำ auto fullscreen ทันที (ต้อง user gesture) เพื่อไม่ติด policy ของ browser

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_VIEW_HELPER__) return;
  WIN.__HHA_VIEW_HELPER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  function isMobile(){
    const ua = (navigator.userAgent||'').toLowerCase();
    return /android|iphone|ipad|ipod|mobile|silk/.test(ua) || (WIN.innerWidth < 860);
  }

  function normalizeView(v){
    v = String(v||'').trim().toLowerCase();
    if(v === 'view-cvr') return 'cvr';
    if(v === 'cardboard') return 'vr';
    if(v === 'vr') return 'vr';
    if(v === 'cvr') return 'cvr';
    if(v === 'pc') return 'pc';
    if(v === 'mobile') return 'mobile';
    return '';
  }

  async function canVR(){
    try{
      if(!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') return false;
      return await navigator.xr.isSessionSupported('immersive-vr');
    }catch(_){
      return false;
    }
  }

  async function detectAutoView(){
    // IMPORTANT: never override explicit ?view=
    if(has('view')){
      return normalizeView(qs('view','')) || (isMobile() ? 'mobile' : 'pc');
    }

    // soft remember
    try{
      const last = localStorage.getItem('HHA_LAST_VIEW');
      const nv = normalizeView(last);
      if(nv) return nv;
    }catch(_){}

    // baseline
    let guess = isMobile() ? 'mobile' : 'pc';

    // if WebXR available, allow vr for mobile
    try{
      const ok = await canVR();
      if(ok){
        guess = isMobile() ? 'vr' : 'pc';
      }
    }catch(_){}

    return guess;
  }

  function applyBodyView(view){
    const b = DOC.body;
    if(!b) return;

    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    if(view === 'cvr') b.classList.add('view-cvr');
    else if(view === 'vr') b.classList.add('view-vr');
    else if(view === 'pc') b.classList.add('view-pc');
    else b.classList.add('view-mobile');

    // mark strict cVR mode (ยิงกลางจอเท่านั้น)
    if(view === 'cvr'){
      b.dataset.viewStrict = '1';
    }else{
      delete b.dataset.viewStrict;
    }

    // remember only when not explicitly set by URL (soft)
    if(!has('view')){
      try{ localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}
    }
  }

  async function getView(){
    const explicit = normalizeView(qs('view',''));
    if(explicit) return explicit;
    return await detectAutoView();
  }

  async function requestFullscreen(){
    const el = DOC.documentElement;
    try{
      if(DOC.fullscreenElement) return true;
      if(el.requestFullscreen){ await el.requestFullscreen(); return true; }
      // iOS safari fallback: no real fullscreen (ignore)
    }catch(_){}
    return false;
  }

  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if(o && o.lock){
        await o.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  async function requestImmersion({ preferLandscape=true } = {}){
    // Call this on a user gesture (Tap/Click)
    await requestFullscreen();
    if(preferLandscape) await lockLandscape();
  }

  // auto-apply once DOM ready (view only, not fullscreen)
  async function init(){
    const v = await getView();
    applyBodyView(v);

    WIN.HHAView = Object.freeze({
      getView,
      apply: applyBodyView,
      requestImmersion,
      isMobile
    });
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();