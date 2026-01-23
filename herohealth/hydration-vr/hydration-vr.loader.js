// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (ONLY if ?view is missing)  **NO OVERRIDE**
// ✅ Sets body classes: view-pc / view-mobile / view-cvr + optional cardboard
// ✅ Provides window.HHA_VIEW.layers for Cardboard split (L/R)
// ✅ Start overlay: tap/button -> emit hha:start (once) + best-effort fullscreen
// ✅ Pass-through friendly (does not rewrite URL)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const qhas = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // touch device
    if (isTouch){
      // landscape tablet/phone wide => prefer cVR (crosshair shoot)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if (v === 'cardboard' || v === 'vr') return 'cvr'; // cardboard handled by ?cardboard=1
    if (v === 'cvr') return 'cvr';
    if (v === 'mobile') return 'mobile';
    return 'pc';
  }

  // ✅ NO OVERRIDE: respect view if provided
  const view = normalizeView(qhas('view') ? qs('view','pc') : detectView());
  const cardboard = String(qs('cardboard','0')).toLowerCase();
  const isCardboard = (cardboard === '1' || cardboard === 'true' || cardboard === 'yes');

  // ---------- Body classes ----------
  function setBodyView(){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    b.classList.add(view === 'cvr' ? 'view-cvr' : (view === 'mobile' ? 'view-mobile' : 'view-pc'));
    if (isCardboard) b.classList.add('cardboard');
  }

  // ---------- Cardboard layers config ----------
  function setLayers(){
    // For engines that want L/R layers
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    WIN.HHA_VIEW.view = view;
    WIN.HHA_VIEW.cardboard = !!isCardboard;

    // Provide layers (prefer L/R when cardboard)
    if (isCardboard){
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
      // show cb wrap if exists
      const cb = DOC.getElementById('cbWrap');
      if (cb) cb.hidden = false;
    } else {
      WIN.HHA_VIEW.layers = ['hydration-layer'];
      const cb = DOC.getElementById('cbWrap');
      if (cb) cb.hidden = true;
    }
  }

  // ---------- Start overlay ----------
  let started = false;

  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }catch(_){}
  }

  async function lockLandscapeBestEffort(){
    try{
      const scr = screen.orientation;
      if (scr && scr.lock){
        await scr.lock('landscape');
      }
    }catch(_){}
  }

  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }

  function emitStart(){
    if (started) return;
    started = true;
    try{ WIN.dispatchEvent(new CustomEvent('hha:start', { detail:{ view, cardboard:!!isCardboard } })); }catch(_){}
  }

  async function startNow(){
    // best-effort: fullscreen/landscape (especially for cardboard)
    if (isCardboard){
      await requestFullscreen();
      await lockLandscapeBestEffort();
    } else if (view === 'cvr'){
      // cVR: fullscreen helps crosshair feel
      await requestFullscreen();
    }
    hideOverlay();
    emitStart();
  }

  function wireOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const sub = DOC.getElementById('ovSub');

    if (sub){
      const kids = String(qs('kids','0')).toLowerCase();
      const KIDS = (kids==='1'||kids==='true'||kids==='yes');
      const mode = (isCardboard ? 'CARDBOARD' : view.toUpperCase());
      sub.textContent = KIDS ? `โหมดเด็ก (KIDS) • ${mode} • แตะเพื่อเริ่ม` : `${mode} • แตะเพื่อเริ่ม`;
    }

    btn?.addEventListener('click', (e)=>{
      try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
      startNow();
    }, { passive:false });

    // tap anywhere on overlay
    ov?.addEventListener('pointerdown', (e)=>{
      // allow button click to handle; but if user taps card area it should start too
      if (e && e.target && (e.target.closest && e.target.closest('button'))) return;
      try{ e.preventDefault(); }catch(_){}
      startNow();
    }, { passive:false });
  }

  // ---------- Boot ----------
  function boot(){
    setBodyView();
    setLayers();
    wireOverlay();
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();