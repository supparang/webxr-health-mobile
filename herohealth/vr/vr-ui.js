// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — SAFE UNIVERSAL — FULL PATCH
// PATCH v20260316-VRUI-AFRAME-PLUS-DOM-FALLBACK
// ✅ FIX: ENTER VR works for both A-Frame and DOM-only games
// ✅ FIX: Hydration/DOM pages can enter fallback cVR mode
// ✅ FIX: correct UI root selectors (#hha-vrui / #hha-crosshair / #hha-vrui-hint)
// ✅ FIX: buttons stay clickable above overlays
// ✅ KEEP: ENTER VR / EXIT / RECENTER + crosshair + hha:shoot
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_VRUI_READY__) return;
  WIN.__HHA_VRUI_READY__ = true;

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return v < a ? a : (v > b ? b : v);
  }

  function now(){
    return (performance && performance.now) ? performance.now() : Date.now();
  }

  function safe(fn){
    try{ return fn(); }catch{ return undefined; }
  }

  function currentView(){
    const fromUrl  = String(qs('view','') || '').toLowerCase();
    const fromHtml = String(DOC.documentElement?.dataset?.view || '').toLowerCase();
    const fromBody = String(DOC.body?.dataset?.view || '').toLowerCase();
    return fromUrl || fromHtml || fromBody || '';
  }

  function isCvrView(v){
    v = String(v || '').toLowerCase();
    return v === 'cvr' || v === 'cardboard';
  }

  // ---- config ----
  const CFG0 = WIN.HHA_VRUI_CONFIG || {};
  const CFG = {
    lockPx: clamp(CFG0.lockPx ?? 28, 6, 80),
    cooldownMs: clamp(CFG0.cooldownMs ?? 90, 20, 400),
    showCrosshair: (CFG0.showCrosshair !== false),
    showButtons: (CFG0.showButtons !== false),
    cvrStrict: (CFG0.cvrStrict !== false),
  };

  const STATE = {
    fallbackVr: false,
    lastShotAt: 0,
    preEnterView: currentView() || 'mobile',
    hintTimer: 0,
  };

  let ui = null;
  let crosshair = null;
  let hintEl = null;

  function ensureStyle(){
    if(DOC.getElementById('hha-vrui-style')) return;

    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      #hha-vrui{
        position: fixed !important;
        left: max(10px, env(safe-area-inset-left, 0px)) !important;
        right: max(10px, env(safe-area-inset-right, 0px)) !important;
        bottom: max(10px, env(safe-area-inset-bottom, 0px)) !important;
        z-index: 2147483646 !important;
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        justify-content: flex-end !important;
        pointer-events: none !important;
      }

      #hha-vrui .hha-btn{
        pointer-events: auto !important;
        appearance: none;
        -webkit-appearance: none;
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 999px;
        padding: 10px 12px;
        min-height: 46px;
        background: rgba(2,6,23,.78);
        color: rgba(229,231,235,.96);
        font: 1000 12px/1 system-ui, -apple-system, "Noto Sans Thai", "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 16px 40px rgba(0,0,0,.32);
        backdrop-filter: blur(10px);
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }

      #hha-vrui .hha-btn:active{
        transform: translateY(1px);
      }

      #hha-crosshair{
        position: fixed !important;
        left: 50% !important;
        top: 50% !important;
        width: 20px !important;
        height: 20px !important;
        transform: translate(-50%,-50%) !important;
        z-index: 2147483645 !important;
        pointer-events: none !important;
        opacity: .92;
        display: none;
        place-items: center;
      }

      #hha-crosshair::before{
        content: '';
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 2px solid rgba(229,231,235,.62);
        box-shadow: 0 0 0 2px rgba(2,6,23,.55);
      }

      #hha-crosshair::after{
        content: '';
        position: absolute;
        width: 2px;
        height: 2px;
        border-radius: 999px;
        background: rgba(229,231,235,.95);
        box-shadow: 0 0 0 2px rgba(2,6,23,.55);
      }

      #hha-vrui-hint{
        position: fixed !important;
        left: max(10px, env(safe-area-inset-left, 0px)) !important;
        top: max(10px, env(safe-area-inset-top, 0px)) !important;
        z-index: 2147483646 !important;
        pointer-events: none !important;
        background: rgba(2,6,23,.62);
        border: 1px solid rgba(148,163,184,.18);
        color: rgba(229,231,235,.92);
        border-radius: 999px;
        padding: 6px 10px;
        font: 1000 12px/1 system-ui, -apple-system, "Noto Sans Thai", "Segoe UI", Roboto, sans-serif;
        backdrop-filter: blur(10px);
        display: none;
        white-space: nowrap;
        max-width: calc(100vw - 20px);
        overflow: hidden;
        text-overflow: ellipsis;
      }

      html.hha-vr-fallback,
      body.hha-vr-fallback{
        overscroll-behavior: none !important;
      }

      html.hha-vr-fallback #hha-crosshair,
      body.hha-vr-fallback #hha-crosshair{
        display: grid !important;
        opacity: .98 !important;
      }
    `;
    DOC.head.appendChild(st);
  }

  function swallowUiEvents(el){
    if(!el || el.__hhaSwallowUi) return;
    el.__hhaSwallowUi = true;

    const stop = (ev)=>{
      try{ ev.stopPropagation(); }catch{}
    };

    ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click'].forEach(type=>{
      el.addEventListener(type, stop, true);
    });
  }

  function ensureUI(){
    ensureStyle();

    if(CFG.showButtons && !ui){
      ui = DOC.getElementById('hha-vrui');
      if(!ui){
        ui = DOC.createElement('div');
        ui.id = 'hha-vrui';
        DOC.body.appendChild(ui);
      }
    }

    if(CFG.showButtons && ui && !ui.__built){
      ui.__built = true;
      ui.innerHTML = '';

      const mk = (id, text)=>{
        const b = DOC.createElement('button');
        b.className = 'hha-btn';
        b.id = id;
        b.type = 'button';
        b.textContent = text;
        swallowUiEvents(b);
        return b;
      };

      const btnEnter = mk('hhaBtnEnterVR', '🕶 ENTER VR');
      const btnExit  = mk('hhaBtnExitVR',  '🚪 EXIT VR');
      const btnRe    = mk('hhaBtnRecenter','🎯 RECENTER');

      ui.appendChild(btnEnter);
      ui.appendChild(btnExit);
      ui.appendChild(btnRe);
      swallowUiEvents(ui);

      btnEnter.addEventListener('click', ()=>{ enterVR(); });
      btnExit .addEventListener('click', ()=>{ exitVR();  });
      btnRe   .addEventListener('click', ()=>{ recenter(); });

      btnExit.style.display = 'none';
    }

    if(CFG.showCrosshair && !crosshair){
      crosshair = DOC.getElementById('hha-crosshair');
      if(!crosshair){
        crosshair = DOC.createElement('div');
        crosshair.id = 'hha-crosshair';
        DOC.body.appendChild(crosshair);
      }
    }

    if(!hintEl){
      hintEl = DOC.getElementById('hha-vrui-hint');
      if(!hintEl){
        hintEl = DOC.createElement('div');
        hintEl.id = 'hha-vrui-hint';
        DOC.body.appendChild(hintEl);
      }
    }

    refreshCrosshair();
    setVrButtons(isInVrMode());
  }

  function showHint(text, ms=2200){
    ensureUI();
    if(!hintEl) return;

    hintEl.textContent = String(text || '');
    hintEl.style.display = 'inline-flex';

    if(STATE.hintTimer){
      clearTimeout(STATE.hintTimer);
      STATE.hintTimer = 0;
    }

    STATE.hintTimer = setTimeout(()=>{
      try{ hintEl.style.display = 'none'; }catch{}
    }, ms);
  }

  function refreshCrosshair(){
    ensureUI();
    if(!crosshair) return;

    if(CFG.showCrosshair){
      crosshair.style.display = 'grid';
      crosshair.style.opacity = isCvrView(currentView()) || STATE.fallbackVr ? '0.98' : '0.88';
    }else{
      crosshair.style.display = 'none';
    }
  }

  // ---- scene/native VR ----
  function getScene(){
    return safe(()=> DOC.querySelector('a-scene')) || null;
  }

  function canNativeEnterVR(scene){
    return !!(scene && typeof scene.enterVR === 'function');
  }

  function canNativeExitVR(scene){
    return !!(scene && typeof scene.exitVR === 'function');
  }

  function isNativeVrActive(){
    const s = getScene();
    if(!s) return false;

    try{
      if(typeof s.is === 'function' && s.is('vr-mode')) return true;
      if(typeof s.hasState === 'function' && s.hasState('vr-mode')) return true;
    }catch{}

    return false;
  }

  function isInVrMode(){
    return !!(STATE.fallbackVr || isNativeVrActive());
  }

  function setViewAttr(view){
    const v = String(view || '').toLowerCase();

    try{ DOC.documentElement.dataset.view = v; }catch{}
    try{ if(DOC.body) DOC.body.dataset.view = v; }catch{}

    try{
      const url = new URL(location.href);
      if(v) url.searchParams.set('view', v);
      else url.searchParams.delete('view');
      history.replaceState(null, '', url.toString());
    }catch{}
  }

  function dispatchVrModeChange(detail){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:vrmodechange', { detail }));
    }catch{}
  }

  async function tryFullscreen(el){
    try{
      if(DOC.fullscreenElement) return true;
      if(el && typeof el.requestFullscreen === 'function'){
        await el.requestFullscreen({ navigationUI:'hide' });
        return true;
      }
    }catch{}
    return false;
  }

  async function tryExitFullscreen(){
    try{
      if(DOC.fullscreenElement && typeof DOC.exitFullscreen === 'function'){
        await DOC.exitFullscreen();
        return true;
      }
    }catch{}
    return false;
  }

  async function tryLandscape(){
    try{
      if(screen.orientation && typeof screen.orientation.lock === 'function'){
        await screen.orientation.lock('landscape');
        return true;
      }
    }catch{}
    return false;
  }

  function applyFallbackMode(on){
    STATE.fallbackVr = !!on;

    try{
      DOC.documentElement.classList.toggle('hha-vr-fallback', !!on);
      DOC.body && DOC.body.classList.toggle('hha-vr-fallback', !!on);
    }catch{}

    try{
      DOC.documentElement.dataset.vrFallback = on ? '1' : '0';
      if(DOC.body) DOC.body.dataset.vrFallback = on ? '1' : '0';
    }catch{}

    refreshCrosshair();
    setVrButtons(isInVrMode());
  }

  async function fallbackEnterVR(reason='fallback'){
    STATE.preEnterView = currentView() || 'mobile';
    setViewAttr('cvr');
    applyFallbackMode(true);

    await tryFullscreen(DOC.documentElement);
    await tryLandscape();

    showHint('เข้าโหมด Cardboard แล้ว', 1400);
    dispatchVrModeChange({
      inVr: true,
      native: false,
      reason,
      view: 'cvr'
    });
  }

  async function fallbackExitVR(reason='fallback-exit'){
    applyFallbackMode(false);

    const restoreView = isCvrView(STATE.preEnterView) ? 'mobile' : (STATE.preEnterView || 'mobile');
    setViewAttr(restoreView);

    await tryExitFullscreen();

    showHint('ออกจากโหมด VR', 1000);
    dispatchVrModeChange({
      inVr: false,
      native: false,
      reason,
      view: restoreView
    });
  }

  async function enterVR(){
    ensureUI();

    const s = getScene();

    if(canNativeEnterVR(s)){
      try{
        const ret = s.enterVR();

        if(ret && typeof ret.then === 'function'){
          ret.then(()=>{
            setVrButtons(true);
            dispatchVrModeChange({
              inVr: true,
              native: true,
              reason: 'scene-enter',
              view: isCvrView(currentView()) ? currentView() : 'vr'
            });
          }).catch(()=>{
            fallbackEnterVR('scene-enter-failed');
          });
        }else{
          setTimeout(()=>{
            if(isNativeVrActive()){
              setVrButtons(true);
              dispatchVrModeChange({
                inVr: true,
                native: true,
                reason: 'scene-enter',
                view: isCvrView(currentView()) ? currentView() : 'vr'
              });
            }else{
              fallbackEnterVR('scene-no-vr-state');
            }
          }, 300);
        }
        return;
      }catch{
        await fallbackEnterVR('scene-enter-throw');
        return;
      }
    }

    await fallbackEnterVR('no-scene');
  }

  async function exitVR(){
    const s = getScene();

    if(isNativeVrActive() && canNativeExitVR(s)){
      try{
        const ret = s.exitVR();
        if(ret && typeof ret.then === 'function'){
          ret.finally(()=>{
            setVrButtons(false);
            dispatchVrModeChange({
              inVr: false,
              native: true,
              reason: 'scene-exit',
              view: currentView() || 'mobile'
            });
          });
        }else{
          setTimeout(()=>{
            setVrButtons(false);
            dispatchVrModeChange({
              inVr: false,
              native: true,
              reason: 'scene-exit',
              view: currentView() || 'mobile'
            });
          }, 120);
        }
      }catch{}
    }

    if(STATE.fallbackVr){
      await fallbackExitVR('manual-exit');
      return;
    }

    setVrButtons(false);
  }

  function recenter(){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', {
        detail:{ source:'vr-ui', view: currentView() || 'mobile' }
      }));
    }catch{}

    try{
      const cam = DOC.querySelector('a-camera');
      const lc = cam && cam.components && cam.components['look-controls'];
      if(lc && typeof lc.reset === 'function') lc.reset();
    }catch{}

    showHint('รีเซนเตอร์แล้ว', 700);
  }

  function setVrButtons(inVr){
    ensureUI();
    const enter = DOC.getElementById('hhaBtnEnterVR');
    const exit  = DOC.getElementById('hhaBtnExitVR');

    if(enter) enter.style.display = inVr ? 'none' : 'inline-flex';
    if(exit)  exit.style.display  = inVr ? 'inline-flex' : 'inline-flex';

    // ถ้าไม่ได้อยู่ VR จริง ปุ่ม exit ซ่อนไว้
    if(exit && !inVr) exit.style.display = 'none';
  }

  function wireVrState(){
    const s = getScene();

    if(s && !s.__hhaVrStateWired){
      s.__hhaVrStateWired = true;

      s.addEventListener('enter-vr', ()=>{
        setVrButtons(true);
        dispatchVrModeChange({
          inVr: true,
          native: true,
          reason: 'scene-enter-event',
          view: isCvrView(currentView()) ? currentView() : 'vr'
        });
      }, {passive:true});

      s.addEventListener('exit-vr', ()=>{
        setVrButtons(false);
        dispatchVrModeChange({
          inVr: false,
          native: true,
          reason: 'scene-exit-event',
          view: currentView() || 'mobile'
        });
      }, {passive:true});
    }

    if(!WIN.__HHA_VRUI_FS_WIRED__){
      WIN.__HHA_VRUI_FS_WIRED__ = true;

      DOC.addEventListener('fullscreenchange', ()=>{
        if(!DOC.fullscreenElement && STATE.fallbackVr){
          // ยังถือว่าอยู่ fallback VR อยู่ จนกว่าจะกด EXIT VR
          setVrButtons(true);
        }else{
          setVrButtons(isInVrMode());
        }
      }, {passive:true});
    }
  }

  // ---- shooting ----
  function emitShoot(x,y, source){
    const t = now();
    if(t - STATE.lastShotAt < CFG.cooldownMs) return;
    STATE.lastShotAt = t;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{
          x: Number(x),
          y: Number(y),
          lockPx: CFG.lockPx,
          cooldownMs: CFG.cooldownMs,
          source: source || 'tap',
          view: isCvrView(currentView()) || STATE.fallbackVr ? 'cvr' : 'screen'
        }
      }));
    }catch{}
  }

  function centerShoot(source){
    emitShoot(innerWidth / 2, innerHeight / 2, source || 'tap');
  }

  function isUiTarget(el){
    if(!el) return false;

    if(el.closest){
      if(el.closest('#hha-vrui')) return true;
      if(el.closest('#hha-vrui-hint')) return true;
      if(el.closest('.br-btn')) return true;
    }

    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'button' ||
           tag === 'a' ||
           tag === 'input' ||
           tag === 'select' ||
           tag === 'textarea' ||
           tag === 'label';
  }

  function wireTapShoot(){
    if(WIN.__HHA_VRUI_TAP_WIRED__) return;
    WIN.__HHA_VRUI_TAP_WIRED__ = true;

    DOC.addEventListener('pointerdown', (ev)=>{
      if(ev.defaultPrevented) return;
      if(isUiTarget(ev.target)) return;

      if((isCvrView(currentView()) || STATE.fallbackVr) && CFG.cvrStrict){
        centerShoot('tap');
      }else{
        emitShoot(ev.clientX, ev.clientY, 'pointer');
      }
    }, {passive:true});

    DOC.addEventListener('keydown', (ev)=>{
      if(ev.code === 'Space'){
        centerShoot('space');
      }
    }, {passive:true});
  }

  function applyBootView(){
    const v = currentView();
    try{ DOC.documentElement.dataset.view = v || DOC.documentElement.dataset.view || ''; }catch{}
    try{ if(DOC.body) DOC.body.dataset.view = v || DOC.body.dataset.view || ''; }catch{}

    if(isCvrView(v)){
      showHint('Cardboard: แตะจอเพื่อยิงจาก crosshair', 3000);
    }
    refreshCrosshair();
  }

  function init(){
    ensureUI();
    wireVrState();
    wireTapShoot();
    applyBootView();
    setVrButtons(isInVrMode());

    setTimeout(()=>{
      try{
        ensureUI();
        wireVrState();
        refreshCrosshair();
        setVrButtons(isInVrMode());
      }catch{}
    }, 600);

    WIN.HHA_VRUI = {
      enterVR,
      exitVR,
      recenter,
      isInVrMode,
      isNativeVrActive,
      isFallbackVr: ()=> !!STATE.fallbackVr,
      currentView,
    };
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }
})();