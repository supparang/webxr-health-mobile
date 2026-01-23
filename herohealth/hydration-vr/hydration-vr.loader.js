// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (ONLY if ?view not provided) — NO override
// ✅ Cardboard support: ?cardboard=1 => split layers + body.cardboard
// ✅ Sets: body classes view-pc / view-mobile / view-cvr
// ✅ Exposes: window.HHA_VIEW = { view, cardboard, layers[] }
// ✅ Start overlay: tap/click => hide => emit hha:start
// ✅ Best-effort fullscreen + landscape lock (on start) for mobile/cardboard

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, innerWidth||1);
    const h = Math.max(1, innerHeight||1);
    const landscape = w >= h;

    // touch device: cVR when landscape and “wide enough” (มือถือแนวนอน/แท็บเล็ต)
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function wantCardboard(){
    const c = String(qs('cardboard','0')).toLowerCase();
    return (c==='1' || c==='true' || c==='yes');
  }

  function setBodyView(view, cardboard){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    b.classList.add(view === 'cvr' ? 'view-cvr' : (view === 'mobile' ? 'view-mobile' : 'view-pc'));
    if(cardboard) b.classList.add('cardboard');
  }

  function setupLayers(cardboard){
    const cbWrap = DOC.getElementById('cbWrap');
    const layerMain = DOC.getElementById('hydration-layer');
    const layerL = DOC.getElementById('hydration-layerL');
    const layerR = DOC.getElementById('hydration-layerR');

    if(cardboard && cbWrap && layerL && layerR){
      cbWrap.hidden = false;
      if (layerMain) layerMain.style.display = 'none';
      return ['hydration-layerL','hydration-layerR'];
    } else {
      if (cbWrap) cbWrap.hidden = true;
      if (layerMain) layerMain.style.display = '';
      return ['hydration-layer'];
    }
  }

  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' });
      }
    }catch(_){}
  }

  async function lockLandscape(){
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  function wireBackHub(){
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });
  }

  function startOverlay(view, cardboard){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const sub = DOC.getElementById('ovSub');

    if (!ov) {
      // no overlay -> start anyway
      setTimeout(()=>WIN.dispatchEvent(new CustomEvent('hha:start')), 50);
      return;
    }

    if (sub){
      const kid = String(qs('kids','0')).toLowerCase();
      const kidsOn = (kid==='1'||kid==='true'||kid==='yes');
      const cvrTxt = (view==='cvr') ? 'โหมด cVR: ยิงจากกลางจอ (crosshair)' : '';
      const cbTxt  = cardboard ? 'Cardboard: แยกจอซ้าย-ขวา' : '';
      const kTxt   = kidsOn ? 'Kids ON' : 'Kids OFF';
      sub.textContent = [kTxt, cvrTxt, cbTxt].filter(Boolean).join(' • ') || 'แตะเพื่อเริ่ม';
    }

    function begin(){
      try{ ov.hidden = true; }catch(_){}
      // best effort FS/landscape for mobile/cardboard (needs gesture)
      const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
      if (isTouch || cardboard){
        requestFullscreen();
        lockLandscape();
      }
      WIN.dispatchEvent(new CustomEvent('hha:start'));
    }

    // click overlay card button
    btn?.addEventListener('click', (e)=>{ try{ e.preventDefault(); e.stopPropagation(); }catch(_){} begin(); });

    // tap anywhere on overlay to start (kids-friendly)
    ov.addEventListener('pointerdown', (e)=>{
      // avoid double fire if clicking a button
      const t = e.target;
      if (t && t.closest && t.closest('button')) return;
      begin();
    }, { passive:true });
  }

  // ---- main ----
  const viewQ = (String(qs('view',''))||'').toLowerCase().trim();
  const view = viewQ || detectView();            // ✅ NO override when view is provided
  const cardboard = wantCardboard();

  setBodyView(view, cardboard);
  const layers = setupLayers(cardboard);

  WIN.HHA_VIEW = { view, cardboard, layers };

  wireBackHub();
  startOverlay(view, cardboard);

})();