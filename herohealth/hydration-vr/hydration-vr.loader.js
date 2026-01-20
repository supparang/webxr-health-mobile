// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) BUT: if ?view= exists => DO NOT override
// ✅ Cardboard: ?cardboard=1 => body.cardboard + layers [hydration-layerL, hydration-layerR]
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Fullscreen helper + best-effort landscape lock (for touch/cardboard)
// ✅ Start overlay: btnStart / tap backdrop => emit hha:start
// ✅ Back HUB buttons: .btnBackHub
// ✅ Pass-through support: (launcher already does) loader just reads params
//
// Expected HTML IDs/classes in hydration-vr.html:
//   #startOverlay, #btnStart, #ovSub, .btnBackHub
//   #hydration-layer, #hydration-layerL, #hydration-layerR, #cbWrap
//
// Notes:
// - This loader does NOT run the engine. Engine is hydration.safe.js (module)
// - This loader must be included BEFORE hydration.safe.js starts listening (defer is fine)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function setText(id, t){
    const el = DOC.getElementById(id);
    if (el) el.textContent = String(t);
  }

  // ---------- View detect (only used if URL not set) ----------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    // touch devices:
    // - landscape + wide => cvr (crosshair shoot)
    // - otherwise => mobile
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function applyViewClasses(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if(view==='cvr') b.classList.add('view-cvr');
    else if(view==='mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function applyCardboard(cardboardOn){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!cardboardOn);

    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap) cbWrap.hidden = !cardboardOn;

    // expose layers list for engines (hydration.safe.js reads this)
    if (cardboardOn){
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL', 'hydration-layerR'];
    } else {
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layer'];
    }
  }

  // ---------- Fullscreen + orientation helpers ----------
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen){ await el.requestFullscreen(); return true; }
      return false;
    }catch(_){ return false; }
  }

  async function lockLandscapeBestEffort(){
    try{
      const scr = WIN.screen;
      if (scr && scr.orientation && scr.orientation.lock){
        await scr.orientation.lock('landscape');
        return true;
      }
    }catch(_){}
    return false;
  }

  function isIOS(){
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && (navigator.maxTouchPoints|0)>1);
  }

  async function prepareImmersive(view, cardboardOn){
    // For mobile/cvr/cardboard => best-effort fullscreen and landscape
    const touchMode = (view==='mobile' || view==='cvr' || !!cardboardOn);
    if (!touchMode) return;

    // iOS: fullscreen/orientation are limited; still safe to call
    await requestFullscreen();
    if (!isIOS()) await lockLandscapeBestEffort();
  }

  // ---------- Start overlay wiring ----------
  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.style.display = 'none';
    ov.classList.add('hide');
  }

  function startGame(){
    hideOverlay();
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindOverlay(view, cardboardOn){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;

    // subtitle hint
    const kids = String(qs('kids','0')).toLowerCase();
    const isKids = (kids==='1' || kids==='true' || kids==='yes');

    const hintParts = [];
    if (view === 'cvr') hintParts.push('cVR: ยิงจากกลางจอ (crosshair)');
    if (cardboardOn) hintParts.push('Cardboard: ใส่แว่นแล้วกด ENTER VR');
    if (isKids) hintParts.push('Kids mode: ON');
    setText('ovSub', hintParts.length ? hintParts.join(' • ') : 'แตะเพื่อเริ่ม');

    // start button
    const btnStart = DOC.getElementById('btnStart');
    btnStart?.addEventListener('click', async (ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      await prepareImmersive(view, cardboardOn);
      startGame();
    }, { passive:false });

    // tap anywhere on overlay card/backdrop to start (kids-friendly)
    ov.addEventListener('pointerdown', async (ev)=>{
      // ignore clicks on buttons (they already start)
      const t = ev.target;
      if (t && t.closest && t.closest('button')) return;
      await prepareImmersive(view, cardboardOn);
      startGame();
    }, { passive:true });

    // back hub buttons
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); }catch(_){}
        location.href = hub;
      });
    });
  }

  // ---------- Init ----------
  const viewQ = qs('view', null);
  const view = String((viewQ && viewQ.trim()) ? viewQ : detectView()).toLowerCase();
  applyViewClasses(view);

  const cardboardOn = String(qs('cardboard','0')).toLowerCase();
  const isCardboard = (cardboardOn==='1' || cardboardOn==='true' || cardboardOn==='yes');
  applyCardboard(isCardboard);

  bindOverlay(view, isCardboard);

  // Optional: if overlay is missing, still try auto-start
  setTimeout(()=>{
    const ov = DOC.getElementById('startOverlay');
    const hidden = !ov || getComputedStyle(ov).display==='none' || ov.classList.contains('hide');
    if (hidden){
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }
  }, clamp(parseInt(qs('autoStartMs', 0),10) || 0, 0, 3000));

})();