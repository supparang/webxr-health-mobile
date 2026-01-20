// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile/cVR) BUT: if ?view= exists -> DO NOT override
// ✅ Cardboard flag: ?cardboard=1 => body.cardboard + force view=cvr semantics
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Provides window.HHA_VIEW = { view, cardboard, layers: ['hydration-layer', ...] }
// ✅ Controls Start Overlay: tap/click Start => dispatches hha:start
// ✅ Hub back button wiring (.btnBackHub)
// ✅ Best-effort fullscreen/orientation for mobile/cardboard (non-blocking)
// --------------------------------------------------------

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const hub = String(qs('hub','../hub.html'));
  const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();

  // ---- Detect view (NO override if ?view= exists) ----
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // wide landscape phones/tablets => cVR (crosshair)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v === 'vr') return 'cvr';
    if (v === 'cardboard') return 'cvr';
    if (v !== 'pc' && v !== 'mobile' && v !== 'cvr') return '';
    return v;
  }

  const viewQ = normalizeView(qs('view',''));
  let view = viewQ || detectView();          // ✅ do not override explicit ?view=
  const cardboard = String(qs('cardboard','0')).toLowerCase();
  const isCardboard = (cardboard==='1' || cardboard==='true' || cardboard==='yes');

  // If cardboard is requested, treat it as cVR base view
  if (isCardboard) view = 'cvr';

  // ---- Apply body classes ----
  function setBodyView(v){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    b.classList.add(v==='pc' ? 'view-pc' : v==='cvr' ? 'view-cvr' : 'view-mobile');
    if (isCardboard) b.classList.add('cardboard');
  }
  setBodyView(view);

  // ---- Layers config for engine (hydration.safe.js uses HHA_VIEW.layers) ----
  function setLayers(){
    const layers = [];
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    if (isCardboard && L && R){
      layers.push('hydration-layerL','hydration-layerR');
      // show cbWrap even if markup has [hidden]
      const cbWrap = DOC.getElementById('cbWrap');
      if (cbWrap) cbWrap.hidden = false;
    } else {
      if (main) layers.push('hydration-layer');
      const cbWrap = DOC.getElementById('cbWrap');
      if (cbWrap) cbWrap.hidden = true;
    }

    WIN.HHA_VIEW = {
      view,
      cardboard: !!isCardboard,
      layers
    };
  }
  setLayers();

  // ---- Start overlay controls ----
  const ov = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  function hideOverlay(){
    if (!ov) return;
    ov.style.display = 'none';
    ov.classList.add('hide');
  }

  function startGame(){
    hideOverlay();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    // If cloud logger exists, request flush on start (harmless)
    try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
  }

  // Update overlay subtitle
  if (ovSub){
    const label = (view==='pc' ? 'PC' : view==='cvr' ? 'cVR' : 'Mobile') + (isCardboard ? ' + Cardboard' : '');
    ovSub.textContent =
      (run==='research' || run==='study')
        ? `โหมดวิจัย (${label}) — แตะเริ่ม`
        : `พร้อมเล่นแล้ว (${label}) — แตะเริ่ม`;
  }

  // Tap anywhere on overlay => start (kids-friendly)
  if (ov){
    ov.addEventListener('pointerdown', (ev)=>{
      // don't auto start if user taps inside card buttons (still ok, but keep safe)
      const t = ev.target;
      const isBtn = t && (t.closest && t.closest('button'));
      if (isBtn) return;
      startGame();
    }, { passive:true });
  }
  btnStart?.addEventListener('click', ()=> startGame(), { passive:true });

  // Hub back buttons
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = hub; }, { passive:true });
  });

  // ---- Best-effort Fullscreen / Orientation (non-blocking) ----
  async function tryFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen && !DOC.fullscreenElement){
        await el.requestFullscreen();
      }
    }catch(_){}
  }
  async function tryLandscapeLock(){
    try{
      // Some browsers allow this only after gesture; this is best-effort.
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // In mobile/cardboard, give a hint: user taps Start -> we try FS + landscape
  function afterStartHelpers(){
    if (view === 'pc') return;
    // Attempt after a short delay to ride on the same user gesture window
    setTimeout(()=>{ tryFullscreen(); }, 40);
    setTimeout(()=>{ if (isCardboard) tryLandscapeLock(); }, 120);
  }
  btnStart?.addEventListener('click', afterStartHelpers, { passive:true });
  if (ov){
    ov.addEventListener('pointerdown', afterStartHelpers, { passive:true });
  }

  // ---- Safety: if overlay somehow hidden by css, auto start ----
  setTimeout(()=>{
    if (!ov) return;
    const disp = getComputedStyle(ov).display;
    const hidden = (disp === 'none') || ov.classList.contains('hide');
    if (hidden){
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }
  }, 600);

})();