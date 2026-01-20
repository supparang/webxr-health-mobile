// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) BUT: if ?view= exists -> DO NOT override
// ✅ Cardboard: ?cardboard=1 -> body.cardboard + layers L/R enabled
// ✅ Sets body classes: view-pc/view-mobile/view-cvr + device hints
// ✅ Start overlay: tap/click -> emits hha:start (once)
// ✅ Back-to-hub from overlay buttons
// ✅ Safe: does not assume other modules loaded order (defer-friendly)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // -------------------- detect view (only if no explicit ?view=) --------------------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // Heuristic:
    // - touch + landscape + wide enough => cVR (crosshair)
    // - touch otherwise => mobile
    // - non-touch => pc
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if (v==='vr') v='cvr';
    if (v==='cardboard') v='cvr';
    if (v!=='pc' && v!=='mobile' && v!=='cvr') v='';
    return v;
  }

  // -------------------- apply body classes --------------------
  function applyViewClasses(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if(view==='pc') b.classList.add('view-pc');
    else if(view==='mobile') b.classList.add('view-mobile');
    else if(view==='cvr') b.classList.add('view-cvr');

    // Hint for css if needed
    b.dataset.view = view;
  }

  function applyCardboard(cardboardOn){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!cardboardOn);

    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap){
      cbWrap.hidden = !cardboardOn;
    }
  }

  // Provide layers config to engine
  function setLayersConfig(cardboardOn){
    // Engine reads window.HHA_VIEW.layers
    // For cardboard: use L/R layers; otherwise: main layer
    const layers = cardboardOn
      ? ['hydration-layerL','hydration-layerR']
      : ['hydration-layer'];

    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, { layers });
  }

  // -------------------- overlay controls --------------------
  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.hidden = true;
    ov.classList.add('hide');
  }

  function showOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.hidden = false;
    ov.classList.remove('hide');
  }

  function bindStart(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    if (!ov) return;

    let started = false;

    function startOnce(){
      if (started) return;
      started = true;

      hideOverlay();
      emit('hha:start', { from:'overlay' });
    }

    // tap anywhere on overlay card area is ok (kid-friendly)
    ov.addEventListener('pointerdown', (ev)=>{
      // allow buttons to handle themselves
      const t = ev.target;
      if (t && (t.closest && t.closest('button'))) return;
      try{ ev.preventDefault(); }catch(_){}
      startOnce();
    }, { passive:false });

    btn?.addEventListener('click', (ev)=>{
      try{ ev.preventDefault(); }catch(_){}
      startOnce();
    });

    // Back hub buttons
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach((el)=>{
      el.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); }catch(_){}
        location.href = hub;
      });
    });

    // If user already interacted (rare), allow auto start when overlay is hidden externally
    setTimeout(()=>{
      const hidden = (ov.hidden === true) || (getComputedStyle(ov).display === 'none') || ov.classList.contains('hide');
      if (hidden) startOnce();
    }, 650);
  }

  // -------------------- Fullscreen/orientation helpers (lightweight) --------------------
  function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) return el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    }catch(_){}
  }

  function lockLandscapeBestEffort(){
    try{
      const scr = screen.orientation;
      if (scr && scr.lock) scr.lock('landscape').catch(()=>{});
    }catch(_){}
  }

  // If cardboard: try a bit harder for fullscreen/landscape after first gesture (kid-safe)
  function bindCardboardBoost(cardboardOn){
    if (!cardboardOn) return;

    const once = ()=>{
      WIN.removeEventListener('pointerdown', once);
      requestFullscreen();
      lockLandscapeBestEffort();
    };
    WIN.addEventListener('pointerdown', once, { passive:true });
  }

  // -------------------- init --------------------
  (function init(){
    // Respect explicit view param: DO NOT override
    const viewQ = normalizeView(qs('view',''));
    const view = viewQ || detectView();

    const cardboard = String(qs('cardboard','0')).toLowerCase();
    const cardboardOn = (cardboard==='1' || cardboard==='true' || cardboard==='yes');

    applyViewClasses(view);
    applyCardboard(cardboardOn);
    setLayersConfig(cardboardOn);
    bindCardboardBoost(cardboardOn);

    // Update overlay subtext (nice UX)
    const sub = DOC.getElementById('ovSub');
    if (sub){
      const kids = String(qs('kids','0')).toLowerCase();
      const kidsOn = (kids==='1' || kids==='true' || kids==='yes');
      const label = (view==='cvr') ? (cardboardOn ? 'Cardboard' : 'cVR') : view.toUpperCase();
      sub.textContent = kidsOn
        ? `โหมดเด็ก (Kids) • โหมดเล่น: ${label} • แตะเพื่อเริ่ม`
        : `โหมดเล่น: ${label} • แตะเพื่อเริ่ม`;
    }

    // Ensure overlay visible at boot
    showOverlay();
    bindStart();
  })();

})();