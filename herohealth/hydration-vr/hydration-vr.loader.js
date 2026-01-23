// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) BUT does NOT override if ?view= exists
// ✅ Apply body classes: view-pc / view-mobile / view-cvr
// ✅ Cardboard: if ?cardboard=1 => body.cardboard + uses split layers
// ✅ Exposes window.HHA_VIEW = { view, cardboard, layers:[...] }
// ✅ Start overlay: tap/click/space/enter => emits hha:start once
// ✅ Best-effort: fullscreen + landscape lock for cardboard (user-gesture only)
// ✅ BackHub buttons safe

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v === 'pc' || v === 'desktop') return 'pc';
    if (v === 'mobile' || v === 'm') return 'mobile';
    if (v === 'cvr' || v === 'vr') return 'cvr';
    return '';
  }

  function setBodyView(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    b.classList.add(view === 'mobile' ? 'view-mobile' : (view === 'cvr' ? 'view-cvr' : 'view-pc'));
  }

  function setCardboard(on){
    const b = DOC.body;
    if (!b) return;
    b.classList.toggle('cardboard', !!on);

    const cbWrap = DOC.getElementById('cbWrap');
    const mainLayer = DOC.getElementById('hydration-layer');

    if (cbWrap){
      cbWrap.hidden = !on;
    }
    // main layer remains in DOM; CSS may hide it when cardboard
    if (mainLayer){
      mainLayer.setAttribute('aria-hidden', on ? 'true' : 'false');
    }
  }

  function installBackHub(){
    const hub = String(qs('hub','../hub.html'));
    const btns = DOC.querySelectorAll('.btnBackHub');
    btns.forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        location.href = hub;
      }, { passive:false });
    });
  }

  async function tryFullscreenAndLockLandscape(){
    // must be called from user gesture
    try{
      const el = DOC.documentElement;
      if (el && el.requestFullscreen && !DOC.fullscreenElement){
        await el.requestFullscreen();
      }
    }catch(_){}

    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // Start overlay -> one-shot start signal
  function installStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    if (!ov) {
      // if no overlay, just start
      setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:start')), 50);
      return;
    }

    let started = false;

    function hideOverlay(){
      try{
        ov.classList.add('hide');
        ov.style.display = 'none';
      }catch(_){}
    }

    async function startOnce(trigger){
      if (started) return;
      started = true;

      // If cardboard => try fullscreen + landscape lock (gesture)
      const cb = !!WIN.HHA_VIEW?.cardboard;
      if (cb){
        await tryFullscreenAndLockLandscape();
      }

      hideOverlay();

      try{
        WIN.dispatchEvent(new CustomEvent('hha:start', { detail:{ trigger: trigger||'ui' } }));
      }catch(_){}
    }

    // Button
    if (btn){
      btn.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        startOnce('btn');
      }, { passive:false });
    }

    // Tap anywhere on overlay card/backdrop
    ov.addEventListener('pointerdown', (ev)=>{
      // allow button to handle
      if (ev && ev.target && String(ev.target.id||'') === 'btnStart') return;
      try{ ev.preventDefault(); }catch(_){}
      startOnce('overlay');
    }, { passive:false });

    // Keyboard
    WIN.addEventListener('keydown', (ev)=>{
      const k = String(ev.key||'').toLowerCase();
      if (k === 'enter' || k === ' ' || k === 'spacebar'){
        try{ ev.preventDefault(); }catch(_){}
        startOnce('key');
      }
    }, { passive:false });

    // Safety auto-start: if overlay hidden by css
    setTimeout(()=>{
      const hidden = (getComputedStyle(ov).display === 'none') || ov.classList.contains('hide');
      if (hidden && !started) startOnce('autoHidden');
    }, 600);
  }

  // --- MAIN init ---
  (function init(){
    const qView = normalizeView(qs('view',''));
    const view = qView || detectView(); // DO NOT override if qView exists
    const cardboard = String(qs('cardboard','0')).toLowerCase();
    const isCardboard = (cardboard === '1' || cardboard === 'true' || cardboard === 'yes');

    setBodyView(view);
    setCardboard(isCardboard);

    // Layers mapping for engine
    // - Cardboard: use L/R layers
    // - Otherwise: use main layer
    const layers = [];
    if (isCardboard){
      const L = DOC.getElementById('hydration-layerL');
      const R = DOC.getElementById('hydration-layerR');
      if (L) layers.push('hydration-layerL');
      if (R) layers.push('hydration-layerR');
    } else {
      const M = DOC.getElementById('hydration-layer');
      if (M) layers.push('hydration-layer');
    }

    WIN.HHA_VIEW = {
      view,
      cardboard: isCardboard,
      layers
    };

    // UI subtitle in overlay (optional)
    const sub = DOC.getElementById('ovSub');
    if (sub){
      const label =
        isCardboard ? 'Cardboard (ยิงกลางจอ + แยกจอซ้าย/ขวา)' :
        (view === 'cvr' ? 'cVR (ยิงจากกลางจอ)' :
         (view === 'mobile' ? 'Mobile (แตะยิง)' : 'PC (คลิก/เมาส์)'));
      sub.textContent = `แตะเพื่อเริ่ม • โหมด: ${label}`;
    }

    installBackHub();
    installStartOverlay();
  })();

})();