// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — SAFE UNIVERSAL
// FULL PATCH v20260316q-VRUI-RECURSION-FIX
// ✅ FIX: remove ensureUI <-> refreshCrosshair recursive loop
// ✅ FIX: compute cvr mode dynamically, not once
// ✅ KEEP: ENTER VR / EXIT VR / RECENTER + crosshair + hha:shoot
// ✅ SAFE: ignore taps on UI/buttons/links/inputs
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__HHA_VRUI_READY__) return;
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

  const CFG0 = WIN.HHA_VRUI_CONFIG || {};
  const CFG = {
    lockPx: clamp(CFG0.lockPx ?? 28, 6, 160),
    cooldownMs: clamp(CFG0.cooldownMs ?? 90, 20, 400),
    showCrosshair: (CFG0.showCrosshair !== false),
    showButtons: (CFG0.showButtons !== false),
    cvrStrict: (CFG0.cvrStrict !== false),
  };

  let ui = null;
  let crosshair = null;
  let hint = null;
  let styleReady = false;
  let tapShootWired = false;
  let vrStateWired = false;
  let modeWatchWired = false;
  let lastShotAt = 0;

  function currentView(){
    const qv = String(qs('view','')).toLowerCase();
    const hv = String(DOC.documentElement?.dataset?.view || '').toLowerCase();
    const bv = String(DOC.body?.dataset?.view || '').toLowerCase();
    return bv || hv || qv || 'mobile';
  }

  function isCvrMode(){
    const view = currentView();
    return (
      view === 'cvr' ||
      view === 'cardboard' ||
      DOC.documentElement.classList.contains('gj-cvr') ||
      DOC.body.classList.contains('gj-cvr') ||
      DOC.documentElement.classList.contains('hha-cvr') ||
      DOC.body.classList.contains('hha-cvr')
    );
  }

  function ensureStyle(){
    if (styleReady && DOC.getElementById('hha-vrui-style')) return;

    if (DOC.getElementById('hha-vrui-style')) {
      styleReady = true;
      return;
    }

    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      #hha-vrui{
        position:fixed;
        left:max(10px, env(safe-area-inset-left, 0px));
        right:max(10px, env(safe-area-inset-right, 0px));
        bottom:max(10px, env(safe-area-inset-bottom, 0px));
        z-index:9997;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
        pointer-events:none;
      }

      #hha-vrui .hha-btn{
        pointer-events:auto;
        appearance:none;
        -webkit-appearance:none;
        border:none;
        border-radius:999px;
        min-height:44px;
        padding:10px 12px;
        background:rgba(2,6,23,.70);
        border:1px solid rgba(148,163,184,.22);
        color:rgba(229,231,235,.96);
        font:1000 12px/1 system-ui,-apple-system,"Noto Sans Thai","Segoe UI",Roboto,sans-serif;
        box-shadow:0 16px 40px rgba(0,0,0,.32);
        backdrop-filter:blur(10px);
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color:transparent;
        touch-action:manipulation;
      }

      #hha-vrui .hha-btn:active{
        transform:translateY(1px);
      }

      #hha-crosshair{
        position:fixed;
        left:50%;
        top:50%;
        width:20px;
        height:20px;
        transform:translate(-50%,-50%);
        z-index:9996;
        pointer-events:none;
        display:none;
        place-items:center;
        opacity:.90;
      }

      #hha-crosshair::before{
        content:'';
        width:18px;
        height:18px;
        border-radius:999px;
        border:2px solid rgba(229,231,235,.62);
        box-shadow:0 0 0 2px rgba(2,6,23,.55);
      }

      #hha-crosshair::after{
        content:'';
        position:absolute;
        width:2px;
        height:2px;
        border-radius:999px;
        background:rgba(229,231,235,.95);
        box-shadow:0 0 0 2px rgba(2,6,23,.55);
      }

      #hha-vrui-hint{
        position:fixed;
        left:max(10px, env(safe-area-inset-left, 0px));
        top:max(10px, env(safe-area-inset-top, 0px));
        z-index:9997;
        pointer-events:none;
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        color:rgba(229,231,235,.92);
        border-radius:999px;
        padding:6px 10px;
        font:1000 12px/1 system-ui,-apple-system,"Noto Sans Thai","Segoe UI",Roboto,sans-serif;
        backdrop-filter:blur(10px);
        display:none;
      }
    `;
    DOC.head.appendChild(st);
    styleReady = true;
  }

  function ensureButtons(){
    if (!CFG.showButtons) return null;
    ensureStyle();

    ui = DOC.getElementById('hha-vrui');
    if (!ui) {
      ui = DOC.createElement('div');
      ui.id = 'hha-vrui';
      DOC.body.appendChild(ui);
    }

    if (!ui.__built) {
      ui.__built = true;
      ui.innerHTML = '';

      const mk = (id, text)=>{
        const b = DOC.createElement('button');
        b.className = 'hha-btn';
        b.id = id;
        b.type = 'button';
        b.textContent = text;
        return b;
      };

      const btnEnter = mk('hhaBtnEnterVR', '🕶 ENTER VR');
      const btnExit  = mk('hhaBtnExitVR', '🚪 EXIT VR');
      const btnRe    = mk('hhaBtnRecenter', '🎯 RECENTER');

      ui.appendChild(btnEnter);
      ui.appendChild(btnExit);
      ui.appendChild(btnRe);

      btnEnter.addEventListener('click', ()=> enterVR(), { passive:true });
      btnExit.addEventListener('click', ()=> exitVR(), { passive:true });
      btnRe.addEventListener('click', ()=> recenter(), { passive:true });
    }

    return ui;
  }

  function ensureCrosshair(){
    if (!CFG.showCrosshair) return null;
    ensureStyle();

    crosshair = DOC.getElementById('hha-crosshair');
    if (!crosshair) {
      crosshair = DOC.createElement('div');
      crosshair.id = 'hha-crosshair';
      DOC.body.appendChild(crosshair);
    }
    return crosshair;
  }

  function ensureHint(){
    ensureStyle();

    hint = DOC.getElementById('hha-vrui-hint');
    if (!hint) {
      hint = DOC.createElement('div');
      hint.id = 'hha-vrui-hint';
      hint.textContent = 'Cardboard: แตะจอเพื่อยิงจาก crosshair';
      DOC.body.appendChild(hint);
    }
    return hint;
  }

  function refreshCrosshair(){
    const el = ensureCrosshair();
    if (!el) return;

    if (isCvrMode()) {
      el.style.display = 'grid';
      el.style.opacity = '0.98';
    } else {
      el.style.display = CFG.showCrosshair ? 'grid' : 'none';
      el.style.opacity = '0.88';
    }
  }

  function refreshHint(){
    const el = ensureHint();
    if (!el) return;

    if (isCvrMode()) {
      el.style.display = 'inline-flex';
      clearTimeout(el.__hideTimer);
      el.__hideTimer = setTimeout(()=>{
        try{ el.style.display = 'none'; }catch{}
      }, 3500);
    } else {
      el.style.display = 'none';
    }
  }

  function setVrButtons(inVr){
    const enter = DOC.getElementById('hhaBtnEnterVR');
    const exit  = DOC.getElementById('hhaBtnExitVR');
    if (enter) enter.style.display = inVr ? 'none' : 'inline-flex';
    if (exit)  exit.style.display  = inVr ? 'inline-flex' : 'none';
  }

  function getScene(){
    try{ return DOC.querySelector('a-scene'); }
    catch{ return null; }
  }

  function enterVR(){
    const s = getScene();
    let handled = false;

    try{
      if (s && typeof s.enterVR === 'function') {
        s.enterVR();
        handled = true;
      }
    }catch{}

    if (!handled) {
      try{
        DOC.documentElement.classList.add('hha-cvr');
        DOC.body.classList.add('hha-cvr');
        DOC.documentElement.dataset.view = 'cvr';
        DOC.body.dataset.view = 'cvr';
      }catch{}

      try{
        WIN.dispatchEvent(new CustomEvent('hha:vrmodechange', {
          detail:{ inVr:true, native:false, reason:'vr-ui-enter', view:'cvr' }
        }));
      }catch{}
    }

    refreshCrosshair();
    refreshHint();
    setVrButtons(isCvrMode());
  }

  function exitVR(){
    const s = getScene();
    let handled = false;

    try{
      if (s && typeof s.exitVR === 'function') {
        s.exitVR();
        handled = true;
      }
    }catch{}

    if (!handled) {
      try{
        DOC.documentElement.classList.remove('hha-cvr');
        DOC.body.classList.remove('hha-cvr');
        DOC.documentElement.dataset.view = 'mobile';
        DOC.body.dataset.view = 'mobile';
      }catch{}

      try{
        WIN.dispatchEvent(new CustomEvent('hha:vrmodechange', {
          detail:{ inVr:false, native:false, reason:'vr-ui-exit', view:'mobile' }
        }));
      }catch{}
    }

    refreshCrosshair();
    refreshHint();
    setVrButtons(isCvrMode());
  }

  function recenter(){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', {
        detail:{ source:'vr-ui' }
      }));
    }catch{}

    try{
      const cam = DOC.querySelector('a-camera');
      const lc = cam && cam.components && cam.components['look-controls'];
      if (lc && typeof lc.reset === 'function') lc.reset();
    }catch{}
  }

  function emitShoot(x, y, source){
    const t = now();
    if (t - lastShotAt < CFG.cooldownMs) return;
    lastShotAt = t;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{
          x:Number(x),
          y:Number(y),
          lockPx:CFG.lockPx,
          cooldownMs:CFG.cooldownMs,
          source:source || 'tap',
          view:isCvrMode() ? 'cvr' : 'screen'
        }
      }));
    }catch{}
  }

  function centerShoot(source){
    emitShoot(WIN.innerWidth / 2, WIN.innerHeight / 2, source || 'tap');
  }

  function isUiTarget(el){
    if (!el) return false;
    if (el.closest && el.closest('#hha-vrui')) return true;
    if (el.closest && el.closest('#gjLocalVrBar')) return true;
    if (el.closest && el.closest('#waitOverlay')) return true;
    if (el.closest && el.closest('#endOverlay')) return true;
    if (el.closest && el.closest('#skipCooldownDialog')) return true;
    if (el.closest && el.closest('.br-btn')) return true;

    const tag = String(el.tagName || '').toLowerCase();
    return (
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      tag === 'label'
    );
  }

  function wireTapShoot(){
    if (tapShootWired) return;
    tapShootWired = true;

    DOC.addEventListener('pointerdown', (ev)=>{
      if (ev.defaultPrevented) return;
      if (isUiTarget(ev.target)) return;

      if (isCvrMode() && CFG.cvrStrict) {
        centerShoot('tap');
      } else {
        emitShoot(ev.clientX, ev.clientY, 'pointer');
      }
    }, { passive:true });

    DOC.addEventListener('keydown', (ev)=>{
      if (ev.code === 'Space') {
        centerShoot('space');
      }
    }, { passive:true });
  }

  function wireVrState(){
    if (vrStateWired) return;
    vrStateWired = true;

    const tryWire = ()=>{
      const s = getScene();
      if (!s || s.__hhaVrStateWired) return;
      s.__hhaVrStateWired = true;

      s.addEventListener('enter-vr', ()=>{
        setVrButtons(true);
        refreshCrosshair();
        refreshHint();
      }, { passive:true });

      s.addEventListener('exit-vr', ()=>{
        setVrButtons(false);
        refreshCrosshair();
        refreshHint();
      }, { passive:true });
    };

    tryWire();
    setTimeout(tryWire, 600);
    setTimeout(tryWire, 1400);
  }

  function wireModeWatch(){
    if (modeWatchWired) return;
    modeWatchWired = true;

    WIN.addEventListener('hha:vrmodechange', ()=>{
      refreshCrosshair();
      refreshHint();
      setVrButtons(isCvrMode());
    }, { passive:true });

    const mo = new MutationObserver(()=>{
      refreshCrosshair();
      setVrButtons(isCvrMode());
    });

    try{
      mo.observe(DOC.documentElement, {
        attributes:true,
        attributeFilter:['class','data-view']
      });
      mo.observe(DOC.body, {
        attributes:true,
        attributeFilter:['class','data-view']
      });
    }catch{}
  }

  function applyCvrStrictFlag(){
    if (!(isCvrMode() && CFG.cvrStrict)) return;
    try{ DOC.documentElement.dataset.view = 'cvr'; }catch{}
    try{ DOC.body.dataset.view = 'cvr'; }catch{}
  }

  function init(){
    ensureStyle();
    ensureButtons();
    ensureCrosshair();
    ensureHint();

    wireTapShoot();
    wireVrState();
    wireModeWatch();
    applyCvrStrictFlag();

    refreshCrosshair();
    refreshHint();
    setVrButtons(isCvrMode());
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();