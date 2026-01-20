// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view ONLY if ?view= not provided (NO override)
// ✅ Cardboard: ?cardboard=1 -> body.cardboard + sets HHA_VIEW.layers [L,R]
// ✅ Adds body classes: view-pc | view-mobile | view-cvr
// ✅ Wires Start Overlay -> emits hha:start
// ✅ Back to HUB via ?hub=...
// ✅ Safe auto-start fallback if overlay already hidden

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  };

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // touch device
    if (isTouch){
      // big landscape phone/tablet -> cVR is often nicer (crosshair)
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

    // expose layers for the engine to spawn into both eyes
    if (on){
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];

      // show cardboard wrap
      const cb = DOC.getElementById('cbWrap');
      if (cb) cb.hidden = false;
    } else {
      // default single layer
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layer'];

      const cb = DOC.getElementById('cbWrap');
      if (cb) cb.hidden = true;
    }
  }

  // --- read params ---
  const hub = String(qs('hub','../hub.html'));
  const viewQ = (qs('view','') || '').toLowerCase();
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const cardboard = (cardboardQ === '1' || cardboardQ === 'true' || cardboardQ === 'yes');

  // decide view (NO override if provided)
  const view = (viewQ === 'pc' || viewQ === 'mobile' || viewQ === 'cvr')
    ? viewQ
    : detectView();

  // Apply classes + layers
  setBodyView(view);
  setCardboard(cardboard);

  // If user passed ?cardboard=1 but view is not cvr, force the *class* to cvr for aiming style.
  // (We still do NOT overwrite URL params; just set body class behavior.)
  if (cardboard && view !== 'cvr'){
    setBodyView('cvr');
  }

  // --- overlay wiring ---
  const ov = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');

  function emitStart(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function hideOverlay(){
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }

  function startNow(){
    hideOverlay();
    // small delay for layout settle + ensure modules loaded
    setTimeout(()=>emitStart(), 40);
  }

  // Start button
  if (btnStart){
    btnStart.addEventListener('click', (e)=>{
      try{ e.preventDefault(); }catch(_){}
      startNow();
    }, { passive:false });
  }

  // Tap anywhere on overlay also starts (kids-friendly)
  if (ov){
    ov.addEventListener('click', (e)=>{
      // avoid double trigger if click on buttons
      const t = e?.target;
      if (t && (t.closest && t.closest('button'))) return;
      startNow();
    }, { passive:true });
  }

  // Back hub buttons
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      try{ e.preventDefault(); }catch(_){}
      location.href = hub;
    }, { passive:false });
  });

  // Update overlay subtitle helper (optional)
  const sub = DOC.getElementById('ovSub');
  if (sub){
    const label = cardboard ? 'CARDBOARD' : view.toUpperCase();
    const kids = String(qs('kids','0')).toLowerCase();
    const kidsOn = (kids==='1'||kids==='true'||kids==='yes');
    sub.textContent = kidsOn
      ? `โหมด: ${label} • Kids Mode ✅ (แตะเพื่อเริ่ม)`
      : `โหมด: ${label} (แตะเพื่อเริ่ม)`;
  }

  // Auto-start fallback:
  // - if overlay is already hidden by CSS/bug
  // - or if user adds ?autostart=1
  const autoQ = String(qs('autostart','0')).toLowerCase();
  const autostart = (autoQ==='1'||autoQ==='true'||autoQ==='yes');

  setTimeout(()=>{
    const ovHidden = !ov || ov.style.display === 'none' || (ov.classList && ov.classList.contains('hide'));
    if (autostart || ovHidden){
      emitStart();
    }
  }, clamp(parseInt(qs('bootDelay','240'),10)||240, 0, 1200));

})();