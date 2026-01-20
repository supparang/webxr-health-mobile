// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) แต่ "ห้าม override" ถ้า URL มี ?view= อยู่แล้ว
// ✅ Cardboard: ?cardboard=1 => body.cardboard + เปิด cbWrap + layers = [L,R]
// ✅ Sets body classes: view-pc / view-mobile / view-cvr + (cardboard)
// ✅ Start overlay: tap/click => dispatch hha:start
// ✅ Emits: hha:flush on pagehide (for logger)
// ------------------------------------------------------

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // heuristic: touch + landscape wide => cVR (ยิงจาก crosshair)
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setViewClasses(view){
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
      cbWrap.hidden = !on ? true : false; // show in cardboard
    }
  }

  // expose layers to engine (hydration.safe.js reads window.HHA_VIEW.layers)
  function setLayersForEngine(cardboardOn){
    const cfg = WIN.HHA_VIEW || {};
    if (cardboardOn){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      cfg.layers = ['hydration-layer'];
    }
    WIN.HHA_VIEW = cfg;
  }

  // ---------- Main init ----------
  const viewQ = String(qs('view','')||'').toLowerCase();
  const cardboardQ = String(qs('cardboard','0')||'0').toLowerCase();
  const cardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  // ✅ Do not override if view param exists
  const view = viewQ ? viewQ : detectView();

  setViewClasses(view);
  setCardboard(cardboard);
  setLayersForEngine(cardboard);

  // Update overlay subtitle
  const ovSub = DOC.getElementById('ovSub');
  if (ovSub){
    const kids = String(qs('kids','0')).toLowerCase();
    const kidsOn = (kids==='1' || kids==='true' || kids==='yes');
    const run = String(qs('run', qs('runMode','play'))||'play').toLowerCase();
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const t = clamp(parseInt(qs('time', 70),10)||70, 20, 600);

    const badge = [
      `Mode: ${view.toUpperCase()}${cardboard?' (Cardboard)':''}`,
      `Run: ${run}`,
      `Diff: ${diff}`,
      `Time: ${t}s`,
      kidsOn ? 'Kids: ON' : 'Kids: OFF'
    ].join(' • ');

    ovSub.textContent = badge;
  }

  // Back HUB buttons (in overlay + summary)
  const hub = String(qs('hub','../hub.html'));
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = hub; });
  });

  // Start button / tap overlay
  const startOverlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');

  function startGame(){
    try{
      if (startOverlay) startOverlay.classList.add('hide');
      if (startOverlay) startOverlay.style.display='none';
    }catch(_){}

    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  // click on button
  btnStart?.addEventListener('click', (e)=>{
    try{ e.preventDefault(); }catch(_){}
    startGame();
  });

  // tap anywhere on overlay
  startOverlay?.addEventListener('pointerdown', (e)=>{
    // allow buttons to work too, but tapping backdrop starts game
    const t = e.target;
    if (t && (t.closest && t.closest('button'))) return;
    startGame();
  }, { passive:true });

  // Safety: if overlay already hidden, auto start shortly
  setTimeout(()=>{
    const hidden = !startOverlay || getComputedStyle(startOverlay).display==='none' || startOverlay.classList.contains('hide');
    if (hidden) startGame();
  }, 650);

  // flush hook for logger safety
  WIN.addEventListener('pagehide', ()=>{
    try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
  }, { passive:true });

})();