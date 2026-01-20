// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Sets body view classes: view-pc / view-mobile / view-cvr + optional cardboard
// ✅ Auto-detect ONLY if URL has no ?view=...
// ✅ Cardboard: uses ?cardboard=1 (or body.cardboard) and assigns layers for engine
// ✅ Exposes window.HHA_VIEW = { view, cardboard, layers:[...] }
// ✅ Start overlay: tap/click => dispatch hha:start
// ✅ Back to HUB buttons (.btnBackHub)
// ✅ Does NOT override if ?view= exists (สำคัญตามที่ตกลง)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // cVR: touch + landscape + wide enough (มือถือแนวนอน/แท็บเล็ต)
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if(v === 'vr') v = 'cvr';
    if(v === 'cardboard') v = 'cvr';
    if(v !== 'pc' && v !== 'mobile' && v !== 'cvr') v = '';
    return v;
  }

  function setBodyView(view, cardboard){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    b.classList.add('view-' + view);
    if(cardboard) b.classList.add('cardboard');
  }

  function setupCardboard(cardboard){
    const cbWrap = DOC.getElementById('cbWrap');
    if(cbWrap){
      cbWrap.hidden = !cardboard ? true : false;
    }
  }

  function setHHAView(view, cardboard){
    // Engine will call getLayers() and will use HHA_VIEW.layers if present
    const layers = cardboard
      ? ['hydration-layerL', 'hydration-layerR']
      : ['hydration-layer'];

    WIN.HHA_VIEW = {
      view,
      cardboard: !!cardboard,
      layers
    };
  }

  function bindBackToHub(){
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });
  }

  // ---------- Start overlay ----------
  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if(!ov) return;
    ov.style.display = 'none';
    try{ ov.classList.add('hide'); }catch(_){}
  }

  function startGame(){
    hideOverlay();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const sub = DOC.getElementById('ovSub');

    // Update overlay subtitle (kids, view)
    const kids = String(qs('kids','0')).toLowerCase();
    const isKids = (kids==='1' || kids==='true' || kids==='yes');

    const view = normalizeView(qs('view','')) || '';
    const cb = String(qs('cardboard','0')).toLowerCase();
    const cardboard = (cb==='1'||cb==='true'||cb==='yes');

    if(sub){
      const vTxt = cardboard ? 'CARDBOARD' : (view ? view.toUpperCase() : 'AUTO');
      sub.textContent = isKids
        ? `โหมดเด็ก (Kids) • ${vTxt} • แตะ “เริ่ม!” ได้เลย 😊`
        : `แตะ “เริ่ม!” เพื่อเริ่มเกม • ${vTxt}`;
    }

    // Must be pointer-events auto on overlay buttons
    btn?.addEventListener('click', (e)=>{ try{ e.preventDefault(); }catch(_){} startGame(); });

    // Tap anywhere on overlay card to start (kids-friendly)
    ov?.addEventListener('click', (e)=>{
      // allow clicking buttons normally
      const t = e.target;
      if(t && (t.id === 'btnStart' || (t.classList && t.classList.contains('btn')))) return;
      startGame();
    }, { passive:true });

    // Safety: if overlay somehow hidden already, autostart in 600ms
    setTimeout(()=>{
      const hidden = !ov || getComputedStyle(ov).display === 'none' || ov.classList.contains('hide');
      if(hidden) startGame();
    }, 600);
  }

  // ---------- Boot sequence ----------
  function boot(){
    // Decide view: do NOT override if ?view exists
    const viewQ = normalizeView(qs('view',''));
    const view = viewQ || detectView();

    // Cardboard flag
    const cb = String(qs('cardboard','0')).toLowerCase();
    const cardboard = (cb==='1'||cb==='true'||cb==='yes');

    // apply classes
    setBodyView(view, cardboard);
    setupCardboard(cardboard);
    setHHAView(view, cardboard);

    // bind hub back
    bindBackToHub();

    // bind start
    bindStartOverlay();

    // Extra: encourage fullscreen on touch (best-effort, no hard lock)
    try{
      if(view !== 'pc'){
        DOC.body.addEventListener('click', ()=>{
          try{
            if(DOC.fullscreenElement) return;
            const el = DOC.documentElement;
            el.requestFullscreen?.().catch(()=>{});
          }catch(_){}
        }, { once:true, passive:true });
      }
    }catch(_){}
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();