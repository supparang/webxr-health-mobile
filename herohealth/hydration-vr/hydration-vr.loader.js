// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) BUT: NEVER override if ?view= exists
// ✅ Cardboard: if ?cardboard=1 -> body.cardboard + set window.HHA_VIEW.layers
// ✅ Applies body classes: view-pc / view-mobile / view-cvr
// ✅ Start Overlay: tap/click -> hide overlay -> dispatch hha:start
// ✅ Mobile helpers: best-effort fullscreen + landscape hint for cardboard/cvr
// ✅ Flush triggers: dispatch hha:flush before leaving (for logger)
//
// Used by: /herohealth/hydration-vr/hydration-vr.html
// ------------------------------------------------------------

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const emit = (name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } };

  const BODY = DOC.body;

  // ---------------- View detect (NO override if query exists) ----------------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // Touch device:
    // - if landscape and wide -> cVR (crosshair shooting)
    // - else -> mobile
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    // Desktop -> pc
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v === 'pc') return 'pc';
    if (v === 'mobile') return 'mobile';
    if (v === 'cvr' || v === 'vr') return 'cvr';
    return '';
  }

  function applyViewClasses(view){
    BODY.classList.remove('view-pc','view-mobile','view-cvr');
    if (view === 'pc') BODY.classList.add('view-pc');
    if (view === 'mobile') BODY.classList.add('view-mobile');
    if (view === 'cvr') BODY.classList.add('view-cvr');
  }

  // ---------------- Cardboard ----------------
  function isCardboard(){
    const cb = String(qs('cardboard','0')).toLowerCase();
    return (cb === '1' || cb === 'true' || cb === 'yes');
  }

  function setupCardboardLayers(enable){
    const cbWrap = DOC.getElementById('cbWrap');
    const layerMain = DOC.getElementById('hydration-layer');
    const layerL = DOC.getElementById('hydration-layerL');
    const layerR = DOC.getElementById('hydration-layerR');

    if (!enable){
      BODY.classList.remove('cardboard');
      if (cbWrap) cbWrap.hidden = true;
      // default to main layer
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        layers: layerMain ? ['hydration-layer'] : []
      });
      return;
    }

    BODY.classList.add('cardboard');
    if (cbWrap) cbWrap.hidden = false;

    // In cardboard, we render into L/R if present
    const layers = [];
    if (layerL) layers.push('hydration-layerL');
    if (layerR) layers.push('hydration-layerR');

    // Fallback: if missing L/R, still use main
    if (!layers.length && layerMain) layers.push('hydration-layer');

    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, { layers });
  }

  // ---------------- Fullscreen & orientation helpers ----------------
  async function requestFullscreenBestEffort(){
    // Never force on desktop; only try after user gesture
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
    }catch(_){}
  }

  async function tryLockLandscapeBestEffort(){
    // Only available on some mobile browsers
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // ---------------- Start overlay ----------------
  function setupStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const backBtns = Array.from(DOC.querySelectorAll('.btnBackHub'));

    const hub = String(qs('hub','../hub.html'));

    function hideOverlay(){
      if (!ov) return;
      ov.classList.add('hide');
      ov.style.display = 'none';
    }

    function startNow(){
      if (WIN.__HHA_STARTED__) return;
      WIN.__HHA_STARTED__ = true;

      // Before start: best effort full screen for mobile/cVR and landscape for cardboard
      const view = BODY.classList.contains('view-cvr') ? 'cvr'
                 : BODY.classList.contains('view-mobile') ? 'mobile'
                 : 'pc';

      const cb = BODY.classList.contains('cardboard');

      // Must be called from user gesture
      Promise.resolve()
        .then(()=> (view !== 'pc') ? requestFullscreenBestEffort() : null)
        .then(()=> (cb || view==='cvr') ? tryLockLandscapeBestEffort() : null)
        .catch(()=>{})
        .finally(()=>{
          hideOverlay();
          emit('hha:start', { view, cardboard: cb, kids: String(qs('kids','0')) });
        });
    }

    if (btn){
      btn.addEventListener('click', (e)=>{
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
        startNow();
      }, { passive:false });
    }

    // Tap anywhere on overlay to start (kids-friendly)
    if (ov){
      ov.addEventListener('click', ()=>{
        // if user clicks inside card but not on buttons, still start
        startNow();
      }, { passive:true });
    }

    backBtns.forEach(b=>{
      b.addEventListener('click', (e)=>{
        try{ e.preventDefault(); }catch(_){}
        // flush logs before leaving
        emit('hha:flush', { reason:'backHub' });
        location.href = hub;
      }, { passive:false });
    });

    // Set subtitle
    const ovSub = DOC.getElementById('ovSub');
    if (ovSub){
      const kids = String(qs('kids','0')).toLowerCase();
      const isKids = (kids==='1' || kids==='true' || kids==='yes');
      ovSub.textContent = isKids ? 'แตะเพื่อเริ่ม (โหมดเด็ก 👧🧒)' : 'แตะเพื่อเริ่ม';
    }
  }

  // ---------------- Init ----------------
  function init(){
    // Determine view: if ?view= exists => respect it; else detect
    const viewQ = normalizeView(qs('view',''));
    const view = viewQ || detectView();   // ✅ NO override if query exists

    applyViewClasses(view);

    // Cardboard: only if query says so
    setupCardboardLayers(isCardboard());

    // Optional: mark device for logger
    WIN.HHA_DEVICE = view + (isCardboard() ? '+cardboard' : '');

    // Start overlay
    setupStartOverlay();

    // Safety flush on leaving page
    WIN.addEventListener('pagehide', ()=> emit('hha:flush', { reason:'pagehide' }), { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') emit('hha:flush', { reason:'hidden' });
    }, { passive:true });

    // If some external script already hides overlay, auto-start after short delay
    const ov = DOC.getElementById('startOverlay');
    setTimeout(()=>{
      const hidden = !ov || getComputedStyle(ov).display==='none' || ov.classList.contains('hide');
      if (hidden && !WIN.__HHA_STARTED__){
        WIN.__HHA_STARTED__ = true;
        emit('hha:start', { view, cardboard: isCardboard(), kids: String(qs('kids','0')) });
      }
    }, 650);
  }

  if (DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    init();
  } else {
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }

})();