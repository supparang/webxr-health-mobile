// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration RUN Loader — PRODUCTION (LATEST)
// ✅ Sets body view classes: view-pc / view-mobile / view-cvr
// ✅ Cardboard: supports ?cardboard=1 OR view=cardboard -> shows split layers
// ✅ Defines window.HHA_VIEW.layers for engine spawn layering
// ✅ Start overlay: btnStart + tap backdrop to start -> emits hha:start
// ✅ Back to hub buttons: .btnBackHub
// ✅ NO override (assumes launcher already respects ?view=)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDR_LOADER__) return;
  WIN.__HHA_HYDR_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const hub = String(qs('hub','../hub.html'));
  const viewQ = String(qs('view','pc')).toLowerCase();
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();

  function setBodyView(){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');

    let view = viewQ || 'pc';
    if (view === 'cardboard') view = 'cvr'; // we treat cardboard as cvr + split
    if (view !== 'pc' && view !== 'mobile' && view !== 'cvr') view = 'pc';

    b.classList.add('view-' + view);

    const isCardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');
    if (isCardboard) b.classList.add('cardboard');
  }

  function setupLayers(){
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    const isCardboard = DOC.body.classList.contains('cardboard');
    const cbWrap = DOC.getElementById('cbWrap');

    // show/hide split
    if (cbWrap){
      cbWrap.hidden = !isCardboard;
    }

    const layers = (isCardboard && L && R) ? ['hydration-layerL','hydration-layerR'] : ['hydration-layer'];
    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, { layers });

    // ensure pointer-events stay correct (targets clickable, playfield wrap none)
    if (main && !isCardboard){
      try{ main.style.pointerEvents = 'none'; }catch(_){}
    }
    if (L){ try{ L.style.pointerEvents='none'; }catch(_){} }
    if (R){ try{ R.style.pointerEvents='none'; }catch(_){} }
  }

  function bindHubButtons(){
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });
  }

  function startGame(){
    try{
      const ov = DOC.getElementById('startOverlay');
      if (ov) ov.style.display = 'none';
    }catch(_){}
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');

    if (!ov) {
      // if no overlay, start soon
      setTimeout(startGame, 120);
      return;
    }

    // text hint
    const ovSub = DOC.getElementById('ovSub');
    if (ovSub){
      const v = (viewQ==='cardboard') ? 'Cardboard' : (viewQ||'pc').toUpperCase();
      ovSub.textContent = (run==='research')
        ? `โหมดวิจัย (${v}) — แตะเพื่อเริ่ม`
        : `โหมดเล่น (${v}) — แตะเพื่อเริ่ม`;
    }

    btn?.addEventListener('click', (e)=>{
      try{ e.preventDefault(); }catch(_){}
      startGame();
    });

    // tap anywhere on overlay card/backdrop = start
    ov.addEventListener('pointerdown', (e)=>{
      const t = e.target;
      // don't start if clicking "กลับ HUB"
      if (t && t.classList && t.classList.contains('btnBackHub')) return;
      // allow start on any tap inside overlay
      startGame();
    }, { passive:true });
  }

  // (optional) best-effort landscape for cardboard
  async function tryLandscape(){
    const isCardboard = DOC.body.classList.contains('cardboard');
    if (!isCardboard) return;
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // boot
  setBodyView();
  setupLayers();
  bindHubButtons();
  bindStartOverlay();
  tryLandscape();

  // expose helpers
  WIN.HHA_HYDR = Object.assign({}, WIN.HHA_HYDR || {}, {
    start: startGame,
    hub
  });

})();