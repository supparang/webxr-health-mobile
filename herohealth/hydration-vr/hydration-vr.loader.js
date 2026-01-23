// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile/cVR) — BUT: if ?view= exists -> NEVER override
// ✅ Cardboard mode: body.cardboard + mount split layers (#hydration-layerL/#hydration-layerR)
// ✅ Start overlay: tap-to-start + button start => emits hha:start (once)
// ✅ Best-effort fullscreen + landscape lock for Cardboard (mobile)
// ✅ Safe: does NOT depend on engine, only prepares UI + classes + layers cfg
// ------------------------------------------------------

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  const startOverlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const cbWrap = DOC.getElementById('cbWrap');
  const playfield = DOC.getElementById('playfield');
  const cbPlayfield = DOC.getElementById('cbPlayfield');

  const L_MAIN = 'hydration-layer';
  const L_L = 'hydration-layerL';
  const L_R = 'hydration-layerR';

  function hasTouch(){
    return ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  }
  function isMobileUA(){
    const ua = (navigator.userAgent||'').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/.test(ua);
  }

  // DO NOT override if view param exists
  function getViewResolved(){
    const vRaw = (qs('view','')||'').toLowerCase().trim();
    if (vRaw) return vRaw;

    // auto-detect (best effort)
    // - if touch/mobile -> mobile
    // - else pc
    const mobile = hasTouch() || isMobileUA();
    return mobile ? 'mobile' : 'pc';
  }

  function applyBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');

    // normalize synonyms
    let v = (view||'').toLowerCase();
    if (v === 'desktop') v = 'pc';
    if (v === 'phone') v = 'mobile';

    // cVR strict mode: aim from center (vr-ui.js handles)
    if (v === 'cvr') b.classList.add('view-cvr');
    else if (v === 'vr') b.classList.add('view-vr');
    else if (v === 'pc') b.classList.add('view-pc');
    else b.classList.add('view-mobile');

    // Cardboard enable:
    // - explicit ?view=cardboard OR ?cardboard=1
    const cardboard = (v === 'cardboard') || (String(qs('cardboard','0')).toLowerCase()==='1');
    if (cardboard) b.classList.add('cardboard');

    return { view: v, cardboard };
  }

  // Best-effort fullscreen + landscape lock (Cardboard)
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI:'hide' });
    }catch(_){}
  }
  async function lockLandscape(){
    try{
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    }catch(_){}
  }

  // Setup cardboard layers mount
  function setupLayers(cardboard){
    const mainLayer = DOC.getElementById(L_MAIN);
    const layerL = DOC.getElementById(L_L);
    const layerR = DOC.getElementById(L_R);

    if (cardboard){
      if (cbWrap) cbWrap.hidden = false;
      // ensure main layer doesn't capture taps
      if (mainLayer) mainLayer.style.display = 'none';

      // expose layer ids for engine
      WIN.HHA_VIEW = {
        view: 'cardboard',
        cardboard: true,
        layers: [L_L, L_R],
        playfieldId: 'cbPlayfield'
      };
    } else {
      if (cbWrap) cbWrap.hidden = true;
      if (mainLayer) mainLayer.style.display = '';

      WIN.HHA_VIEW = {
        view: getViewResolved(),
        cardboard: false,
        layers: [L_MAIN],
        playfieldId: 'playfield'
      };
    }

    // protect against missing layer elements (fallback to main)
    const ok =
      (WIN.HHA_VIEW.layers||[])
        .map(id=>DOC.getElementById(id))
        .filter(Boolean)
        .length > 0;

    if (!ok){
      WIN.HHA_VIEW.layers = [L_MAIN];
      WIN.HHA_VIEW.cardboard = false;
      if (cbWrap) cbWrap.hidden = true;
      if (mainLayer) mainLayer.style.display = '';
    }
  }

  // Start overlay handling (tap anywhere => start)
  function hideStartOverlay(){
    if (!startOverlay) return;
    startOverlay.classList.add('hide');
    startOverlay.style.display = 'none';
  }

  let started = false;
  function fireStart(){
    if (started) return;
    started = true;

    // resume AudioContext if any
    try{
      const AC = WIN.__HHA_AUDIO_CONTEXT__;
      if (AC && AC.state === 'suspended') AC.resume();
    }catch(_){}

    hideStartOverlay();

    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindStartOverlay(){
    if (!startOverlay) return;

    const tap = (ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      fireStart();
    };

    // button
    if (btnStart){
      btnStart.addEventListener('click', (ev)=>{ tap(ev); }, { passive:false });
    }

    // tap overlay background
    startOverlay.addEventListener('pointerdown', (ev)=>{
      // allow clicking inside card without blocking
      const card = startOverlay.querySelector('.overlay-card');
      if (card && card.contains(ev.target) && (ev.target && ev.target.closest && ev.target.closest('button'))) return;
      tap(ev);
    }, { passive:false });

    // also allow Enter key (PC)
    WIN.addEventListener('keydown', (ev)=>{
      if (ev.key === 'Enter' || ev.key === ' '){
        fireStart();
      }
    }, { passive:true });
  }

  function bindBackHub(){
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        location.href = hub;
      });
    });
  }

  // ---- INIT ----
  const view = getViewResolved();
  const { cardboard } = applyBodyView(view);
  setupLayers(cardboard);
  bindBackHub();
  bindStartOverlay();

  // Cardboard UX help
  if (cardboard){
    // best-effort on first tap to start:
    // fullscreen + landscape for better split view
    const onFirstTap = async ()=>{
      WIN.removeEventListener('pointerdown', onFirstTap, true);
      await requestFullscreen();
      await lockLandscape();
    };
    WIN.addEventListener('pointerdown', onFirstTap, true);
  }

})();