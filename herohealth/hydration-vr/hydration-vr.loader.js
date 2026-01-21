// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile/cVR) BUT: if ?view= exists -> DO NOT override
// ✅ Cardboard support: ?cardboard=1 (works with view=cvr)
// ✅ Sets body classes: view-pc | view-mobile | view-cvr | cardboard
// ✅ Provides window.HHA_VIEW.layers for engine (hydration-layer / L,R)
// ✅ Start overlay: tap/click to start => dispatch hha:start
// ✅ Fullscreen + orientation (best-effort) for mobile/cardboard
// ✅ Back to HUB + safe passthrough

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const hub = String(qs('hub','../hub.html'));
  const viewQ = String(qs('view','')||'').toLowerCase();   // if provided => lock
  const cardboardQ = String(qs('cardboard','0')||'').toLowerCase();
  const cardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  // ---------- View detect (only used when no ?view=) ----------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // Touch devices: mobile default; if big landscape => cVR
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  const view = viewQ || detectView();

  // ---------- Body classes ----------
  function setBodyClasses(){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    if (view === 'pc') b.classList.add('view-pc');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-mobile');

    if (cardboard) b.classList.add('cardboard');
  }

  // ---------- Layers config for engine ----------
  function setLayers(){
    // Default single layer
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    // If cardboard: show cbWrap + use L/R
    const cbWrap = DOC.getElementById('cbWrap');
    if (cardboard){
      if (cbWrap) cbWrap.hidden = false;
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'].filter(id=>DOC.getElementById(id));
    } else {
      if (cbWrap) cbWrap.hidden = true;
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layer'].filter(id=>DOC.getElementById(id));
    }

    // Guard: if missing, fallback to any existing layer
    if (!WIN.HHA_VIEW.layers || WIN.HHA_VIEW.layers.length === 0){
      const any = [main,L,R].filter(Boolean).map(el=>el.id);
      WIN.HHA_VIEW.layers = any.length ? any : ['hydration-layer'];
    }
  }

  // ---------- Fullscreen helpers ----------
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI:'hide' }); return true; }
      // iOS Safari fallback (no real fullscreen)
    }catch(_){}
    return false;
  }

  async function tryLandscapeLock(){
    try{
      const scr = WIN.screen;
      if (scr && scr.orientation && scr.orientation.lock){
        // Cardboard: prefer landscape
        await scr.orientation.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  // ---------- Start overlay ----------
  function bindStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btnStart = DOC.getElementById('btnStart');
    const ovSub = DOC.getElementById('ovSub');

    // Show device hint
    if (ovSub){
      const kids = String(qs('kids','0')).toLowerCase();
      const kidsOn = (kids==='1'||kids==='true'||kids==='yes');
      const label = cardboard ? 'CARDBOARD' : (view==='cvr' ? 'cVR' : (view==='mobile' ? 'MOBILE' : 'PC'));
      ovSub.textContent = kidsOn
        ? `โหมดเด็ก (Kids) • ตรวจพบ: ${label} • แตะเพื่อเริ่ม`
        : `ตรวจพบ: ${label} • แตะเพื่อเริ่ม`;
    }

    function hideAndStart(){
      try{
        if (ov) ov.style.display = 'none';
      }catch(_){}
      // fire start
      try{
        WIN.dispatchEvent(new CustomEvent('hha:start', { detail:{ view, cardboard } }));
      }catch(_){}
    }

    async function startFlow(){
      // best-effort: fullscreen & landscape on touch/cardboard
      const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
      if (isTouch || cardboard){
        await requestFullscreen();
        if (cardboard) await tryLandscapeLock();
      }
      hideAndStart();
    }

    // Buttons / tap to start
    btnStart?.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){ } startFlow(); });

    ov?.addEventListener('click', (e)=>{
      // allow click anywhere on overlay card too
      if (!e) return;
      startFlow();
    });

    // Back to hub buttons
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
        location.href = hub;
      });
    });

    // If overlay missing, auto-start quickly
    if (!ov){
      setTimeout(()=>{ 
        try{ WIN.dispatchEvent(new CustomEvent('hha:start', { detail:{ view, cardboard } })); }catch(_){}
      }, 300);
    }
  }

  // ---------- Bootstrap ----------
  function boot(){
    setBodyClasses();
    setLayers();
    bindStartOverlay();

    // Expose a small view object for debugging
    WIN.HHA_VIEW = Object.assign(WIN.HHA_VIEW || {}, {
      view,
      cardboard,
      hub
    });
  }

  // Run after DOM ready
  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();