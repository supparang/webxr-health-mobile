// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view: pc / mobile / cvr
// ✅ DO NOT override if URL already has ?view=...
// ✅ Cardboard: ?cardboard=1 OR view=cardboard => force view=cvr + body.cardboard
// ✅ Sets body classes: view-pc / view-mobile / view-cvr + cardboard + is-touch
// ✅ Exposes window.HHA_VIEW = { view, cardboard, layers:[...] }
// ✅ Start overlay: btnStart / tap overlay => emits hha:start + hides overlay
// ✅ Back hub buttons (.btnBackHub) go to ?hub=...

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const hub = String(qs('hub','../hub.html'));

  // ---------- view detect ----------
  function isTouch(){
    return ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
  }

  function detectView(){
    // Same logic as your launcher, but safe here too.
    const touch = isTouch();
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = (w >= h);

    if (touch){
      // Big touch + landscape => cVR
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if (v === 'cardboard') return 'cvr';
    if (v === 'vr') return 'cvr';
    if (v === 'cvr') return 'cvr';
    if (v === 'mobile') return 'mobile';
    if (v === 'pc' || v === 'desktop') return 'pc';
    return '';
  }

  // ---------- classes ----------
  function setBodyClasses(view, cardboard){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-cvr');
    b.classList.add(view === 'mobile' ? 'view-mobile' : view === 'cvr' ? 'view-cvr' : 'view-pc');

    if (isTouch()) b.classList.add('is-touch'); else b.classList.remove('is-touch');

    if (cardboard) b.classList.add('cardboard');
    else b.classList.remove('cardboard');
  }

  // ---------- layers selection ----------
  function computeLayers(cardboard){
    // These IDs exist in hydration-vr.html
    const main = 'hydration-layer';
    const L = 'hydration-layerL';
    const R = 'hydration-layerR';
    const cbWrap = DOC.getElementById('cbWrap');

    if (cardboard){
      if (cbWrap) cbWrap.hidden = false;
      return [L, R];
    } else {
      if (cbWrap) cbWrap.hidden = true;
      return [main];
    }
  }

  // ---------- best-effort fullscreen/orientation (Cardboard only) ----------
  async function tryFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI:'hide' });
    }catch(_){}
  }
  async function tryLandscape(){
    try{
      const scr = screen.orientation;
      if (!scr || !scr.lock) return;
      await scr.lock('landscape');
    }catch(_){}
  }

  // ---------- start overlay ----------
  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }

  function bindStartOverlay(cardboard){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');

    // Back hub buttons (in start overlay + summary)
    DOC.querySelectorAll('.btnBackHub').forEach((el)=>{
      el.addEventListener('click', ()=>{ location.href = hub; }, { passive:true });
    });

    // if overlay missing => start anyway
    if (!ov){
      emit('hha:start');
      return;
    }

    // overlay subtitle
    const sub = DOC.getElementById('ovSub');
    if (sub){
      const v = WIN.HHA_VIEW?.view || '';
      const suffix = cardboard ? ' (Cardboard)' : '';
      sub.textContent = `แตะเพื่อเริ่ม — โหมด: ${String(v).toUpperCase()}${suffix}`;
    }

    // Start handlers
    const doStart = async ()=>{
      // Cardboard: try fullscreen + landscape (best-effort)
      if (cardboard){
        await tryFullscreen();
        await tryLandscape();
      }
      hideOverlay();
      emit('hha:start');
    };

    btn?.addEventListener('click', (e)=>{
      try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
      doStart();
    });

    // Tap anywhere on overlay card/backdrop
    ov.addEventListener('pointerdown', (e)=>{
      // ignore if clicking on buttons
      const t = e.target;
      if (t && (t.closest && t.closest('button'))) return;
      doStart();
    }, { passive:true });
  }

  // ---------- main init ----------
  function init(){
    const curViewQ = qs('view','');
    const viewQ = normalizeView(curViewQ);

    // Cardboard flag
    let cardboard = false;
    const cbQ = String(qs('cardboard','0')).toLowerCase();
    if (cbQ === '1' || cbQ === 'true' || cbQ === 'yes') cardboard = true;
    if (String(curViewQ).toLowerCase() === 'cardboard') cardboard = true;

    // IMPORTANT: do not override if view exists
    const view = viewQ || detectView();

    // If cardboard => force cvr view
    const finalView = cardboard ? 'cvr' : view;

    setBodyClasses(finalView, cardboard);

    const layers = computeLayers(cardboard);

    // expose to engine
    WIN.HHA_VIEW = {
      view: finalView,
      cardboard: cardboard,
      layers: layers.slice(),
      hub
    };

    // Start overlay bindings
    bindStartOverlay(cardboard);

    // If URL has run=play and overlay was manually hidden by something, safety auto-start
    // (engine also has a fallback timer; this is extra-safe)
    setTimeout(()=>{
      const ov = DOC.getElementById('startOverlay');
      const hidden = !ov || getComputedStyle(ov).display === 'none' || ov.classList.contains('hide');
      if (hidden){
        emit('hha:start');
      }
    }, 650);
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

})();