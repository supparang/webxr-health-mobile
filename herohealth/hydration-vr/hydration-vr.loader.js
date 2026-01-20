// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile/cVR) BUT: if ?view= exists => DO NOT override
// ✅ Cardboard: enable via ?cardboard=1 (or ?cardboard=true) and view=cvr recommended
// ✅ Sets body classes: view-pc / view-mobile / view-cvr + cardboard
// ✅ Provides window.HHA_VIEW.layers for engine (L/R when cardboard)
// ✅ Start overlay -> dispatch hha:start
// ✅ Flush logger hooks (hha:flush on hide/unload)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const qhas = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  const BODY = DOC.body;

  // ---- detect ----
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // big touch landscape -> cVR (dual-eye or center shoot)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v==='pc' || v==='desktop') return 'pc';
    if (v==='mobile' || v==='phone') return 'mobile';
    if (v==='cvr' || v==='vr' || v==='cardboard') return 'cvr';
    return '';
  }

  function isTrue(v){
    v = String(v||'').toLowerCase();
    return (v==='1' || v==='true' || v==='yes' || v==='on');
  }

  // ---- view selection (NO override if view exists) ----
  const viewInUrl = normalizeView(qs('view',''));
  const view = viewInUrl || detectView();

  const cardboard = isTrue(qs('cardboard','0'));
  // Suggest: if cardboard=1 but view not set, we still keep detected view
  // but user can force ?view=cvr&cardboard=1

  // ---- apply body classes ----
  function setBodyView(v){
    BODY.classList.remove('view-pc','view-mobile','view-cvr');
    BODY.classList.add(`view-${v}`);
    // optional convenience
    if (v==='cvr') BODY.classList.add('view-vr');
    else BODY.classList.remove('view-vr');
  }
  setBodyView(view);

  BODY.classList.toggle('cardboard', !!cardboard);

  // ---- map layers for engine ----
  // Engine (hydration.safe.js) calls getLayers() which checks window.HHA_VIEW.layers
  // We'll supply when cardboard.
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  const main = DOC.getElementById('hydration-layer');
  const cbWrap = DOC.getElementById('cbWrap');

  function setupLayers(){
    if (cardboard){
      // show split wrapper
      if (cbWrap) cbWrap.hidden = false;

      // Provide layers array if L/R exist
      if (L && R){
        WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
          layers: ['hydration-layerL','hydration-layerR']
        });
      } else {
        WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
          layers: ['hydration-layer']
        });
      }
    } else {
      // hide split wrapper, use main
      if (cbWrap) cbWrap.hidden = true;
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        layers: ['hydration-layer']
      });
    }

    // Defensive: if main missing, fall back to any existing
    if (!main && L && R){
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
    }
  }
  setupLayers();

  // ---- start overlay logic ----
  const ov = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  function hideOverlay(){
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
    try{ BODY.classList.remove('hha-has-overlay'); }catch(_){}
  }

  function showOverlay(){
    if (!ov) return;
    ov.style.display = '';
    ov.classList.remove('hide');
    try{ BODY.classList.add('hha-has-overlay'); }catch(_){}
  }

  function startGame(){
    hideOverlay();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  // update helper text
  if (ovSub){
    const modeTxt =
      cardboard ? 'Cardboard (ยิงกลางจอ + แยก 2 ตา)' :
      (view==='cvr' ? 'cVR (ยิงกลางจอ)' :
      (view==='mobile' ? 'Mobile' : 'PC'));
    ovSub.textContent = `โหมด: ${modeTxt} — แตะเริ่มได้เลย`;
  }

  // click start
  if (btnStart){
    btnStart.addEventListener('click', (e)=>{
      try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
      startGame();
    }, { passive:false });
  }

  // tap anywhere on overlay to start (kids-friendly)
  if (ov){
    ov.addEventListener('click', (e)=>{
      // if click on a button, it's already handled
      const t = e.target;
      if (t && (t.closest && t.closest('button'))) return;
      startGame();
    }, { passive:true });
  }

  // If overlay is already hidden (e.g., re-entry), auto-start
  setTimeout(()=>{
    if (!ov) {
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
      return;
    }
    const hidden = (getComputedStyle(ov).display === 'none') || ov.classList.contains('hide') || ov.hidden;
    if (hidden){
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    } else {
      showOverlay();
    }
  }, 180);

  // ---- full screen + orientation best-effort (Cardboard) ----
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
    }catch(_){}
  }
  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if (o && o.lock) await o.lock('landscape');
    }catch(_){}
  }

  if (cardboard){
    // don’t force immediately; only when user starts (gesture required)
    const doVRPrep = async ()=>{
      await requestFullscreen();
      await lockLandscape();
    };
    // run once after start click
    WIN.addEventListener('hha:start', ()=>{ doVRPrep(); }, { once:true });
  }

  // ---- flush logger hooks ----
  function flush(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
  }

  WIN.addEventListener('pagehide', flush, { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden') flush();
  }, { passive:true });
  WIN.addEventListener('beforeunload', flush, { passive:true });

})();