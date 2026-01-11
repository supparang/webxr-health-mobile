// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (auto-detect + no-override)
// ✅ Adds: ENTER VR / EXIT / RECENTER buttons (WebXR via A-Frame if present)
// ✅ Crosshair overlay + tap-to-shoot (mobile/cVR)
// ✅ Emits: hha:shoot { x,y, lockPx, source }
// ✅ view=cvr strict => pointer-events disabled on targets is recommended (game-side)
// ✅ Auto-detect device/orientation (best-effort) WITHOUT overriding explicit ?view=
// ✅ Safe to include via <script defer src="../vr/vr-ui.js"></script>
//
// Config (optional):
// window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90, showRecenter:true, showExit:true }
//
// Notes:
// - For A-Frame reliability, include aframe.min.js in the page (like your other games do).
// - If A-Frame isn't present, ENTER VR will be hidden gracefully.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({
    lockPx: 28,
    cooldownMs: 90,
    showRecenter: true,
    showExit: true
  }, WIN.HHA_VRUI_CONFIG || {});

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------- view detection (NO OVERRIDE) ----------
  // If user provided ?view=..., we respect it and do nothing.
  // Otherwise we best-effort apply body classes:
  // view-pc | view-mobile | view-cvr
  function detectView(){
    const explicit = String(qs('view','')).toLowerCase();
    if (explicit) return explicit; // do NOT override

    // auto rules
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // Heuristic:
    // - Mobile portrait/landscape => view-mobile
    // - If touch + landscape + wide screen => likely cVR usage => view-cvr
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function applyViewClasses(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    if (view === 'mobile') b.classList.add('view-mobile');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'cardboard') b.classList.add('cardboard');
    else b.classList.add('view-pc');
  }

  // Apply view only if not explicit ?view=
  const initialView = detectView();
  if (!String(qs('view','')).toLowerCase()){
    applyViewClasses(initialView);
  }

  // ---------- DOM UI ----------
  function ensureRoot(){
    let root = DOC.querySelector('.hha-vrui');
    if (root) return root;

    root = DOC.createElement('div');
    root.className = 'hha-vrui';
    root.style.cssText = `
      position:fixed;
      left: calc(10px + env(safe-area-inset-left, 0px));
      top:  calc(10px + env(safe-area-inset-top, 0px));
      z-index: 110;
      display:flex;
      gap:10px;
      align-items:center;
      pointer-events:none;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
    `;

    const style = DOC.createElement('style');
    style.textContent = `
      .hha-vrui .btn{
        pointer-events:auto;
        appearance:none;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.62);
        color: rgba(229,231,235,.96);
        padding: 10px 12px;
        border-radius: 14px;
        font-weight: 900;
        font-size: 12.5px;
        cursor: pointer;
        user-select:none;
        backdrop-filter: blur(10px);
        box-shadow: 0 16px 50px rgba(0,0,0,.35);
      }
      .hha-vrui .btn:active{ transform: translateY(1px); }
      .hha-vrui .btn.primary{
        border-color: rgba(34,197,94,.28);
        background: rgba(34,197,94,.16);
      }
      .hha-vrui .btn.cyan{
        border-color: rgba(34,211,238,.28);
        background: rgba(34,211,238,.14);
      }
      .hha-vrui .btn.warn{
        border-color: rgba(245,158,11,.30);
        background: rgba(245,158,11,.14);
      }
      .hha-crosshair{
        position:fixed;
        left:50%; top:50%;
        transform: translate(-50%,-50%);
        z-index: 95;
        pointer-events:none;
        width: 22px; height: 22px;
        opacity: .92;
        filter: drop-shadow(0 6px 18px rgba(0,0,0,.55));
        display:none;
      }
      .hha-crosshair::before,.hha-crosshair::after{
        content:"";
        position:absolute; left:50%; top:50%;
        transform: translate(-50%,-50%);
        border-radius: 999px;
      }
      .hha-crosshair::before{
        width:18px; height:18px;
        border:2px solid rgba(229,231,235,.85);
      }
      .hha-crosshair::after{
        width:4px; height:4px;
        background: rgba(34,211,238,.95);
      }
      body.view-cvr .hha-crosshair{ display:block; }
    `;
    DOC.head.appendChild(style);
    DOC.body.appendChild(root);

    // crosshair
    let ch = DOC.querySelector('.hha-crosshair');
    if (!ch){
      ch = DOC.createElement('div');
      ch.className = 'hha-crosshair';
      DOC.body.appendChild(ch);
    }

    return root;
  }

  function hasAFrameScene(){
    try{
      // typical aframe scene selector
      return !!DOC.querySelector('a-scene');
    }catch(_){ return false; }
  }

  function tryEnterVR(){
    // A-Frame provides enterVR() on sceneEl or sceneEl.enterVR()
    try{
      const scene = DOC.querySelector('a-scene');
      if (scene && typeof scene.enterVR === 'function'){
        scene.enterVR();
        return true;
      }
    }catch(_){}
    return false;
  }

  function tryExitVR(){
    try{
      const scene = DOC.querySelector('a-scene');
      if (scene && typeof scene.exitVR === 'function'){
        scene.exitVR();
        return true;
      }
    }catch(_){}
    return false;
  }

  function recenter(){
    // generic recenter event; games can listen
    emit('hha:recenter', { ts: Date.now() });

    // also try A-Frame camera recenter (best-effort)
    try{
      const cam = DOC.querySelector('[camera]');
      if (cam && cam.object3D){
        cam.object3D.rotation.set(0, cam.object3D.rotation.y, 0);
      }
    }catch(_){}
  }

  // ---------- Tap-to-shoot / click-to-shoot ----------
  let lastShotAt = 0;
  function fire(source='tap'){
    const t = performance.now();
    if (t - lastShotAt < Math.max(40, CFG.cooldownMs|0)) return;
    lastShotAt = t;

    const x = (WIN.innerWidth||0)/2;
    const y = (WIN.innerHeight||0)/2;
    emit('hha:shoot', { x, y, lockPx: CFG.lockPx|0, source });
  }

  function onPointerDown(ev){
    // In view-cvr we shoot from center screen, not from pointer pos
    const b = DOC.body;
    if (!b) return;

    const viewIsCVR = b.classList.contains('view-cvr');
    const isTouch = ev.pointerType === 'touch' || ev.type === 'touchstart';
    const src = viewIsCVR ? 'cvr' : (isTouch ? 'touch' : 'mouse');

    // If not cVR: let game handle pointer hits (targets pointer-events)
    // BUT we still provide optional shooting for cVR.
    if (viewIsCVR){
      try{ ev.preventDefault(); }catch(_){}
      fire(src);
    }
  }

  // For mobile/cVR: attach listeners
  DOC.addEventListener('pointerdown', onPointerDown, { passive:false });

  // Also allow keyboard space to shoot in cVR (handy for testing)
  WIN.addEventListener('keydown', (e)=>{
    if (e.code === 'Space'){
      if (DOC.body && DOC.body.classList.contains('view-cvr')){
        fire('key');
      }
    }
  });

  // ---------- Build UI buttons ----------
  const root = ensureRoot();

  const btnEnter = DOC.createElement('button');
  btnEnter.className = 'btn primary';
  btnEnter.textContent = 'ENTER VR';
  btnEnter.addEventListener('click', ()=>{
    // If A-Frame scene exists, try entering VR
    if (!tryEnterVR()){
      // fallback: attempt fullscreen
      try{
        const el = DOC.documentElement;
        if (!DOC.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI:'hide' });
      }catch(_){}
    }
  });

  const btnExit = DOC.createElement('button');
  btnExit.className = 'btn warn';
  btnExit.textContent = 'EXIT';
  btnExit.addEventListener('click', ()=>{
    if (!tryExitVR()){
      try{ if (DOC.fullscreenElement && DOC.exitFullscreen) DOC.exitFullscreen(); }catch(_){}
    }
  });

  const btnRecenter = DOC.createElement('button');
  btnRecenter.className = 'btn cyan';
  btnRecenter.textContent = 'RECENTER';
  btnRecenter.addEventListener('click', ()=> recenter());

  // show/hide based on context
  const showEnter = hasAFrameScene(); // ENTER VR meaningful when scene exists
  if (showEnter) root.appendChild(btnEnter);

  if (CFG.showExit) root.appendChild(btnExit);
  if (CFG.showRecenter) root.appendChild(btnRecenter);

  // Hide ENTER if no aframe scene
  if (!showEnter){
    // keep only exit/recenter
  }

  // ---------- keep view in sync (auto only, still no override) ----------
  function onResize(){
    // only auto-apply if no explicit ?view=
    if (String(qs('view','')).toLowerCase()) return;
    const v = detectView();
    applyViewClasses(v);
  }
  WIN.addEventListener('resize', ()=>{ try{ onResize(); }catch(_){ } }, { passive:true });
  WIN.addEventListener('orientationchange', ()=>{ try{ onResize(); }catch(_){ } }, { passive:true });

})();