// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile/cVR/VR) — NO override if ?view= exists
// ✅ Cardboard toggle via ?cardboard=1 (forces view=cvr if missing)
// ✅ Mount correct layers to window.HHA_VIEW.layers for engine
// ✅ Start overlay: tap/click => emit hha:start + resume audio context best-effort
// ✅ Back to HUB button (reads ?hub=...)
// ✅ Robust against missing DOM nodes (fails safe)

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

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function setBodyView(view){
    const b = DOC.body;
    if(!b) return;
    b.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
    b.classList.add('view-'+view);
  }

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // cVR: touch + landscape-ish + wide enough
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function ensureSafeAreaVars(){
    // set --sat/--sab etc on :root for engines that read these via computedStyle
    try{
      const r = DOC.documentElement;
      r.style.setProperty('--sat', 'env(safe-area-inset-top, 0px)');
      r.style.setProperty('--sab', 'env(safe-area-inset-bottom, 0px)');
      r.style.setProperty('--sal', 'env(safe-area-inset-left, 0px)');
      r.style.setProperty('--sar', 'env(safe-area-inset-right, 0px)');
    }catch(_){}
  }

  function setupCardboard(cardboardOn){
    const b = DOC.body;
    const cbWrap = DOC.getElementById('cbWrap');
    const pf = DOC.getElementById('playfield');
    if(!b) return;

    b.classList.toggle('cardboard', !!cardboardOn);

    // show/hide cb split layers
    if (cbWrap) cbWrap.hidden = !cardboardOn;

    // if cardboard, we still keep #playfield but engine uses #cbPlayfield for rect
    // (engine checks body.cardboard)
  }

  function setHHAViewLayers(cardboardOn){
    // Tell engine which layer(s) to append targets to
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    const layers = [];
    if (cardboardOn && L && R){
      layers.push('hydration-layerL', 'hydration-layerR');
    } else if (main){
      layers.push('hydration-layer');
    }

    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
      game: 'hydration',
      layers,
      cardboard: !!cardboardOn,
      view: (DOC.body?.classList.contains('view-cvr') ? 'cvr'
          : DOC.body?.classList.contains('view-mobile') ? 'mobile'
          : DOC.body?.classList.contains('view-vr') ? 'vr'
          : 'pc')
    });
  }

  function resumeAudioBestEffort(){
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return;
      // many browsers auto-create contexts in engine; we just poke it
      const ctx = new AC();
      if (ctx && ctx.state === 'suspended'){
        ctx.resume().catch(()=>{});
      }
      // close quickly
      setTimeout(()=>{ try{ ctx.close(); }catch(_){ } }, 200);
    }catch(_){}
  }

  function emitStart(){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:start', { detail:{ game:'hydration' } }));
    }catch(_){}
  }

  // ---------- APPLY VIEW / CARDBOARD ----------
  ensureSafeAreaVars();

  const url = new URL(location.href);
  const hasView = url.searchParams.has('view');
  const viewParam = String(qs('view','')||'').toLowerCase();

  let view = hasView ? (viewParam || 'pc') : detectView();

  // cardboard flag
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const cardboardOn = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  // If cardboard requested and view missing, force cVR (crosshair mode)
  if (cardboardOn && !hasView){
    view = 'cvr';
    url.searchParams.set('view','cvr');
    history.replaceState(null,'', url.toString());
  }

  // Normalize view values
  if (!['pc','mobile','cvr','vr'].includes(view)) view = 'pc';

  setBodyView(view);
  setupCardboard(cardboardOn);
  setHHAViewLayers(cardboardOn);

  // ---------- Start overlay wiring ----------
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const hub = String(qs('hub','../hub.html')||'../hub.html');

  function hideOverlay(){
    if(!overlay) return;
    overlay.classList.add('hide');
    overlay.style.display = 'none';
  }

  function startGame(){
    resumeAudioBestEffort();
    hideOverlay();
    emitStart();
  }

  // Tap anywhere on overlay card area => start
  if (overlay){
    overlay.addEventListener('pointerdown', (ev)=>{
      // allow buttons to handle themselves
      const t = ev.target;
      if (t && (t.closest && t.closest('button'))) return;
      startGame();
    }, { passive:true });
  }

  btnStart?.addEventListener('click', (ev)=>{
    try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
    startGame();
  });

  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      location.href = hub;
    });
  });

  // UX hint text
  const ovSub = DOC.getElementById('ovSub');
  if (ovSub){
    const kidsQ = String(qs('kids','0')).toLowerCase();
    const kids = (kidsQ==='1'||kidsQ==='true'||kidsQ==='yes');
    const t = [
      `โหมด: ${view.toUpperCase()}${cardboardOn?' (Cardboard)':''}${kids?' • Kids':''}`,
      `แตะ/กดปุ่ม “เริ่ม!” เพื่อเริ่มเล่น`
    ].join(' — ');
    ovSub.textContent = t;
  }

  // If overlay already hidden by CSS or user resumed, auto start after short delay
  setTimeout(()=>{
    if(!overlay) return;
    const hidden = (getComputedStyle(overlay).display === 'none') || overlay.classList.contains('hide');
    if (hidden){
      emitStart();
    }
  }, 650);

})();