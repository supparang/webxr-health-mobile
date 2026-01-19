// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Cardboard: body.cardboard + show cbWrap + layers=[L,R]
// ✅ Does NOT override if URL already has ?view=
// ✅ Wires Start overlay -> dispatch hha:start
// ✅ Back-to-hub buttons
// ✅ Sets window.HHA_VIEW = { view, cardboard, layers }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // big landscape phone/tablet -> cVR (crosshair shooting)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if(view === 'mobile') b.classList.add('view-mobile');
    else if(view === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-pc');
  }

  function setCardboard(on){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!on);

    const cbWrap = DOC.getElementById('cbWrap');
    const layerMain = DOC.getElementById('hydration-layer');
    if(cbWrap){
      cbWrap.hidden = !on ? true : false;
    }
    if(layerMain){
      // main layer hidden via CSS when cardboard, but keep safe anyway
      layerMain.style.display = on ? 'none' : '';
    }
  }

  function initHHAView(view, cardboard){
    const cfg = { view, cardboard: !!cardboard, layers: [] };

    if (cardboard){
      const L = DOC.getElementById('hydration-layerL');
      const R = DOC.getElementById('hydration-layerR');
      if (L && R) cfg.layers = [L.id, R.id];
    } else {
      const M = DOC.getElementById('hydration-layer');
      if (M) cfg.layers = [M.id];
    }

    WIN.HHA_VIEW = cfg;
  }

  // ----------------- MAIN -----------------
  const viewQ = String(qs('view','')||'').toLowerCase().trim();
  const cardboardQ = String(qs('cardboard','0')||'0').toLowerCase();
  const cardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  // ✅ do not override user-provided view; otherwise auto detect
  const view = (viewQ==='pc' || viewQ==='mobile' || viewQ==='cvr') ? viewQ : detectView();

  setBodyView(view);
  setCardboard(cardboard);
  initHHAView(view, cardboard);

  // Overlay wiring
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  const hub = String(qs('hub','../hub.html'));

  // Update subtitle
  if(ovSub){
    const kidsQ = String(qs('kids','0')).toLowerCase();
    const kids = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');
    const run = String(qs('run', qs('runMode','play'))).toLowerCase();
    const extra = [
      `VIEW: ${view.toUpperCase()}${cardboard?' + CARDBOARD':''}`,
      kids ? 'Kids mode: ON' : '',
      (run==='research'||run==='study') ? 'Research mode' : ''
    ].filter(Boolean).join(' • ');
    ovSub.textContent = extra || 'แตะเพื่อเริ่ม';
  }

  function startGame(){
    try{
      if(overlay) overlay.style.display = 'none';
    }catch(_){}
    try{
      WIN.dispatchEvent(new CustomEvent('hha:start'));
    }catch(_){}
  }

  // start button
  btnStart?.addEventListener('click', startGame);

  // tap anywhere on overlay
  overlay?.addEventListener('pointerdown', (ev)=>{
    // avoid double when pressing a button
    const t = ev.target;
    if(t && t.closest && t.closest('button')) return;
    startGame();
  }, { passive:true });

  // Back-to-hub buttons
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = hub; });
  });

  // Safety: auto-start if overlay hidden by something else
  setTimeout(()=>{
    const hidden = !overlay || getComputedStyle(overlay).display === 'none';
    if(hidden){
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }
  }, 700);

})();