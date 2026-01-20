// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration Quest VR Loader — PRODUCTION (LATEST / HHA Standard)
// ✅ Auto-detect view: PC / Mobile / cVR / Cardboard
// ✅ DO NOT override if URL already has ?view=...
// ✅ Cardboard: sets body.cardboard + layers (hydration-layerL/R)
// ✅ Sets body.view-* classes and window.HHA_VIEW.layers for engine
// ✅ Start overlay: tap-to-start + emits hha:start
// ✅ Back to HUB button(s) + safe pass-through
// ✅ Fullscreen/orientation best-effort (mobile/cardboard)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ---------------- URL params ----------------
  const hub = String(qs('hub','../hub.html'));
  let view = String(qs('view','')||'').toLowerCase().trim();
  const cardboardQ = String(qs('cardboard','0')||'0').toLowerCase();
  const cardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  // ---------------- helpers ----------------
  function setBodyView(v){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if(v==='pc') b.classList.add('view-pc');
    else if(v==='cvr') b.classList.add('view-cvr');
    else b.classList.add('view-mobile');
  }

  function detectView(){
    // Simple + reliable:
    // - if touch device:
    //   - landscape + wide => cVR (phone in cardboard-like landscape or big phone)
    //   - else => mobile
    // - else => pc
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if(isTouch){
      if(landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function ensureLayers(){
    // Engine will call getLayers() and prefer window.HHA_VIEW.layers
    const main = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');

    // Cardboard mode uses L/R if present
    if(cardboard && L && R){
      WIN.HHA_VIEW = { layers: ['hydration-layerL','hydration-layerR'] };
      try{
        DOC.body.classList.add('cardboard');
        const cbWrap = DOC.getElementById('cbWrap');
        if(cbWrap) cbWrap.hidden = false;
      }catch(_){}
      return;
    }

    // Non-cardboard: single layer
    if(main){
      WIN.HHA_VIEW = { layers: ['hydration-layer'] };
    } else if(L && R){
      // fallback if main missing
      WIN.HHA_VIEW = { layers: ['hydration-layerL','hydration-layerR'] };
    } else {
      WIN.HHA_VIEW = { layers: [] };
    }

    try{
      DOC.body.classList.remove('cardboard');
      const cbWrap = DOC.getElementById('cbWrap');
      if(cbWrap) cbWrap.hidden = true;
    }catch(_){}
  }

  // -------- Fullscreen / orientation best-effort --------
  function requestFullscreen(){
    const el = DOC.documentElement;
    try{
      if(el.requestFullscreen) return el.requestFullscreen();
      if(el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    }catch(_){}
  }
  function tryLockLandscape(){
    // only best-effort; many browsers disallow without user gesture
    try{
      const o = screen.orientation;
      if(o && o.lock) return o.lock('landscape');
    }catch(_){}
  }

  // ---------------- start overlay ----------------
  function bindOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btnStart = DOC.getElementById('btnStart');
    const sub = DOC.getElementById('ovSub');

    const kidsQ = String(qs('kids','0')).toLowerCase();
    const KIDS = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');
    const run = String(qs('run', qs('runMode','play'))).toLowerCase();

    if(sub){
      const vLabel = (view||'').toUpperCase() || 'AUTO';
      const cbLabel = cardboard ? ' + CARDBOARD' : '';
      const kidsLabel = KIDS ? ' • Kids' : '';
      sub.textContent = `โหมด: ${vLabel}${cbLabel}${kidsLabel} • run=${run}`;
    }

    // back buttons
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });

    function startNow(){
      try{
        if(ov) ov.classList.add('hide');
        if(ov) ov.style.display='none';
      }catch(_){}
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }

    // Start button
    if(btnStart){
      btnStart.addEventListener('click', async ()=>{
        // user gesture: allow fullscreen/orientation lock
        if(view==='mobile' || view==='cvr' || cardboard){
          await requestFullscreen();
          await tryLockLandscape();
        }
        startNow();
      }, { passive:true });
    }

    // Tap anywhere on overlay to start
    if(ov){
      ov.addEventListener('click', async (e)=>{
        // ignore clicks on buttons (they already handle)
        const t = e.target;
        if(t && (t.closest && t.closest('button'))) return;

        if(view==='mobile' || view==='cvr' || cardboard){
          await requestFullscreen();
          await tryLockLandscape();
        }
        startNow();
      }, { passive:true });
    }

    // If overlay missing for some reason, auto-start quickly
    setTimeout(()=>{
      const missing = !ov;
      const hidden = ov && (getComputedStyle(ov).display==='none' || ov.classList.contains('hide'));
      if(missing || hidden){
        try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
      }
    }, 650);
  }

  // ---------------- main ----------------
  (function init(){
    // Decide view ONLY if not provided
    if(!view){
      view = detectView();
    } else {
      // normalize only
      if(view!=='pc' && view!=='mobile' && view!=='cvr') view = 'mobile';
    }

    setBodyView(view);
    ensureLayers();
    bindOverlay();

    // keep view stable on resize (but refresh layers for safety)
    let lastW = WIN.innerWidth, lastH = WIN.innerHeight;
    WIN.addEventListener('resize', ()=>{
      const w = WIN.innerWidth, h = WIN.innerHeight;
      // if big change, update layers (safe)
      if(Math.abs(w-lastW) + Math.abs(h-lastH) > 120){
        lastW=w; lastH=h;
        ensureLayers();
      }
    }, { passive:true });
  })();

})();