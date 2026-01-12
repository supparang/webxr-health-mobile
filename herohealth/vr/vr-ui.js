// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (AUTO DETECT, NO OVERRIDE)
// ✅ Adds: ENTER VR / EXIT / RECENTER buttons (A-Frame/WebXR best-effort)
// ✅ Adds: Crosshair overlay + tap-to-shoot => emits hha:shoot {x,y,lockPx,source}
// ✅ AUTO: determines view from URL (?view=...), device hints, and XR availability (best-effort)
// ✅ IMPORTANT: does NOT change or override user's view param. It only adapts UI behavior.
// ✅ Supports view=cvr strict: shoot from center screen (crosshair), no target pointer needed.
// Config:
//   window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90, showCrosshairOnMobile: false }

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign(
    { lockPx: 28, cooldownMs: 90, showCrosshairOnMobile: false },
    WIN.HHA_VRUI_CONFIG || {}
  );

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const emit = (name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ----------------- Detect view (do NOT override) -----------------
  function getView(){
    const v = String(qs('view','') || '').toLowerCase().trim();
    if (v) return v; // respect param if provided
    // best-effort fallback when no param:
    // - if on mobile: 'mobile'
    // - else: 'pc'
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    return isMobile ? 'mobile' : 'pc';
  }

  const VIEW = getView();
  const IS_CVR = (VIEW === 'cvr' || VIEW === 'view-cvr');
  const IS_MOBILE = (VIEW === 'mobile' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''));

  // ----------------- DOM + style -----------------
  function ensureStyle(){
    if (DOC.getElementById('hha-vrui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      .hha-vrui{
        position:fixed;
        top: calc(10px + env(safe-area-inset-top,0px));
        right: calc(10px + env(safe-area-inset-right,0px));
        z-index: 9999;
        display:flex;
        gap:10px;
        pointer-events:auto;
        user-select:none;
      }
      .hha-vrui button{
        appearance:none;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.64);
        color: rgba(229,231,235,.92);
        padding:10px 12px;
        border-radius: 14px;
        font: 900 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
        cursor:pointer;
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 70px rgba(0,0,0,.38);
      }
      .hha-vrui button:active{ transform: translateY(1px); }
      .hha-vrui .btn-primary{
        border-color: rgba(34,197,94,.28);
        background: rgba(34,197,94,.16);
      }
      .hha-vrui .btn-warn{
        border-color: rgba(245,158,11,.28);
        background: rgba(245,158,11,.14);
      }
      .hha-crosshair{
        position:fixed;
        left:50%; top:50%;
        transform: translate(-50%,-50%);
        z-index: 9500;
        pointer-events:none;
        width:22px; height:22px;
        opacity:.92;
        filter: drop-shadow(0 6px 18px rgba(0,0,0,.55));
        display:none;
      }
      .hha-crosshair::before, .hha-crosshair::after{
        content:"";
        position:absolute; left:50%; top:50%;
        transform: translate(-50%,-50%);
        border-radius:999px;
      }
      .hha-crosshair::before{
        width:18px; height:18px;
        border:2px solid rgba(229,231,235,.85);
      }
      .hha-crosshair::after{
        width:4px; height:4px;
        background: rgba(34,211,238,.95);
      }

      /* tap surface: full screen but pointer-events only for taps (won't block HUD that uses pointer-events:none) */
      .hha-tap-surface{
        position:fixed; inset:0;
        z-index: 9400;
        background: transparent;
        pointer-events:none;
      }
      .hha-tap-surface.on{
        pointer-events:auto;
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUI(){
    ensureStyle();

    let root = DOC.querySelector('.hha-vrui');
    if (!root){
      root = DOC.createElement('div');
      root.className = 'hha-vrui';
      root.innerHTML = `
        <button class="btn-primary" data-act="enter">ENTER VR</button>
        <button data-act="exit">EXIT</button>
        <button class="btn-warn" data-act="recenter">RECENTER</button>
      `;
      DOC.body.appendChild(root);
    }

    let cross = DOC.querySelector('.hha-crosshair');
    if (!cross){
      cross = DOC.createElement('div');
      cross.className = 'hha-crosshair';
      cross.setAttribute('aria-hidden','true');
      DOC.body.appendChild(cross);
    }

    let tap = DOC.querySelector('.hha-tap-surface');
    if (!tap){
      tap = DOC.createElement('div');
      tap.className = 'hha-tap-surface';
      tap.setAttribute('aria-hidden','true');
      DOC.body.appendChild(tap);
    }

    return { root, cross, tap };
  }

  const UI = ensureUI();

  // Show crosshair rules:
  // - Always show on cVR
  // - Optional on mobile if configured
  if (IS_CVR || (IS_MOBILE && !!CFG.showCrosshairOnMobile)){
    UI.cross.style.display = 'block';
  }

  // tap-to-shoot:
  // - enable in cVR always
  // - enable in mobile (if crosshair mobile enabled) OR if game wants it via window.HHA_VRUI_TAP = true
  const TAP_ENABLED = IS_CVR || (!!CFG.showCrosshairOnMobile) || !!WIN.HHA_VRUI_TAP;
  if (TAP_ENABLED) UI.tap.classList.add('on');

  // ----------------- A-Frame / WebXR best-effort actions -----------------
  function findScene(){
    // A-Frame scene tag is <a-scene>, but some games might not use it.
    return DOC.querySelector('a-scene');
  }

  async function enterVR(){
    // Best-effort: A-Frame
    try{
      const sc = findScene();
      if (sc && sc.enterVR) { sc.enterVR(); return; }
    }catch(_){}

    // Best-effort: WebXR direct (only if app already sets up)
    try{
      // no-op if not available
      if (navigator.xr && navigator.xr.requestSession){
        // cannot start a session without a proper XR render loop in app
        // so we only emit hint event for engines that implement it.
        emit('hha:vr:enter', { source:'vr-ui' });
      }
    }catch(_){}
  }

  async function exitVR(){
    try{
      const sc = findScene();
      if (sc && sc.exitVR) { sc.exitVR(); return; }
    }catch(_){}
    try{ emit('hha:vr:exit', { source:'vr-ui' }); }catch(_){}
  }

  function recenter(){
    // Universal recenter event hook (your games can listen if needed)
    emit('hha:recenter', { source:'vr-ui' });

    // If A-Frame has camera rig, some devs set look-controls + reset yaw; we can only hint.
    try{
      const sc = findScene();
      if (sc) sc.emit && sc.emit('recenter');
    }catch(_){}
  }

  // Buttons
  UI.root.addEventListener('click', (ev)=>{
    const btn = ev.target && ev.target.closest && ev.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act === 'enter') enterVR();
    if (act === 'exit') exitVR();
    if (act === 'recenter') recenter();
  });

  // ----------------- Tap / Shoot emission -----------------
  let lastShotAt = 0;

  function shootFromTap(clientX, clientY, src='tap'){
    const now = performance.now();
    if (now - lastShotAt < clamp(CFG.cooldownMs, 30, 400)) return;
    lastShotAt = now;

    const r = DOC.documentElement.getBoundingClientRect();
    const x = clamp(clientX ?? (r.left + r.width/2), r.left, r.left + r.width);
    const y = clamp(clientY ?? (r.top + r.height/2), r.top, r.top + r.height);

    emit('hha:shoot', {
      x, y,
      lockPx: clamp(CFG.lockPx, 10, 140),
      source: src
    });
  }

  // cVR strict: always shoot from center (ignore tap position)
  function shootCenter(src='cvr'){
    const r = DOC.documentElement.getBoundingClientRect();
    shootFromTap(r.left + r.width/2, r.top + r.height/2, src);
  }

  // Tap surface listeners (pointerdown)
  UI.tap.addEventListener('pointerdown', (ev)=>{
    // DO NOT block default scrolling if not needed
    try{ ev.preventDefault(); }catch(_){}
    if (IS_CVR){
      shootCenter('cvr');
    } else {
      shootFromTap(ev.clientX, ev.clientY, 'tap');
    }
  }, { passive:false });

  // Also support keyboard for PC testing
  WIN.addEventListener('keydown', (ev)=>{
    if (ev.key === ' ' || ev.code === 'Space'){
      if (IS_CVR) shootCenter('kb');
      else {
        const r = DOC.documentElement.getBoundingClientRect();
        shootFromTap(r.left + r.width/2, r.top + r.height/2, 'kb');
      }
    }
  });

  // ----------------- XR availability hint (optional UX) -----------------
  // We do NOT change view, but we can disable ENTER VR button if clearly unavailable.
  (async function(){
    const enterBtn = UI.root.querySelector('button[data-act="enter"]');
    if (!enterBtn) return;

    // If A-Frame scene exists, keep enabled (A-Frame handles XR availability internally)
    if (findScene()) return;

    // Otherwise, check WebXR support (best-effort)
    try{
      if (navigator.xr && navigator.xr.isSessionSupported){
        const ok = await navigator.xr.isSessionSupported('immersive-vr');
        if (!ok){
          enterBtn.style.opacity = '.55';
          enterBtn.title = 'WebXR VR not supported on this device/browser';
        }
      } else {
        enterBtn.style.opacity = '.55';
        enterBtn.title = 'WebXR not available';
      }
    }catch(_){}
  })();

})();