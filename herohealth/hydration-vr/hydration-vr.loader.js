// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect (PC/Mobile/cVR) BUT: if ?view= exists -> DO NOT override
// ✅ Cardboard support: ?cardboard=1 forces split layers + body.cardboard
// ✅ Sets body classes: view-pc/view-mobile/view-cvr
// ✅ Sets window.HHA_VIEW.layers for engine spawn to correct layer(s)
// ✅ Sets kids flag: ?kids=1 => body.dataset.kids="1" (CSS reacts)
// ✅ Start overlay => emits hha:start on click/tap
// ✅ Back hub buttons wired

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const qbool = (k, def=false)=>{
    const v = String(qs(k, def ? '1':'0')).toLowerCase();
    return (v==='1'||v==='true'||v==='yes'||v==='on');
  };

  const hub = String(qs('hub','../hub.html'));

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // touch device:
    // - wide landscape => cVR (crosshair shooting)
    // - else => mobile
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (view==='cvr') b.classList.add('view-cvr');
    else if (view==='mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function setKidsFlag(){
    const kids = qbool('kids', false);
    if (kids) DOC.body.dataset.kids = '1';
    else delete DOC.body.dataset.kids;
    return kids;
  }

  function setCardboardAndLayers(view){
    const cardboard = qbool('cardboard', false);

    const layerMain = DOC.getElementById('hydration-layer');
    const layerL = DOC.getElementById('hydration-layerL');
    const layerR = DOC.getElementById('hydration-layerR');
    const cbWrap = DOC.getElementById('cbWrap');

    // Default: single layer
    DOC.body.classList.remove('cardboard');

    if (cardboard && view==='cvr' && layerL && layerR && cbWrap){
      DOC.body.classList.add('cardboard');
      cbWrap.hidden = false;

      // Engine should spawn into L/R
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        view,
        cardboard:true,
        layers: ['hydration-layerL','hydration-layerR']
      });
      return;
    }

    // Non-cardboard: hide split wrapper if exists
    if (cbWrap) cbWrap.hidden = true;

    // Engine spawns into main
    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
      view,
      cardboard:false,
      layers: layerMain ? ['hydration-layer'] : []
    });
  }

  function bindOverlay(){
    const overlay = DOC.getElementById('startOverlay');
    const btnStart = DOC.getElementById('btnStart');
    const ovSub = DOC.getElementById('ovSub');

    // text hint
    const view = (DOC.body.classList.contains('view-cvr') ? 'cVR' :
                 DOC.body.classList.contains('view-mobile') ? 'Mobile' : 'PC');
    const isCB = DOC.body.classList.contains('cardboard');
    if (ovSub){
      ovSub.textContent =
        isCB ? 'โหมด Cardboard: เล็งกลางจอ + ยิงด้วย crosshair' :
        (view==='cVR' ? 'โหมด cVR: เล็งกลางจอ + ยิงด้วย crosshair' :
         'แตะเพื่อเริ่ม (ยิงที่เป้า)');
    }

    function start(){
      if (!overlay) return;
      overlay.classList.add('hide');
      overlay.style.display='none';
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }

    // click start
    if (btnStart){
      btnStart.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){} start(); });
    }

    // tap anywhere on overlay card area to start (kids-friendly)
    if (overlay){
      overlay.addEventListener('pointerdown', (e)=>{
        // ignore if clicking a button (it already handles)
        const t = e.target;
        if (t && (t.closest && t.closest('button'))) return;
        start();
      }, { passive:true });
    }

    // back hub buttons
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });
  }

  function boot(){
    // Respect existing view param (NO override)
    const viewQ = String(qs('view','')).toLowerCase();
    const view = (viewQ==='pc'||viewQ==='mobile'||viewQ==='cvr') ? viewQ : detectView();

    setBodyView(view);
    setKidsFlag();
    setCardboardAndLayers(view);
    bindOverlay();

    // Optional: expose view info for debugging
    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, { view });
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

})();