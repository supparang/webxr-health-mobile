// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (layout-safe + auto-detect + no surprises)
// ✅ Adds: ENTER VR / EXIT / RECENTER buttons (WebXR via A-Frame if present)
// ✅ Crosshair overlay + tap-to-shoot (mobile/cVR)
// ✅ Emits: hha:shoot { x,y, lockPx, source }
// ✅ view=cvr strict => shoot from center (targets should pointer-events:none in game CSS)
// ✅ Applies body view classes:
//    - if ?view= is present => respect it
//    - else => best-effort auto-detect
// ✅ Exposes CSS var: --hha-vrui-h (px) for game safe-area calculations
//
// Config (optional):
// window.HHA_VRUI_CONFIG = {
//   lockPx: 28,
//   cooldownMs: 90,
//   showRecenter: true,
//   showExit: true,
//   anchor: 'bl' | 'br' | 'tl' | 'tr',   // default 'bl' (bottom-left)
//   autoApplyView: true                   // default true
// }

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
    showExit: true,
    anchor: 'bl',
    autoApplyView: true
  }, WIN.HHA_VRUI_CONFIG || {});

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  // ---------- view detection ----------
  function detectViewAuto(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    // Heuristic:
    // - Touch portrait => mobile
    // - Touch landscape wide => cVR-ish usage (split-screen) => cvr
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function resolveView(){
    const explicit = String(qs('view','')).toLowerCase().trim();
    if (explicit) return explicit; // respect ?view=
    return detectViewAuto();
  }

  function applyViewClasses(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','cardboard');

    // map:
    // pc/mobile/cvr/vr/cardboard
    if (view === 'mobile') b.classList.add('view-mobile');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'vr') b.classList.add('view-vr');
    else if (view === 'cardboard') b.classList.add('cardboard');
    else b.classList.add('view-pc');
  }

  if (CFG.autoApplyView){
    applyViewClasses(resolveView());
  }

  // ---------- DOM UI ----------
  function ensureStyle(){
    if (DOC.getElementById('hha-vrui-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-vrui-style';
    style.textContent = `
      :root{
        --hha-vrui-h: 0px;
      }

      .hha-vrui{
        position:fixed;
        z-index: 210;
        display:flex;
        gap:10px;
        align-items:center;
        pointer-events:none;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
        padding: 0;
      }

      /* ✅ Default anchor = bottom-left (กันชน topbar/HUD) */
      .hha-vrui[data-anchor="bl"]{
        left:  calc(10px + env(safe-area-inset-left, 0px));
        bottom:calc(10px + env(safe-area-inset-bottom, 0px));
      }
      .hha-vrui[data-anchor="br"]{
        right: calc(10px + env(safe-area-inset-right, 0px));
        bottom:calc(10px + env(safe-area-inset-bottom, 0px));
      }
      .hha-vrui[data-anchor="tl"]{
        left: calc(10px + env(safe-area-inset-left, 0px));
        top:  calc(10px + env(safe-area-inset-top, 0px));
      }
      .hha-vrui[data-anchor="tr"]{
        right:calc(10px + env(safe-area-inset-right, 0px));
        top:  calc(10px + env(safe-area-inset-top, 0px));
      }

      /* ✅ Mobile: ให้ปุ่ม “เรียงขึ้นบรรทัดใหม่” ได้ กันชนเวลายาว */
      @media (max-width: 520px){
        .hha-vrui{ flex-wrap: wrap; max-width: calc(100vw - 20px); }
      }

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

      /* Crosshair */
      .hha-crosshair{
        position:fixed;
        left:50%; top:50%;
        transform: translate(-50%,-50%);
        z-index: 120;
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
  }

  function ensureRoot(){
    ensureStyle();

    let root = DOC.querySelector('.hha-vrui');
    if (root) return root;

    root = DOC.createElement('div');
    root.className = 'hha-vrui';
    root.id = 'hhaVrUi';
    root.setAttribute('data-anchor', String(CFG.anchor||'bl'));
    DOC.body.appendChild(root);

    // crosshair
    let ch = DOC.querySelector('.hha-crosshair');
    if (!ch){
      ch = DOC.createElement('div');
      ch.className = 'hha-crosshair';
      DOC.body.appendChild(ch);
    }

    // expose height to CSS var for safe-area usage
    const setH = ()=>{
      try{
        const r = root.getBoundingClientRect();
        DOC.documentElement.style.setProperty('--hha-vrui-h', Math.max(0, Math.ceil(r.height||0)) + 'px');
      }catch(_){}
    };
    setTimeout(setH, 0);
    setTimeout(setH, 120);
    setTimeout(setH, 320);

    try{
      const ro = new ResizeObserver(()=>setH());
      ro.observe(root);
    }catch(_){
      WIN.addEventListener('resize', setH, { passive:true });
      WIN.addEventListener('orientationchange', setH, { passive:true });
    }

    emit('hha:vrui:ready', { ts: Date.now(), anchor: root.getAttribute('data-anchor') });
    return root;
  }

  function hasAFrameScene(){
    try{ return !!DOC.querySelector('a-scene'); }catch(_){ return false; }
  }

  function tryEnterVR(){
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
    emit('hha:recenter', { ts: Date.now() });
    // best-effort: zero roll/pitch (do not fight user's yaw)
    try{
      const cam = DOC.querySelector('[camera]');
      if (cam && cam.object3D && cam.object3D.rotation){
        cam.object3D.rotation.x = 0;
        cam.object3D.rotation.z = 0;
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
    const b = DOC.body;
    if (!b) return;

    const viewIsCVR = b.classList.contains('view-cvr');
    const isTouch = ev.pointerType === 'touch' || ev.type === 'touchstart';
    const src = viewIsCVR ? 'cvr' : (isTouch ? 'touch' : 'mouse');

    // Only shoot-from-center in cVR strict
    if (viewIsCVR){
      try{ ev.preventDefault(); }catch(_){}
      fire(src);
    }
  }

  DOC.addEventListener('pointerdown', onPointerDown, { passive:false });

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
    if (!tryEnterVR()){
      // fallback: fullscreen (optional)
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

  // ENTER VR only meaningful when a-scene exists
  if (hasAFrameScene()) root.appendChild(btnEnter);

  if (CFG.showExit) root.appendChild(btnExit);
  if (CFG.showRecenter) root.appendChild(btnRecenter);

  // ---------- keep view in sync (auto only; still respects explicit ?view=) ----------
  function onResize(){
    if (!CFG.autoApplyView) return;

    // if explicit view exists => keep it
    const explicit = String(qs('view','')).toLowerCase().trim();
    const v = explicit || detectViewAuto();
    applyViewClasses(v);
  }
  WIN.addEventListener('resize', ()=>{ try{ onResize(); }catch(_){ } }, { passive:true });
  WIN.addEventListener('orientationchange', ()=>{ try{ onResize(); }catch(_){ } }, { passive:true });

})();