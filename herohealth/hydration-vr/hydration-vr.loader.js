// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST / HHA Standard)
// ✅ Auto-detect ONLY when no ?view= (do not override)
// ✅ Adds body classes: view-pc / view-mobile / view-cvr + optional cardboard
// ✅ Sets window.HHA_VIEW.layers for engine (single layer or L/R)
// ✅ Start overlay: tap/click -> hide -> dispatch hha:start
// ✅ Back HUB buttons
// ✅ Best-effort fullscreen (mobile) when starting

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const hub = String(qs('hub','../hub.html'));
  const viewQ = String(qs('view','')).toLowerCase();
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const runMode = String(qs('run', qs('runMode','play'))).toLowerCase();

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, innerWidth||1);
    const h = Math.max(1, innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // กว้างพอ + แนวนอน -> cVR (ยิงกลางจอ)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  // --- DO NOT OVERRIDE if user already provides ?view=
  let view = viewQ || detectView();

  // cardboard policy:
  // - if ?cardboard=1 => force view=cvr (crosshair) + split layers
  const isCardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes' || view==='cardboard');
  if (isCardboard) view = 'cvr';

  // --- body classes
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
  b.classList.add(view==='pc' ? 'view-pc' : view==='cvr' ? 'view-cvr' : 'view-mobile');
  if (isCardboard) b.classList.add('cardboard');

  // --- layers config for engine
  const main = DOC.getElementById('hydration-layer');
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');
  const cbWrap = DOC.getElementById('cbWrap');

  if (isCardboard){
    if (cbWrap) cbWrap.hidden = false;
    WIN.HHA_VIEW = { view, cardboard:true, layers: ['hydration-layerL','hydration-layerR'] };
  } else {
    if (cbWrap) cbWrap.hidden = true;
    WIN.HHA_VIEW = { view, cardboard:false, layers: ['hydration-layer'] };
  }

  // --- Back HUB buttons
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', ()=>{ location.href = hub; });
  });

  // --- start overlay logic
  const ov = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  function bestEffortFullscreen(){
    // เฉพาะ mobile/cvr และไม่ใช่ research (ลดการรบกวน)
    if (runMode==='research' || runMode==='study') return;
    try{
      const el = DOC.documentElement;
      if (el && el.requestFullscreen && !DOC.fullscreenElement){
        el.requestFullscreen().catch(()=>{});
      }
    }catch(_){}
    // landscape lock best-effort (android chrome)
    try{
      if (screen.orientation && screen.orientation.lock){
        screen.orientation.lock('landscape').catch(()=>{});
      }
    }catch(_){}
  }

  function startGame(){
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
    bestEffortFullscreen();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  if (ovSub){
    const kids = String(qs('kids','0')).toLowerCase();
    const K = (kids==='1'||kids==='true'||kids==='yes');
    const label =
      isCardboard ? 'Cardboard (ยิงกลางจอ) — แตะเพื่อเริ่ม' :
      view==='cvr' ? 'cVR (ยิงกลางจอ) — แตะเพื่อเริ่ม' :
      view==='mobile' ? 'Mobile (แตะเป้า) — แตะเพื่อเริ่ม' :
      'PC (คลิกเป้า) — คลิกเพื่อเริ่ม';

    ovSub.textContent = K ? (label + ' • Kids mode ✅') : label;
  }

  btnStart?.addEventListener('click', startGame);
  ov?.addEventListener('pointerdown', (e)=>{
    // กันยิงทะลุ overlay
    try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
    startGame();
  }, { passive:false });

})();