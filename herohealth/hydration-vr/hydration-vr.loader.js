// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile) if NO ?view= provided
// ✅ NEVER override explicit ?view=
// ✅ Cardboard: on enter-vr => enable split layers (L/R) + show #cbWrap
// ✅ cVR strict: view=cvr => use crosshair shoot (via vr-ui.js) + hide pointer affordance
// ✅ Start overlay => button / tap anywhere => dispatch hha:start once
// ✅ Back to hub button(s) use ?hub=...
// ✅ Fullscreen + best-effort landscape lock on mobile/cardboard

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  const hub = String(qs('hub','../hub.html'));
  const viewParam = String(qs('view','')||'').toLowerCase().trim(); // if provided => DO NOT override
  const kids = String(qs('kids','0')).toLowerCase();
  const isKids = (kids==='1'||kids==='true'||kids==='yes');

  const body = DOC.body;

  const elScene = DOC.querySelector('a-scene');
  const elOverlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const cbWrap = DOC.getElementById('cbWrap');

  // layers
  const layerMain = DOC.getElementById('hydration-layer');
  const layerL = DOC.getElementById('hydration-layerL');
  const layerR = DOC.getElementById('hydration-layerR');

  // ----- helpers -----
  function isMobileUA(){
    const ua = (navigator.userAgent||'').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/.test(ua);
  }
  function detectDefaultView(){
    // only PC vs mobile; VR/cVR handled by ?view= or enter-vr event
    return isMobileUA() ? 'mobile' : 'pc';
  }

  function setBodyView(view){
    body.classList.remove('view-pc','view-mobile','view-vr','view-cvr','cardboard');
    if (view === 'mobile') body.classList.add('view-mobile');
    else if (view === 'cvr') body.classList.add('view-cvr');
    else if (view === 'vr') body.classList.add('view-vr');
    else body.classList.add('view-pc');
  }

  function setCardboard(on){
    body.classList.toggle('cardboard', !!on);
    if (cbWrap) cbWrap.hidden = !on;

    // publish layer routing for engine
    if (on && layerL && layerR){
      WIN.HHA_VIEW = { view: 'cardboard', layers: ['hydration-layerL','hydration-layerR'] };
    } else {
      // keep current view mode but default to main layer
      const v = (WIN.HHA_VIEW && WIN.HHA_VIEW.view) || (viewParam || detectDefaultView());
      WIN.HHA_VIEW = { view: v, layers: ['hydration-layer'] };
    }
  }

  async function tryFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen) { await el.requestFullscreen(); return true; }
    }catch(_){}
    return false;
  }

  async function tryLandscape(){
    try{
      if (!screen.orientation || !screen.orientation.lock) return false;
      await screen.orientation.lock('landscape');
      return true;
    }catch(_){}
    return false;
  }

  function bindBackHub(){
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        location.href = hub;
      });
    });
  }

  // ----- init view (NO override) -----
  const initView = viewParam || detectDefaultView();
  setBodyView(initView);

  // publish initial routing for engine
  WIN.HHA_VIEW = { view: initView, layers: ['hydration-layer'] };

  // kids hint
  try{
    const ovSub = DOC.getElementById('ovSub');
    if (ovSub){
      ovSub.textContent = isKids ? 'โหมดเด็ก: คุมง่ายขึ้น — แตะเพื่อเริ่ม' : 'แตะเพื่อเริ่ม';
    }
  }catch(_){}

  bindBackHub();

  // ----- Start overlay gating -----
  let started = false;
  function startGame(){
    if (started) return;
    started = true;

    // hide overlay
    if (elOverlay){
      elOverlay.classList.add('hide');
      elOverlay.style.display = 'none';
    }

    // best-effort FS/landscape for mobile (especially Cardboard)
    if (isMobileUA()){
      tryFullscreen();
      tryLandscape();
    }

    // kick off engine
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  if (btnStart) btnStart.addEventListener('click', startGame);

  // tap anywhere on overlay
  if (elOverlay){
    elOverlay.addEventListener('pointerdown', (ev)=>{
      // ignore if clicked a button
      const t = ev.target;
      if (t && (t.closest && t.closest('button'))) return;
      startGame();
    }, { passive:true });
  }

  // ----- cVR strict handling -----
  // view=cvr => lock gameplay to crosshair; (targets are still clickable but player will use shoot event)
  if (initView === 'cvr'){
    // keep main layer; strict behavior is implemented in engine (listens hha:shoot)
    body.classList.add('view-cvr');
    WIN.HHA_VIEW = { view: 'cvr', layers: ['hydration-layer'] };
  }

  // ----- VR / Cardboard events -----
  // A-Frame emits enter-vr / exit-vr
  function onEnterVR(){
    // entering immersive mode => treat as cardboard if mobile (common), otherwise view-vr
    const mobile = isMobileUA();
    if (mobile){
      setBodyView('vr');
      setCardboard(true);
      tryLandscape();
      tryFullscreen();
    } else {
      setBodyView('vr');
      setCardboard(false);
      WIN.HHA_VIEW = { view: 'vr', layers: ['hydration-layer'] };
    }
  }
  function onExitVR(){
    // return to initial view (still no override)
    const v = viewParam || detectDefaultView();
    setBodyView(v);
    setCardboard(false);
    WIN.HHA_VIEW = { view: v, layers: ['hydration-layer'] };
  }

  if (elScene){
    elScene.addEventListener('enter-vr', onEnterVR);
    elScene.addEventListener('exit-vr', onExitVR);
  }

  // ----- safety: if overlay is absent, autostart after first user gesture -----
  // (บางครั้งบน GitHub pages overlay อาจถูก cache/แก้ css แล้วหาย)
  if (!elOverlay){
    const once = ()=>{
      DOC.removeEventListener('pointerdown', once);
      startGame();
    };
    DOC.addEventListener('pointerdown', once, { passive:true, once:true });
  }

})();