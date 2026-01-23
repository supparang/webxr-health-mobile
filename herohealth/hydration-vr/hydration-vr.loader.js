// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) BUT never override if ?view= already exists
// ✅ Cardboard: if ?cardboard=1 => body.cardboard + mount split layers + view=cvr (recommended)
// ✅ Adds body classes: view-pc / view-mobile / view-cvr
// ✅ Best-effort fullscreen + landscape for cardboard (no hard fail)
// ✅ Start overlay: tap/click to start => emits hha:start
// ✅ Back HUB buttons (.btnBackHub)
// ✅ Flush-hardened on exit: emits hha:flush on pagehide/visibilitychange/beforeunload
// Notes:
// - RUN html already includes: vr-ui.js, hha-cloud-logger.js, ui-water.js, hydration.safe.js (module)
// - Engine listens to hha:start and begins loop.

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // large landscape touch -> cVR (crosshair centered shooting feels better)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function applyViewClass(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function enableCardboard(){
    const b = DOC.body;
    b.classList.add('cardboard');
    // show cb wrap
    const cb = DOC.getElementById('cbWrap');
    if (cb) cb.hidden = false;

    // hide single layer to avoid duplicate clicks & layout confusion
    const main = DOC.getElementById('hydration-layer');
    if (main) main.style.display = 'none';

    // configure shared layer list for engine
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
  }

  function enableNormal(){
    const b = DOC.body;
    b.classList.remove('cardboard');
    const cb = DOC.getElementById('cbWrap');
    if (cb) cb.hidden = true;

    const main = DOC.getElementById('hydration-layer');
    if (main) main.style.display = '';

    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    WIN.HHA_VIEW.layers = ['hydration-layer'];
  }

  // Fullscreen helpers (best-effort)
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!el.requestFullscreen) return false;
      await el.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }catch(_){ return false; }
  }
  async function lockLandscape(){
    try{
      const so = screen.orientation;
      if (!so || !so.lock) return false;
      await so.lock('landscape');
      return true;
    }catch(_){ return false; }
  }

  function bindHubButtons(){
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        // flush log before leaving
        emit('hha:flush', { reason:'backHub' });
        location.href = hub;
      }, { passive:false });
    });
  }

  function bindStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    if (!ov) {
      // no overlay -> auto start
      setTimeout(()=>emit('hha:start', { auto:true }), 30);
      return;
    }

    function hideAndStart(){
      if (ov.classList.contains('hide')) return;
      ov.classList.add('hide');
      ov.style.display = 'none';
      emit('hha:start', { auto:false });
    }

    // button click
    btn?.addEventListener('click', (ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      // try fullscreen for mobile/cvr/cardboard
      requestFullscreen();
      hideAndStart();
    }, { passive:false });

    // tap anywhere on overlay
    ov.addEventListener('pointerdown', (ev)=>{
      const t = ev.target;
      // do not double-fire when clicking button
      if (t && (t.id === 'btnStart' || (t.closest && t.closest('#btnStart')))) return;
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      requestFullscreen();
      hideAndStart();
    }, { passive:false });

    // update hint line
    const sub = DOC.getElementById('ovSub');
    if (sub){
      const v = (qs('view','') || '').toLowerCase() || detectView();
      const cb = String(qs('cardboard','0')).toLowerCase();
      const cardboard = (cb==='1'||cb==='true'||cb==='yes');
      sub.textContent = cardboard ? 'Cardboard: แตะเพื่อเริ่ม (ENTER VR ได้เลย)' :
                       (v==='cvr' ? 'cVR: ยิงจากกลางจอ (crosshair) — แตะเพื่อเริ่ม' :
                        (v==='mobile' ? 'Mobile: แตะเพื่อเริ่ม' : 'PC: คลิกเพื่อเริ่ม'));
    }
  }

  function installExitFlush(){
    const flush = ()=>emit('hha:flush', { reason:'exit' });
    WIN.addEventListener('pagehide', flush, { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if (DOC.visibilityState === 'hidden') flush();
    }, { passive:true });
    WIN.addEventListener('beforeunload', flush, { passive:true });
  }

  function boot(){
    // Respect existing ?view= (NO override)
    const viewQ = (qs('view','') || '').toLowerCase();
    const cardboardQ = (qs('cardboard','') || '').toLowerCase();
    const isCard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

    const view = viewQ ? viewQ : detectView();

    applyViewClass(view);

    if (isCard){
      // Cardboard recommended view is cvr (shoot center); if user already set other view, keep it
      enableCardboard();
      // best-effort: fullscreen + landscape lock (only on user gesture normally; we still try later on start)
      // Here we just mark body for css and set layers.
    } else {
      enableNormal();
    }

    bindHubButtons();
    bindStartOverlay();
    installExitFlush();

    // debug tag
    try{
      DOC.documentElement.dataset.hhaView = view;
      DOC.documentElement.dataset.hhaCardboard = isCard ? '1' : '0';
    }catch(_){}
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();