// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST / HHA Standard)
// ✅ Auto-detect view: pc | mobile | cvr
// ✅ DO NOT override if URL already has ?view=...
// ✅ Cardboard mode: ?cardboard=1 => body.cardboard + layers [L,R]
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Ensures HHA_VIEW.layers for engine spawn to mount correctly
// ✅ Start overlay: tap anywhere or click "เริ่ม!" => emit hha:start
// ✅ Fullscreen best-effort for mobile/cardboard on start
// ✅ Back-to-HUB buttons supported (.btnBackHub)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    b.classList.add(`view-${view}`);
  }

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // on big landscape touch => cVR feels better (crosshair shooting)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function requestFullscreen(){
    const el = DOC.documentElement;
    try{
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (fn) fn.call(el);
    }catch(_){}
  }

  function bestEffortLandscapeLock(){
    try{
      const scr = WIN.screen;
      const ori = scr && scr.orientation;
      if (ori && ori.lock) ori.lock('landscape').catch(()=>{});
    }catch(_){}
  }

  function setupLayers(){
    // Cardboard mode: engine spawns into L/R layers
    const cardboard = String(qs('cardboard','0')).toLowerCase();
    const isCB = (cardboard==='1' || cardboard==='true' || cardboard==='yes');

    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');
    const cbWrap = DOC.getElementById('cbWrap');

    if (isCB){
      DOC.body.classList.add('cardboard');
      if (cbWrap) cbWrap.hidden = false;

      // set engine layer list
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        layers: ['hydration-layerL','hydration-layerR']
      });
    } else {
      DOC.body.classList.remove('cardboard');
      if (cbWrap) cbWrap.hidden = true;

      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        layers: ['hydration-layer']
      });
    }

    // Safety: if missing nodes, fallback to main
    const cfg = WIN.HHA_VIEW || {};
    const ids = Array.isArray(cfg.layers) ? cfg.layers : [];
    const ok = ids.some(id=>DOC.getElementById(id));
    if (!ok && main){
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, { layers:['hydration-layer'] });
      DOC.body.classList.remove('cardboard');
      if (cbWrap) cbWrap.hidden = true;
    }
  }

  function bindHubButtons(){
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        WIN.location.href = hub;
      });
    });
  }

  function bindStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    if (!ov) return;

    let started = false;

    function start(){
      if (started) return;
      started = true;

      // Hide overlay
      try{ ov.classList.add('hide'); }catch(_){}
      try{ ov.style.display = 'none'; }catch(_){}

      // Fullscreen best-effort on touch devices / cardboard
      const view = (String(qs('view',''))||'').toLowerCase();
      const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
      const isCB = DOC.body.classList.contains('cardboard');

      if (isTouch || isCB){
        requestFullscreen();
        if (isCB) bestEffortLandscapeLock();
      }

      emit('hha:start', { view, ts: Date.now() });
    }

    // Click button
    btn?.addEventListener('click', (e)=>{
      try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
      start();
    }, { passive:false });

    // Tap overlay anywhere
    ov.addEventListener('pointerdown', (e)=>{
      // ignore taps on buttons (they already handled)
      const t = e.target;
      if (t && (t.closest && t.closest('button'))) return;
      try{ e.preventDefault(); }catch(_){}
      start();
    }, { passive:false });

    // Also support Enter key (desktop)
    WIN.addEventListener('keydown', (e)=>{
      if (started) return;
      if (e.key === 'Enter' || e.key === ' '){
        start();
      }
    });
  }

  function init(){
    // view decision
    const viewParam = String(qs('view','')||'').toLowerCase();
    const view = viewParam || detectView(); // ✅ do not override if viewParam exists

    // set body class for styling / engine checks
    setBodyView(view);

    // mark cVR strict helper (optional): your vr-ui.js already uses body.view-cvr
    if (view === 'cvr') DOC.body.classList.add('view-cvr');

    // setup layers (cardboard)
    setupLayers();

    // bind buttons
    bindHubButtons();

    // start overlay
    bindStartOverlay();

    // update overlay subtitle if exists
    const ovSub = DOC.getElementById('ovSub');
    if (ovSub){
      const kids = String(qs('kids','0')).toLowerCase();
      const kOn = (kids==='1'||kids==='true'||kids==='yes');
      ovSub.textContent = `โหมด: ${view.toUpperCase()}${DOC.body.classList.contains('cardboard')?' + Cardboard':''}${kOn?' (Kids)':''} • แตะเพื่อเริ่ม`;
    }
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})();