// === /herohealth/vr/view-helper.js ===
// HHA View Helper — PRODUCTION
// - Apply body view classes: view-pc / view-mobile / view-vr / view-cvr
// - Best-effort fullscreen + landscape lock for cVR
// - HUD guard: expose safe bottom offset to avoid covering EnterVR button
// - Emits: hha:view (detail: { view, isFS, isLandscape, safeBottomPx })

(function(){
  'use strict';
  const ROOT = window;
  const DOC  = document;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  const VIEW = (qs('view','mobile')||'mobile').toLowerCase();
  const view = (VIEW==='cvr')?'cvr':(VIEW==='vr')?'vr':(VIEW==='pc')?'pc':'mobile';

  function emit(name, detail){
    try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function isFullscreen(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }

  function isLandscape(){
    const so = ROOT.screen && ROOT.screen.orientation;
    if(so && typeof so.type === 'string'){
      return so.type.includes('landscape');
    }
    return (ROOT.innerWidth || 0) >= (ROOT.innerHeight || 0);
  }

  function applyBodyView(){
    const b = DOC.body;
    if(!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(view==='cvr'?'view-cvr':view==='vr'?'view-vr':view==='pc'?'view-pc':'view-mobile');
  }

  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if(el.requestFullscreen) await el.requestFullscreen();
      else if(el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      return true;
    }catch(_){ return false; }
  }

  async function lockLandscape(){
    try{
      const so = ROOT.screen && ROOT.screen.orientation;
      if(so && so.lock){
        await so.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  function calcSafeBottom(){
    // สำหรับกัน HUD ทับ EnterVR/exit/recenter (และ safe-area iOS)
    const sab = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sab')) || 0;
    const base = 10 + sab;
    // cVR ควรยกพื้นที่ปุ่มให้สูงขึ้นหน่อย
    const extra = (view==='cvr') ? 16 : 0;
    return Math.round(base + extra);
  }

  function applyHudGuard(){
    const safeBottomPx = calcSafeBottom();
    DOC.documentElement.style.setProperty('--hhaSafeBottom', safeBottomPx + 'px');
    emit('hha:view', { view, isFS: isFullscreen(), isLandscape: isLandscape(), safeBottomPx });
  }

  async function ensureCVR(){
    if(view !== 'cvr') return;
    // Best effort: fullscreen + landscape (user gesture required in many browsers)
    await requestFullscreen();
    await lockLandscape();
    applyHudGuard();
  }

  function init(){
    applyBodyView();
    applyHudGuard();

    // keep updating on changes
    ROOT.addEventListener('resize', applyHudGuard, { passive:true });
    ROOT.addEventListener('orientationchange', applyHudGuard, { passive:true });
    DOC.addEventListener('fullscreenchange', applyHudGuard, { passive:true });
    DOC.addEventListener('webkitfullscreenchange', applyHudGuard, { passive:true });

    const vv = ROOT.visualViewport;
    if(vv){
      vv.addEventListener('resize', applyHudGuard, { passive:true });
      vv.addEventListener('scroll', applyHudGuard, { passive:true });
    }

    // expose helper
    ROOT.HHA_VIEW_HELPER = {
      view,
      ensureCVR,
      requestFullscreen,
      lockLandscape,
      applyHudGuard,
      isFullscreen,
      isLandscape,
    };
  }

  init();
})();