// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration Quest VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile/cVR) BUT: if ?view= exists => DO NOT override
// ✅ Cardboard: ?view=cvr&cardboard=1 -> body.cardboard + per-eye layers
// ✅ Sets window.HHA_VIEW.layers for engine (hydration.safe.js)
// ✅ Start overlay controller: click/tap start -> dispatch hha:start
// ✅ Fullscreen/orientation best-effort for mobile/cardboard (non-blocking)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const ql = (k, def='')=> String(qs(k, def) || '').toLowerCase();

  // -----------------------------
  // View detect (only if no ?view)
  // -----------------------------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    if (isTouch){
      // big phones/tablets in landscape => cVR
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function resolveView(){
    const viewQ = ql('view','');
    if (viewQ) return viewQ; // ✅ DO NOT override
    return detectView();
  }

  // -----------------------------
  // Apply body classes
  // -----------------------------
  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function setCardboard(on){
    try{
      DOC.body.classList.toggle('cardboard', !!on);
    }catch(_){}
    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap) cbWrap.hidden = !on;
  }

  // -----------------------------
  // Layers config for engine
  // -----------------------------
  function setLayers(cardboardOn){
    // engine will read window.HHA_VIEW.layers
    const main = 'hydration-layer';
    const L = 'hydration-layerL';
    const R = 'hydration-layerR';

    const cfg = WIN.HHA_VIEW || {};
    cfg.view = resolveView();
    cfg.cardboard = !!cardboardOn;

    if (cardboardOn){
      cfg.layers = [L, R];
    } else {
      cfg.layers = [main];
    }
    WIN.HHA_VIEW = cfg;
  }

  // -----------------------------
  // Best-effort fullscreen + landscape lock (non-blocking)
  // -----------------------------
  async function tryFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen();
      }
    }catch(_){}
  }

  async function tryLockLandscape(){
    try{
      const so = screen.orientation;
      if (so && so.lock) await so.lock('landscape');
    }catch(_){}
  }

  function bindFSHandlers(view, cardboardOn){
    // Only best-effort on touch devices (avoid annoying desktop)
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    if (!isTouch) return;

    // For cardboard, we try harder, but still non-blocking.
    if (cardboardOn){
      setTimeout(()=>{ tryFullscreen(); }, 60);
      setTimeout(()=>{ tryLockLandscape(); }, 180);
      return;
    }

    // For mobile/cvr, allow user to enter fullscreen via first tap start
    // (we'll call tryFullscreen() in onStartClick)
  }

  // -----------------------------
  // Start overlay
  // -----------------------------
  function startGame(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }

  function bindOverlay(view, cardboardOn){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const sub = DOC.getElementById('ovSub');

    if (sub){
      const kids = ql('kids','0');
      const kidsOn = (kids==='1' || kids==='true' || kids==='yes');
      const tag = cardboardOn ? 'CARDBOARD' : (view || '').toUpperCase();
      sub.textContent =
        kidsOn ? `โหมดเด็ก (สบาย ๆ) • ${tag} • แตะเริ่มได้เลย`
               : `พร้อมแล้ว • ${tag} • แตะเริ่มได้เลย`;
    }

    function onStartClick(){
      // best-effort fullscreen for touch/cvr/cardboard
      const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
      if (isTouch) tryFullscreen();

      hideOverlay();
      startGame();
    }

    btn?.addEventListener('click', onStartClick, { passive:true });

    // Tap anywhere on overlay
    ov?.addEventListener('pointerdown', (e)=>{
      // Avoid double-fire when clicking the button
      const t = e.target;
      if (t && (t.id === 'btnStart')) return;
      onStartClick();
    }, { passive:true });

    // Back to hub buttons (exist in HTML)
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(el=>{
      el.addEventListener('click', ()=>{ location.href = hub; }, { passive:true });
    });
  }

  // -----------------------------
  // Bootstrap
  // -----------------------------
  (function boot(){
    const view = resolveView();
    const cardboardOn = (ql('cardboard','0') === '1') && (view === 'cvr');

    setBodyView(view);
    setCardboard(cardboardOn);
    setLayers(cardboardOn);
    bindFSHandlers(view, cardboardOn);
    bindOverlay(view, cardboardOn);

    // Safety: if overlay is already hidden somehow, auto-start.
    const ov = DOC.getElementById('startOverlay');
    setTimeout(()=>{
      const hidden = !ov || getComputedStyle(ov).display === 'none' || ov.classList.contains('hide');
      if (hidden) startGame();
    }, 650);
  })();

})();