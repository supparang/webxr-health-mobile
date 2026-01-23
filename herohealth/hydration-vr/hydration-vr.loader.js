// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) BUT never override if ?view= exists
// ✅ Cardboard mode: ?cardboard=1 => body.cardboard + HHA_VIEW.layers=[L,R]
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Ensures playfield/cardboard wrappers visibility
// ✅ Tap-to-start overlay -> dispatches hha:start (once) + resumes audio context best-effort
// ✅ Flush-hardened hooks (optional): dispatch hha:flush on exit
//
// Expected DOM ids (from hydration-vr.html):
//  - #startOverlay, #btnStart, .btnBackHub (buttons)
//  - #hydration-layer, #hydration-layerL, #hydration-layerR
//  - #cbWrap, #cbPlayfield (cardboard split wrapper)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const qhas = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  const hub = String(qs('hub','../hub.html'));

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // touch devices:
    // - landscape + wide-ish => cVR (crosshair shooting)
    // - otherwise => mobile
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function setCardboard(on){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!on);

    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap){
      // when cardboard on => show cbWrap; else keep it hidden
      cbWrap.hidden = !on;
    }
  }

  function setLayersForView(cardboardOn){
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    // expose layers so hydration.safe.js can duplicate targets into both eyes
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};

    if (cardboardOn && L && R){
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
      // ensure main layer doesn't intercept clicks visually (still ok if exists)
      if (main) main.style.display = 'none';
    } else {
      WIN.HHA_VIEW.layers = ['hydration-layer'];
      if (main) main.style.display = '';
    }
  }

  function ensureHubButtons(){
    // any element with class .btnBackHub goes to hub
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
        location.href = hub;
      });
    });
  }

  async function tryResumeAudio(){
    // Best-effort resume audio context used by hydration.safe.js tickBeep()
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return;
      // If some other module already created one, it will resume there.
      // If not, creating here is okay; it won't break anything.
      const ctx = new AC();
      if (ctx.state === 'suspended') await ctx.resume();
      // close immediately to avoid keeping resources
      try{ await ctx.close(); }catch(_){}
    }catch(_){}
  }

  function startOnce(){
    if (WIN.__HHA_STARTED__) return;
    WIN.__HHA_STARTED__ = true;

    tryResumeAudio();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');

    if (!ov){
      // If no overlay, auto-start
      startOnce();
      return;
    }

    function hideOverlay(){
      try{ ov.style.display = 'none'; }catch(_){}
      startOnce();
    }

    // Button start
    btn?.addEventListener('click', (e)=>{
      try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
      hideOverlay();
    }, { passive:false });

    // Tap anywhere on overlay card area also starts (kids-friendly)
    ov.addEventListener('pointerdown', (e)=>{
      // allow buttons to handle themselves; otherwise tap starts
      const t = e.target;
      if (t && (t.closest && t.closest('button'))) return;
      try{ e.preventDefault(); }catch(_){}
      hideOverlay();
    }, { passive:false });

    // If overlay is hidden externally, auto-start
    setTimeout(()=>{
      const hidden = (getComputedStyle(ov).display === 'none') || ov.hasAttribute('hidden');
      if (hidden) startOnce();
    }, 650);
  }

  function applyViewFromQueryOrAuto(){
    // IMPORTANT: do NOT override if ?view= exists
    const view = qhas('view') ? String(qs('view','pc')).toLowerCase() : detectView();
    const cardboardOn = String(qs('cardboard','0')).toLowerCase();
    const cardboard = (cardboardOn === '1' || cardboardOn === 'true' || cardboardOn === 'yes');

    // normalize view
    const v = (view === 'cvr' || view === 'mobile' || view === 'pc') ? view : 'pc';

    setBodyView(v);
    setCardboard(cardboard);
    setLayersForView(cardboard);

    // Helpful: if cardboard=1 but view isn't cvr, force cvr class for crosshair aim feel
    // (doesn't rewrite URL; just ensures UI config is consistent)
    if (cardboard && v !== 'cvr'){
      DOC.body.classList.remove('view-pc','view-mobile');
      DOC.body.classList.add('view-cvr');
    }
  }

  function bindFlushOnLeave(){
    // When leaving run page, flush logs
    WIN.addEventListener('pagehide', ()=>{ try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){ } }, { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden'){
        try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){ }
      }
    }, { passive:true });
  }

  // --- init ---
  applyViewFromQueryOrAuto();
  ensureHubButtons();
  bindStartOverlay();
  bindFlushOnLeave();

})();