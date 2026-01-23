// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (AUTO, no override)
// ✅ sets body class: view-pc / view-mobile / view-cvr
// ✅ cardboard=1 => body.cardboard + config layers
// ✅ does NOT override if ?view= already exists
// ✅ start overlay: tap button => dispatch hha:start

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs=(k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, innerWidth||1);
    const h = Math.max(1, innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function applyViewClasses(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (view==='cvr') b.classList.add('view-cvr');
    else if (view==='mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function setupCardboard(cardboardOn){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!cardboardOn);

    // Provide layer list for engine to duplicate targets correctly
    if (cardboardOn){
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        layers: ['hydration-layerL','hydration-layerR']
      });
      const cbWrap = DOC.getElementById('cbWrap');
      if (cbWrap) cbWrap.hidden = false;
    } else {
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        layers: ['hydration-layer']
      });
      const cbWrap = DOC.getElementById('cbWrap');
      if (cbWrap) cbWrap.hidden = true;
    }
  }

  // Decide view (NO override)
  const viewQ = String(qs('view','')||'').toLowerCase();
  const view = viewQ ? viewQ : detectView();
  applyViewClasses(view);

  // Cardboard
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const cardboardOn = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');
  setupCardboard(cardboardOn);

  // Start overlay wiring
  const ov = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  const kidsQ = String(qs('kids','0')).toLowerCase();
  const kidsOn = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

  if (ovSub){
    const mode = view.toUpperCase() + (cardboardOn ? ' + CARDBOARD' : '');
    ovSub.textContent = kidsOn
      ? `โหมด ${mode} — Kids mode (ง่ายขึ้น) • แตะเพื่อเริ่ม`
      : `โหมด ${mode} • แตะเพื่อเริ่ม`;
  }

  function startGame(){
    try{ if (ov) ov.classList.add('hide'); }catch(_){}
    try{ if (ov) ov.style.display='none'; }catch(_){}
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  btnStart?.addEventListener('click', startGame, { passive:true });

  // Tap anywhere on overlay to start
  ov?.addEventListener('pointerdown', (e)=>{
    try{ e.preventDefault(); }catch(_){}
    startGame();
  }, { passive:false });

})();