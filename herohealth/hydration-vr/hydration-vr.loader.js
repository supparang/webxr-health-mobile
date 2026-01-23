// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view: pc / mobile / cvr (ONLY if no ?view=...)
// ✅ NO override if view param exists
// ✅ Cardboard mode: if ?cardboard=1 (or view=cardboard) -> body.cardboard + split layers
// ✅ Sets window.HHA_VIEW.layers for engine (L/R or main)
// ✅ Start overlay: tap / button to start (unlock audio + pointer)
// ✅ Enter VR support: keeps A-Frame minimal scene intact
// ✅ Fullscreen best-effort for Cardboard (user gesture only)
// ---------------------------------------------------------

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function normView(v){
    v = String(v || '').toLowerCase().trim();
    if (!v) return '';
    if (v === 'cardboard') return 'cvr'; // cardboard uses cvr aim + split layers
    if (v === 'vr') return 'cvr';
    if (v === 'c-vr') return 'cvr';
    return v;
  }

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // heuristic:
    // - touch + landscape + wide => cVR (crosshair aim)
    // - touch otherwise => mobile
    // - non-touch => pc
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (view === 'mobile') b.classList.add('view-mobile');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-pc');
  }

  function setCardboard(on){
    DOC.body.classList.toggle('cardboard', !!on);

    const cb = DOC.getElementById('cbWrap');
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    if (cb) cb.hidden = !on;

    // When cardboard: main layer can stay but hidden by css (#hydration-layer hidden)
    // CSS in your file already: body.cardboard #hydration-layer{display:none}
    // We only ensure split layers exist.
    if (on){
      if (!L || !R){
        // fail-soft: if missing split layers, keep main visible
        try{ DOC.body.classList.remove('cardboard'); }catch(_){}
      }
    } else {
      // normal mode: main layer used
      if (main){
        // nothing else
      }
    }
  }

  function installLayersConfig(){
    const on = DOC.body.classList.contains('cardboard');
    if (on){
      WIN.HHA_VIEW = { layers: ['hydration-layerL','hydration-layerR'] };
    } else {
      WIN.HHA_VIEW = { layers: ['hydration-layer'] };
    }
  }

  // --- fullscreen / orientation best-effort (user gesture only) ---
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }catch(_){}
  }
  async function lockLandscape(){
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // --- Start overlay wiring ---
  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.style.display = 'none';
    ov.classList.add('hide');
  }

  function showOverlayText(view, cardboard){
    const sub = DOC.getElementById('ovSub');
    if (!sub) return;

    const mode =
      cardboard ? 'CARDBOARD (Split)' :
      (view === 'cvr' ? 'cVR (Crosshair)' :
      (view === 'mobile' ? 'MOBILE' : 'PC'));

    // kids-friendly phrasing
    sub.textContent = `โหมด: ${mode} — แตะ “เริ่ม!” เพื่อเริ่มเกม`;
  }

  function bindBackHub(){
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });
  }

  function startGameWithGesture(){
    // This function MUST be triggered by user gesture
    hideOverlay();

    // Let engine boot attach 'hha:start' listener then fire
    setTimeout(()=>{
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }, 60);

    // also try flush log before starting? (optional)
  }

  function bindStart(){
    const btn = DOC.getElementById('btnStart');
    const ov = DOC.getElementById('startOverlay');
    if (btn){
      btn.addEventListener('click', async ()=>{
        // Cardboard: optional fullscreen + landscape
        if (DOC.body.classList.contains('cardboard')){
          await requestFullscreen();
          await lockLandscape();
        }
        startGameWithGesture();
      }, { passive:true });
    }
    if (ov){
      // tap anywhere to start (mobile-friendly)
      ov.addEventListener('pointerdown', async (ev)=>{
        // ignore if clicking inside buttons (still fine)
        try{ ev.preventDefault(); }catch(_){}
        if (DOC.body.classList.contains('cardboard')){
          await requestFullscreen();
          await lockLandscape();
        }
        startGameWithGesture();
      }, { passive:false });
    }
  }

  // --- Main init ---
  function init(){
    // 1) Determine view without override
    const viewParam = normView(qs('view',''));
    const cardboardParam = String(qs('cardboard','0')).toLowerCase();
    const wantCardboard = (cardboardParam==='1' || cardboardParam==='true' || cardboardParam==='yes');

    // If view provided, respect it; else auto-detect
    const view = viewParam ? viewParam : detectView();

    setBodyView(view);

    // cardboard is an extra flag (split layers). Usually paired with view=cvr.
    // We only enable if explicit cardboard=1 (no surprise).
    setCardboard(!!wantCardboard);

    installLayersConfig();

    // 2) Overlay text + buttons
    showOverlayText(view, !!wantCardboard);
    bindBackHub();
    bindStart();

    // 3) Expose helpers
    WIN.HHA_LOADER = WIN.HHA_LOADER || {};
    WIN.HHA_LOADER.view = view;
    WIN.HHA_LOADER.cardboard = !!wantCardboard;
    WIN.HHA_LOADER.layers = (WIN.HHA_VIEW && WIN.HHA_VIEW.layers) ? WIN.HHA_VIEW.layers.slice() : [];

    // 4) Safety: if overlay was removed by accident, auto start
    const ov = DOC.getElementById('startOverlay');
    setTimeout(()=>{
      const hidden = !ov || getComputedStyle(ov).display === 'none' || ov.classList.contains('hide');
      if (hidden){
        try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
      }
    }, 700);
  }

  // DOM ready
  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

})();