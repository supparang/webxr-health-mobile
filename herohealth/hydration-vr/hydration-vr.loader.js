// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST / AUTO / NO-OVERRIDE)
// ✅ Auto-detect view (pc/mobile/cvr) BUT NEVER override if ?view= exists
// ✅ cVR strict: disable pointer-events on targets (must shoot via crosshair -> hha:shoot)
// ✅ Cardboard: ?cardboard=1 => split layers L/R + body.cardboard + (if no view param) default view=cvr
// ✅ Expose window.HHA_VIEW = { view, cardboard, layers:[...] }
// ✅ Start overlay: tap/click -> hide overlay -> emit hha:start once
// ✅ Back HUB buttons
// ✅ Best-effort fullscreen + landscape lock on start (mobile/cvr/cardboard)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const hasQ = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  // -------------------- helpers --------------------
  const isTouch = ()=> ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if(v==='pc'||v==='mobile'||v==='cvr'||v==='vr') return v;
    return '';
  }

  function detectViewAuto(){
    // policy: stable & kid-friendly
    // touch+landscape+wide => cvr, else touch => mobile, else pc
    const touch = isTouch();
    const w = Math.max(1, WIN.innerWidth || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    if(touch){
      if(landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
  }

  function ensureStyleOnce(id, css){
    if(DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = css;
    DOC.head.appendChild(st);
  }

  function bestEffortFullscreen(){
    try{
      if(DOC.fullscreenElement) return;
      const el = DOC.documentElement;
      if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }catch(_){}
  }

  async function bestEffortLandscapeLock(){
    try{
      if(!screen.orientation || !screen.orientation.lock) return;
      await screen.orientation.lock('landscape').catch(()=>{});
    }catch(_){}
  }

  function applyCardboardUI(on){
    const cbWrap = DOC.getElementById('cbWrap');
    const mainLayer = DOC.getElementById('hydration-layer');
    if(on){
      if(cbWrap) cbWrap.hidden = false;
      if(mainLayer) mainLayer.style.display = 'none';
    }else{
      if(cbWrap) cbWrap.hidden = true;
      if(mainLayer) mainLayer.style.display = '';
    }
  }

  // -------------------- read params (NO OVERRIDE) --------------------
  const viewParamExists = hasQ('view');
  const urlView = normalizeView(qs('view',''));
  const cardboard = (() => {
    const c = String(qs('cardboard','0')).toLowerCase();
    return (c==='1' || c==='true' || c==='yes');
  })();

  let view = urlView;

  // if no explicit view -> auto detect
  if(!viewParamExists || !view){
    view = detectViewAuto();
  }

  // cardboard: only force cvr when user did NOT explicitly set view
  if(cardboard && (!viewParamExists || !urlView)){
    view = 'cvr';
  }

  // touch marker
  DOC.body.classList.toggle('is-touch', !!isTouch());

  // apply body classes
  setBodyView(view);
  DOC.body.classList.toggle('cardboard', !!cardboard);

  // -------------------- cVR strict (สำคัญตามมาตรฐาน) --------------------
  // ปิดการคลิกเป้า เพื่อให้ยิงผ่าน crosshair (hha:shoot) เท่านั้น
  if(view === 'cvr'){
    ensureStyleOnce('hha-cvr-strict-style', `
      body.view-cvr .hvr-target{ pointer-events:none !important; }
      body.view-cvr #hydration-layer,
      body.view-cvr #hydration-layerL,
      body.view-cvr #hydration-layerR{ pointer-events:none !important; }
    `);
  }

  // -------------------- layers config for engine --------------------
  const layers = cardboard ? ['hydration-layerL','hydration-layerR'] : ['hydration-layer'];
  WIN.HHA_VIEW = { view, cardboard: !!cardboard, layers };

  applyCardboardUI(!!cardboard);

  // -------------------- HUB back buttons --------------------
  const hub = String(qs('hub','../hub.html'));
  DOC.querySelectorAll('.btnBackHub').forEach((btn)=>{
    btn.addEventListener('click', ()=>{ location.href = hub; });
  });

  // -------------------- start overlay --------------------
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  if(ovSub){
    const vtxt = (view||'pc').toUpperCase();
    ovSub.textContent = cardboard ? `Cardboard (${vtxt}) — แตะเพื่อเริ่ม` : `โหมด: ${vtxt} — แตะเพื่อเริ่ม`;
  }

  let started = false;

  async function startGame(){
    if(started) return;
    started = true;

    // mobile/cvr/cardboard: best effort fullscreen + rotate
    if(isTouch() || view==='cvr' || cardboard){
      bestEffortFullscreen();
      await bestEffortLandscapeLock();
    }

    // hide overlay
    if(overlay){
      overlay.classList.add('hide');
      overlay.style.display = 'none';
    }

    // start signal (engine listens once)
    try{
      WIN.dispatchEvent(new CustomEvent('hha:start', { detail:{ view, cardboard } }));
    }catch(_){}
  }

  // tap anywhere on overlay
  if(overlay){
    overlay.addEventListener('pointerdown', (ev)=>{
      try{ ev.preventDefault(); }catch(_){}
      startGame();
    }, { passive:false });
  }

  // explicit button
  if(btnStart){
    btnStart.addEventListener('click', (ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      startGame();
    }, { passive:false });
  }

  // safety: if overlay is missing, autostart shortly
  setTimeout(()=>{
    if(!overlay && !started) startGame();
  }, 650);

})();