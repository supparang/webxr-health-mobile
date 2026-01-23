// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view if no ?view= (NO override)
// ✅ Cardboard: ?cardboard=1 => body.cardboard + HHA_VIEW.layers = [L,R]
// ✅ Start overlay: click => dispatch hha:start
// ✅ Back hub buttons
(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  const hub = String(qs('hub','../hub.html'));
  const cur = new URL(location.href);
  const hasView = !!cur.searchParams.get('view');

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

  const view = hasView ? String(qs('view','pc')).toLowerCase() : detectView();
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const cardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  // set body classes
  DOC.body.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
  DOC.body.classList.add(view==='cvr'?'view-cvr':(view==='mobile'?'view-mobile':'view-pc'));
  if (cardboard) DOC.body.classList.add('cardboard');

  // layers for engine
  const main = DOC.getElementById('hydration-layer');
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');

  WIN.HHA_VIEW = WIN.HHA_VIEW || {};
  if (cardboard && L && R){
    WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
  } else if (main){
    WIN.HHA_VIEW.layers = ['hydration-layer'];
  }

  // overlay
  const ov = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  if (ovSub){
    const label = cardboard ? 'Cardboard' : (view==='cvr'?'cVR':(view==='mobile'?'Mobile':'PC'));
    ovSub.textContent = `โหมด: ${label} • แตะเพื่อเริ่ม`;
  }

  function start(){
    try{ if (ov) ov.classList.add('hide'); }catch(_){}
    try{ if (ov) ov.style.display='none'; }catch(_){}
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  btnStart?.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){} start(); });
  ov?.addEventListener('click', (e)=>{
    const t = e?.target;
    if (t && (t.closest && t.closest('button'))) return;
    start();
  });

  // back hub
  DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      try{ e.preventDefault(); }catch(_){}
      try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
      location.href = hub;
    });
  });

})();