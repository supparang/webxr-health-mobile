// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — AUTO-DETECT ONLY (NO OVERRIDE)
// ✅ ENTER VR / EXIT / RECENTER (A-Frame reliable)
// ✅ Crosshair + tap-to-shoot => emits hha:shoot {x,y,lockPx,source}
// ✅ Auto detect: pc / mobile / cardboard / cvr
// ✅ NO override: ignores ?view= and ignores external config objects
//
// Notes:
// - For WebXR "ENTER VR" to appear reliably, A-Frame must already be loaded on page.
// - Games can listen to `window.addEventListener('hha:shoot', ...)`
// - For cVR strict, game should set pointer-events:none on targets layer (as you do).

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  // -------------------- Hard settings (NO OVERRIDE) --------------------
  const CFG = {
    lockPx: 28,         // default lock radius for aim-assist consumers (games can adapt themselves too)
    cooldownMs: 90,     // shoot cooldown
    tapCooldownMs: 90,
    recenterCooldownMs: 350,
    debug: false
  };

  const qs = (s)=>DOC.querySelector(s);
  const qsa = (s)=>Array.from(DOC.querySelectorAll(s));

  function log(...a){
    if (CFG.debug) console.log('[vr-ui]', ...a);
  }

  // -------------------- Device heuristics --------------------
  function isTouch(){
    try{ return ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0; }
    catch(_){ return false; }
  }
  function isMobileUA(){
    try{
      const ua = navigator.userAgent || '';
      return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    }catch(_){ return false; }
  }
  function isStandaloneLike(){
    try{
      // PWA / iOS standalone
      // eslint-disable-next-line no-undef
      return (WIN.matchMedia && WIN.matchMedia('(display-mode: standalone)').matches) || (navigator.standalone === true);
    }catch(_){ return false; }
  }
  function hasGyro(){
    return 'DeviceOrientationEvent' in WIN;
  }
  function webXRCapable(){
    try{
      return !!(navigator.xr && typeof navigator.xr.isSessionSupported === 'function');
    }catch(_){ return false; }
  }

  // -------------------- View auto-detect --------------------
  // Priority:
  // 1) If already in A-Frame VR session => 'vr'
  // 2) If mobile + fullscreen + gyro + touch => 'cvr' (cardboard-like strict)
  // 3) If mobile/touch => 'mobile'
  // 4) else => 'pc'
  //
  // Cardboard split-screen (L/R) is GAME responsibility (your hydration page still supports it),
  // but vr-ui will mark body.cardboard when it sees split playfield OR explicit VR hint exists.
  function detectView(){
    const b = DOC.body;

    // Already in WebXR (A-Frame toggles states/events)
    if (b && b.classList.contains('in-xr')) return 'vr';

    const touch = isTouch();
    const mob = isMobileUA();

    // If page contains a cardboard split playfield, mark as cardboard-capable.
    const hasSplit = !!DOC.getElementById('cbPlayfield') || !!DOC.querySelector('.cbHalf');
    if (hasSplit) b.classList.add('cardboard-capable');

    const fs = !!DOC.fullscreenElement;
    const gyro = hasGyro();

    // cVR heuristic: mobile touch + fullscreen (often requested) OR "cardboard-capable" + gyro
    if (mob && touch && (fs || (gyro && hasSplit) || isStandaloneLike())) return 'cvr';

    if (mob || touch) return 'mobile';
    return 'pc';
  }

  function applyBodyClasses(view){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
    if (view === 'vr') b.classList.add('view-vr');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');

    // If hydration (or others) uses cardboard split UI, keep its own `body.cardboard` logic.
    // vr-ui will not force cardboard mode; only hints.
  }

  // initial
  let VIEW = detectView();
  applyBodyClasses(VIEW);

  // update view on fullscreen change / orientation change
  function refreshViewSoon(){
    setTimeout(()=>{
      const v2 = detectView();
      if (v2 !== VIEW){
        VIEW = v2;
        applyBodyClasses(VIEW);
        log('view ->', VIEW);
      }
    }, 80);
  }
  DOC.addEventListener('fullscreenchange', refreshViewSoon);
  WIN.addEventListener('orientationchange', refreshViewSoon);

  // -------------------- Crosshair overlay --------------------
  function ensureCrosshair(){
    let el = DOC.querySelector('.hha-crosshair');
    if (el) return el;

    const stId='hha-vrui-style';
    if (!DOC.getElementById(stId)){
      const st = DOC.createElement('style');
      st.id = stId;
      st.textContent = `
      .hha-crosshair{
        position:fixed;
        left:50%; top:50%;
        transform:translate(-50%,-50%);
        width:22px; height:22px;
        z-index:96;
        pointer-events:none;
        opacity:.92;
        filter: drop-shadow(0 6px 18px rgba(0,0,0,.55));
        display:none;
      }
      .hha-crosshair::before,.hha-crosshair::after{
        content:"";
        position:absolute;
        left:50%; top:50%;
        transform:translate(-50%,-50%);
        border-radius:999px;
      }
      .hha-crosshair::before{
        width:18px; height:18px;
        border:2px solid rgba(229,231,235,.85);
      }
      .hha-crosshair::after{
        width:4px; height:4px;
        background:rgba(34,211,238,.95);
      }
      body.view-cvr .hha-crosshair{ display:block; }
      body.view-vr  .hha-crosshair{ display:none; }

      /* VR UI buttons */
      .hha-vrui{
        position:fixed;
        z-index:97;
        top: calc(10px + env(safe-area-inset-top, 0px));
        left: calc(10px + env(safe-area-inset-left, 0px));
        display:flex;
        gap:8px;
        pointer-events:auto;
        user-select:none;
      }
      .hha-btn{
        appearance:none;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.62);
        color:rgba(229,231,235,.92);
        padding:8px 10px;
        border-radius:14px;
        font: 900 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
        cursor:pointer;
        backdrop-filter: blur(10px);
        box-shadow: 0 14px 55px rgba(0,0,0,.42);
      }
      .hha-btn:active{ transform: translateY(1px); }
      .hha-btn.primary{
        border-color: rgba(34,197,94,.26);
        background: rgba(34,197,94,.14);
      }
      .hha-btn.warn{
        border-color: rgba(245,158,11,.26);
        background: rgba(245,158,11,.14);
      }
      .hha-btn[hidden]{ display:none !important; }

      /* Avoid HUD blocking these */
      .hha-vrui, .hha-btn { pointer-events:auto; }
      `;
      DOC.head.appendChild(st);
    }

    el = DOC.createElement('div');
    el.className = 'hha-crosshair';
    DOC.body.appendChild(el);
    return el;
  }

  // -------------------- A-Frame hooks for VR enter/exit/recenter --------------------
  function aframeScene(){
    // Any a-scene on page
    return DOC.querySelector('a-scene');
  }

  function inAFrameVR(){
    const sc = aframeScene();
    if (!sc) return false;
    try{ return !!sc.is('vr-mode'); }catch(_){ return false; }
  }

  async function enterVR(){
    const sc = aframeScene();
    if (!sc) return false;
    try{
      // A-Frame supports enterVR()
      if (typeof sc.enterVR === 'function'){ sc.enterVR(); return true; }
    }catch(_){}
    return false;
  }

  async function exitVR(){
    const sc = aframeScene();
    if (!sc) return false;
    try{
      if (typeof sc.exitVR === 'function'){ sc.exitVR(); return true; }
    }catch(_){}
    return false;
  }

  function recenter(){
    // For A-Frame, common approach: emit "recenter" or reset camera rig
    // We'll emit a global event for games to implement their own recenter.
    try{ WIN.dispatchEvent(new CustomEvent('hha:recenter')); }catch(_){}
  }

  // Mark body.in-xr based on A-Frame events (best-effort)
  function bindAFrameState(){
    const sc = aframeScene();
    if (!sc) return;

    sc.addEventListener('enter-vr', ()=>{
      DOC.body.classList.add('in-xr');
      refreshViewSoon();
    });
    sc.addEventListener('exit-vr', ()=>{
      DOC.body.classList.remove('in-xr');
      refreshViewSoon();
    });
  }

  // -------------------- UI Buttons --------------------
  function ensureButtons(){
    let wrap = DOC.querySelector('.hha-vrui');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'hha-vrui';

    const btnEnter = DOC.createElement('button');
    btnEnter.className = 'hha-btn primary';
    btnEnter.type = 'button';
    btnEnter.textContent = 'ENTER VR';

    const btnExit = DOC.createElement('button');
    btnExit.className = 'hha-btn';
    btnExit.type = 'button';
    btnExit.textContent = 'EXIT';

    const btnRecenter = DOC.createElement('button');
    btnRecenter.className = 'hha-btn';
    btnRecenter.type = 'button';
    btnRecenter.textContent = 'RECENTER';

    wrap.appendChild(btnEnter);
    wrap.appendChild(btnExit);
    wrap.appendChild(btnRecenter);
    DOC.body.appendChild(wrap);

    let lastRecenterAt = 0;

    btnEnter.addEventListener('click', async ()=>{
      // user gesture
      await enterVR();
      refreshViewSoon();
    });

    btnExit.addEventListener('click', async ()=>{
      await exitVR();
      refreshViewSoon();
    });

    btnRecenter.addEventListener('click', ()=>{
      const now = performance.now();
      if (now - lastRecenterAt < CFG.recenterCooldownMs) return;
      lastRecenterAt = now;
      recenter();
    });

    function syncBtn(){
      const canVR = !!aframeScene();
      const isVR = inAFrameVR();

      // Show enter if scene exists and not in VR
      btnEnter.hidden = !(canVR && !isVR);
      btnExit.hidden  = !(canVR && isVR);

      // Recenter is useful in both, but keep it if VR capable
      btnRecenter.hidden = !canVR;
    }

    syncBtn();
    setInterval(syncBtn, 500);

    return wrap;
  }

  // -------------------- Shoot emit --------------------
  let lastShotAt = 0;

  function emitShoot(source){
    const now = performance.now();
    if (now - lastShotAt < CFG.cooldownMs) return;
    lastShotAt = now;

    // Center point in viewport
    const x = WIN.innerWidth / 2;
    const y = WIN.innerHeight / 2;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail: { x, y, lockPx: CFG.lockPx, source: source || 'tap' }
      }));
    }catch(_){}
  }

  function bindTapShoot(){
    // Tap-to-shoot only meaningful in cVR/mobile, but safe to bind; it won't hurt on PC.
    // We avoid interfering with buttons/inputs.
    DOC.addEventListener('pointerdown', (ev)=>{
      // ignore UI button taps
      const t = ev.target;
      if (!t) return;
      if (t.closest && t.closest('.hha-vrui')) return;
      if (t.tagName === 'BUTTON' || t.tagName === 'A' || t.closest('button,a,input,textarea,select')) return;

      // In PC, let gameplay handle pointerdown on targets normally.
      // In cVR, we want tap-to-shoot (crosshair).
      if (DOC.body.classList.contains('view-cvr')){
        emitShoot('tap');
      }
    }, {passive:true});
  }

  // Also allow spacebar/enter to shoot (PC testing)
  function bindKeyShoot(){
    DOC.addEventListener('keydown', (ev)=>{
      const k = (ev.key || '').toLowerCase();
      if (k === ' ' || k === 'enter'){
        // Only for testing; in real PC you still click targets.
        if (DOC.body.classList.contains('view-cvr')){
          emitShoot('key');
          ev.preventDefault();
        }
      }
    });
  }

  // -------------------- Boot --------------------
  function boot(){
    ensureCrosshair();
    ensureButtons();
    bindTapShoot();
    bindKeyShoot();
    bindAFrameState();

    // On load, keep checking view if A-Frame enters XR later or fullscreen changes
    setTimeout(refreshViewSoon, 200);
    setTimeout(refreshViewSoon, 800);
  }

  boot();
})();