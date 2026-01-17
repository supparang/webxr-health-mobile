// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) BUT "DO NOT OVERRIDE" if ?view= exists
// ✅ Cardboard mode: ?cardboard=1 => enable split layers + body.cardboard
// ✅ Sets body class: view-pc | view-mobile | view-cvr
// ✅ Exposes: window.HHA_VIEW = { view, cardboard, layers:[...] }
// ✅ Tap-to-start overlay: click Start => emits hha:start (once)
// ✅ Back to HUB button support

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  };

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function hasViewParam(){
    try{
      const u = new URL(location.href);
      return u.searchParams.has('view');
    }catch(_){ return false; }
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v === 'pc' || v === 'desktop') return 'pc';
    if (v === 'mobile' || v === 'phone') return 'mobile';
    if (v === 'cvr' || v === 'vr' || v === 'cardboard') return 'cvr';
    return '';
  }

  function detectView(){
    // heuristic: touch => mobile, touch+wide landscape => cvr
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, innerWidth||1);
    const h = Math.max(1, innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function applyBodyClass(view, cardboard){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    b.classList.add(view === 'cvr' ? 'view-cvr' : (view === 'mobile' ? 'view-mobile' : 'view-pc'));
    if (cardboard) b.classList.add('cardboard');
  }

  function setupLayers(cardboard){
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');
    const cbWrap = DOC.getElementById('cbWrap');

    if (cardboard){
      if (cbWrap) cbWrap.hidden = false;

      // expose which layers engine should spawn into
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];

      // hide main layer is done by CSS body.cardboard #hydration-layer {display:none;}
      if (main) main.setAttribute('aria-hidden','true');
    } else {
      if (cbWrap) cbWrap.hidden = true;

      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layer'];

      if (main) main.removeAttribute('aria-hidden');
    }

    // sanity: if missing nodes, fall back to main
    const ids = (WIN.HHA_VIEW && Array.isArray(WIN.HHA_VIEW.layers)) ? WIN.HHA_VIEW.layers : [];
    const ok = ids.every(id => !!DOC.getElementById(id));
    if (!ok){
      WIN.HHA_VIEW.layers = ['hydration-layer'];
      if (cbWrap) cbWrap.hidden = true;
      try{ DOC.body.classList.remove('cardboard'); }catch(_){}
    }
  }

  function resolveHub(){
    const hub = String(qs('hub','../hub.html'));
    return hub || '../hub.html';
  }

  // ---------- Decide view ----------
  let view = '';
  if (hasViewParam()){
    // ✅ DO NOT OVERRIDE
    view = normalizeView(qs('view','pc')) || 'pc';
  } else {
    view = detectView();
  }

  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const cardboard = (cardboardQ === '1' || cardboardQ === 'true' || cardboardQ === 'yes');

  // apply
  applyBodyClass(view, cardboard);
  setupLayers(cardboard);

  // expose config for engine
  WIN.HHA_VIEW = WIN.HHA_VIEW || {};
  WIN.HHA_VIEW.view = view;
  WIN.HHA_VIEW.cardboard = !!cardboard;

  // ---------- Start overlay ----------
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  // If overlay exists, show helpful label
  if (ovSub){
    const run = String(qs('run', qs('runMode','play'))).toLowerCase();
    const kids = String(qs('kids','0')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(parseInt(qs('time', qs('durationPlannedSec', 70)),10)||70, 20, 600);

    const kidsOn = (kids==='1'||kids==='true'||kids==='yes');
    const tagKids = kidsOn ? ' • Kids' : '';
    ovSub.textContent = `โหมด: ${view.toUpperCase()}${cardboard ? ' • Cardboard' : ''} • ${run} • ${diff} • ${time}s${tagKids}`;
  }

  function hideOverlay(){
    if (!overlay) return;
    overlay.classList.add('hide');
    overlay.style.display = 'none';
  }

  let started = false;
  function startGame(){
    if (started) return;
    started = true;
    hideOverlay();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  // Tap anywhere on overlay card -> start
  if (overlay){
    overlay.addEventListener('pointerdown', (e)=>{
      // only start if click is not on a button that has its own handler
      if (e && e.target && (e.target.closest && e.target.closest('button'))) return;
      startGame();
    }, {passive:true});
  }

  // Start button
  if (btnStart){
    btnStart.addEventListener('click', ()=> startGame());
  }

  // Back HUB buttons
  const hub = resolveHub();
  const backBtns = DOC.querySelectorAll('.btnBackHub');
  backBtns.forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      try{ e.preventDefault(); }catch(_){}
      location.href = hub;
    });
  });

  // If overlay missing (edge) -> auto start shortly
  setTimeout(()=>{
    if (!overlay && !started){
      startGame();
    }
  }, 600);

})();