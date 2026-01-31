// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION
// ✅ Auto-detect view if no ?view=
// ✅ Do NOT override if ?view= exists
// ✅ Ensures URL has view param (replaceState only when missing) so vr-ui.js works reliably
// ✅ Sets body classes: view-pc / view-mobile / view-cvr / cardboard
// ✅ Sets window.HHA_VIEW.layers for main vs cardboard split
// ✅ Imports hydration.safe.js

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  };

  const hasViewParam = ()=>{
    try{ return !!new URL(location.href).searchParams.get('view'); }
    catch(_){ return false; }
  };

  const isCoarse = ()=>{
    try{ return !!(matchMedia && matchMedia('(pointer:coarse)').matches); }
    catch(_){ return false; }
  };

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if (!v) return '';
    if (v === 'pc' || v === 'desktop') return 'pc';
    if (v === 'mobile' || v === 'phone') return 'mobile';
    if (v === 'cvr' || v === 'cardboard-crosshair') return 'cvr';
    if (v === 'cardboard' || v === 'vrbox' || v === 'split') return 'cardboard';
    if (v === 'vr') return 'vr';
    return v; // unknown -> keep
  }

  function detectView(){
    // Respect param if provided (no override)
    const pv = normalizeView(qs('view',''));
    if (pv) return pv;

    // Minimal detection: coarse pointer => mobile; otherwise pc
    // (Cardboard/cVR normally comes from link params / launcher)
    return isCoarse() ? 'mobile' : 'pc';
  }

  function ensureViewParam(view){
    // Only if missing
    if (hasViewParam()) return;
    try{
      const u = new URL(location.href);
      u.searchParams.set('view', view);
      history.replaceState(null, '', u.toString());
    }catch(_){}
  }

  function applyBodyClasses(view){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');

    if (view === 'cardboard'){
      b.classList.add('cardboard');
      // keep a hint class too (optional)
      b.classList.add('view-vr');
    } else if (view === 'cvr'){
      b.classList.add('view-cvr');
      b.classList.add(isCoarse() ? 'view-mobile' : 'view-pc');
    } else if (view === 'mobile'){
      b.classList.add('view-mobile');
    } else if (view === 'vr'){
      // DOM-based VR (Quest browser) — treat like mobile/pc with vr hint
      b.classList.add('view-vr');
      b.classList.add(isCoarse() ? 'view-mobile' : 'view-pc');
    } else {
      b.classList.add('view-pc');
    }
  }

  function setHHAViewConfig(view){
    // For hydration.safe.js -> getLayers()
    const isCard = (view === 'cardboard');
    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
      view,
      layers: isCard ? ['hydration-layerL','hydration-layerR'] : ['hydration-layer']
    });
  }

  function updateStartSubtitle(){
    const sub = DOC.getElementById('start-sub');
    if (!sub) return;

    const b = DOC.body;
    let label = 'PC';
    if (b.classList.contains('cardboard')) label = 'VR Cardboard (Split)';
    else if (b.classList.contains('view-cvr')) label = 'cVR (Crosshair ยิงกลางจอ)';
    else if (b.classList.contains('view-mobile')) label = 'Mobile';
    else if (b.classList.contains('view-vr')) label = 'VR';

    sub.textContent = `โหมดตรวจจับแล้ว: ${label}  •  แตะเพื่อเริ่ม`;
  }

  function hardenGlobalErrors(){
    if (WIN.__HHA_HYD_LOADER_ERR__) return;
    WIN.__HHA_HYD_LOADER_ERR__ = true;

    WIN.addEventListener('error', (ev)=>{
      try{
        const msg = (ev && ev.message) ? String(ev.message) : 'Unknown error';
        WIN.dispatchEvent(new CustomEvent('hha:error', { detail:{ source:'loader', msg } }));
      }catch(_){}
    });

    WIN.addEventListener('unhandledrejection', (ev)=>{
      try{
        const msg = ev && ev.reason ? String(ev.reason) : 'Unhandled rejection';
        WIN.dispatchEvent(new CustomEvent('hha:error', { detail:{ source:'loader', msg } }));
      }catch(_){}
    });
  }

  async function boot(){
    hardenGlobalErrors();

    const view = detectView();
    ensureViewParam(view);         // ONLY if missing
    applyBodyClasses(view);
    setHHAViewConfig(view);
    updateStartSubtitle();

    // Small delay helps ensure defer scripts are ready (vr-ui/particles/logger)
    await new Promise(r=>setTimeout(r, 0));

    try{
      await import('./hydration.safe.js');
      WIN.dispatchEvent(new CustomEvent('hha:loader_ready', { detail:{ view } }));
    }catch(err){
      try{
        const msg = err ? String(err) : 'import failed';
        WIN.dispatchEvent(new CustomEvent('hha:error', { detail:{ source:'loader', msg } }));
      }catch(_){}
      // Also show on start subtitle if possible
      const sub = DOC.getElementById('start-sub');
      if (sub) sub.textContent = `โหลดเกมไม่สำเร็จ: ${String(err||'error')}`;
    }
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
