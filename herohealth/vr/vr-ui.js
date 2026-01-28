// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (PACK 12: view=cvr strict)
// ✅ ENTER VR / EXIT / RECENTER buttons
// ✅ Crosshair overlay
// ✅ Tap-to-shoot => emits hha:shoot {x,y,lockPx,source,view}
// ✅ view=cvr strict: ignores tap coordinates, always shoots from screen center
// ✅ Does NOT override ?view= (only reads it)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  // ---- config ----
  const CFG = Object.assign(
    { lockPx: 28, cooldownMs: 90, crosshairSize: 34 },
    WIN.HHA_VRUI_CONFIG || {}
  );

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch{ return Date.now(); } };

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function getView(){
    const v = String(qs('view','')||'').toLowerCase();
    if (v) return v;              // DO NOT override explicit view
    // best-effort: mobile vs pc only (no forced vr/cvr)
    const coarse = WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches;
    const small  = Math.min(WIN.innerWidth||360, WIN.innerHeight||640) <= 520;
    return (coarse || small) ? 'mobile' : 'pc';
  }

  const VIEW = getView();
  const STRICT_CVR = (VIEW === 'cvr');

  // ---- mount root ----
  function ensureRoot(){
    let root = DOC.getElementById('hha-vrui-root');
    if (root) return root;

    root = DOC.createElement('div');
    root.id = 'hha-vrui-root';
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.right = '0';
    root.style.bottom = '0';
    root.style.zIndex = '180';
    root.style.pointerEvents = 'none'; // children will enable pointerEvents
    DOC.body.appendChild(root);
    return root;
  }

  // ---- styles ----
  function injectCss(){
    if (DOC.getElementById('hha-vrui-css')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vrui-css';
    st.textContent = `
      #hha-vrui-root{ font-family: system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif; }
      .hha-vrui-btns{
        position: fixed;
        top: calc(env(safe-area-inset-top, 0px) + 10px);
        right: calc(env(safe-area-inset-right, 0px) + 10px);
        display:flex; gap:8px; z-index: 190;
        pointer-events: auto;
      }
      .hha-vrui-btn{
        appearance:none; border:1px solid rgba(148,163,184,.24);
        background: rgba(2,6,23,.55);
        color: rgba(229,231,235,.92);
        border-radius: 999px;
        padding: 8px 10px;
        font-weight: 900;
        font-size: 12px;
        backdrop-filter: blur(10px);
        cursor: pointer;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
      }
      .hha-vrui-btn:active{ transform: translateY(1px); }

      .hha-crosshair{
        position: fixed; left: 50%; top: 50%;
        width: ${clamp(CFG.crosshairSize, 20, 60)}px;
        height:${clamp(CFG.crosshairSize, 20, 60)}px;
        transform: translate(-50%,-50%);
        z-index: 185;
        pointer-events:none;
        opacity: .95;
        filter: drop-shadow(0 6px 18px rgba(0,0,0,.55));
      }
      .hha-crosshair::before, .hha-crosshair::after{
        content:'';
        position:absolute; left:50%; top:50%;
        background: rgba(229,231,235,.92);
        border-radius: 999px;
        transform: translate(-50%,-50%);
      }
      .hha-crosshair::before{ width: 2px; height: 100%; }
      .hha-crosshair::after{ width: 100%; height: 2px; }

      .hha-crosshair-dot{
        position:absolute; left:50%; top:50%;
        width: 6px; height:6px;
        transform: translate(-50%,-50%);
        background: rgba(34,197,94,.95);
        border-radius: 999px;
      }

      /* PACK 12: view=cvr strict hint */
      body.view-cvr .hha-crosshair-dot{ background: rgba(245,158,11,.95); }
    `;
    DOC.head.appendChild(st);
  }

  // ---- buttons ----
  function makeBtn(text, onClick){
    const b = DOC.createElement('button');
    b.type = 'button';
    b.className = 'hha-vrui-btn';
    b.textContent = text;
    b.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); onClick && onClick(e); });
    return b;
  }

  function findScene(){
    try{ return DOC.querySelector('a-scene'); }catch{ return null; }
  }

  function ensureUI(){
    const root = ensureRoot();
    injectCss();

    // buttons
    let bar = DOC.getElementById('hha-vrui-btns');
    if (!bar){
      bar = DOC.createElement('div');
      bar.id = 'hha-vrui-btns';
      bar.className = 'hha-vrui-btns';

      const btnEnter = makeBtn('ENTER VR', ()=>{
        const scene = findScene();
        try{ scene && scene.enterVR && scene.enterVR(); }catch{}
      });

      const btnExit = makeBtn('EXIT', ()=>{
        const scene = findScene();
        try{ scene && scene.exitVR && scene.exitVR(); }catch{}
      });

      const btnRecenter = makeBtn('RECENTER', ()=>{
        // emit (engine can listen)
        try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ view: VIEW } })); }catch{}
        // best-effort: A-Frame reset (optional)
        try{
          const cam = DOC.querySelector('a-camera');
          cam && cam.emit && cam.emit('recenter');
        }catch{}
      });

      bar.appendChild(btnEnter);
      bar.appendChild(btnExit);
      bar.appendChild(btnRecenter);
      root.appendChild(bar);
    }

    // crosshair
    let ch = DOC.getElementById('hha-crosshair');
    if (!ch){
      ch = DOC.createElement('div');
      ch.id = 'hha-crosshair';
      ch.className = 'hha-crosshair';
      const dot = DOC.createElement('div');
      dot.className = 'hha-crosshair-dot';
      ch.appendChild(dot);
      root.appendChild(ch);
    }

    // set body class (does NOT override query param; only reflects it)
    try{
      const b = DOC.body;
      if (b){
        b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
        b.classList.add('view-' + (VIEW || 'mobile'));
      }
    }catch{}

    // announce mode
    try{
      WIN.dispatchEvent(new CustomEvent('hha:vrui:mode', {
        detail:{ view: VIEW, strictCVR: STRICT_CVR, lockPx: CFG.lockPx }
      }));
    }catch{}
  }

  // ---- tap-to-shoot ----
  let lastShootAt = 0;

  function isClickOnVRUI(ev){
    try{
      const t = ev && ev.target;
      if (!t) return false;
      return !!(t.closest && t.closest('#hha-vrui-root'));
    }catch{ return false; }
  }

  function emitShoot(source, x, y){
    const t = nowMs();
    if ((t - lastShootAt) < clamp(CFG.cooldownMs, 30, 240)) return;
    lastShootAt = t;

    const cx = Math.round(x);
    const cy = Math.round(y);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{
          x: cx,
          y: cy,
          lockPx: clamp(CFG.lockPx, 10, 140),
          source: String(source||'tap'),
          view: VIEW,
          strictCVR: STRICT_CVR
        }
      }));
    }catch{}
  }

  function onPointerDown(ev){
    if (!ev) return;
    if (isClickOnVRUI(ev)) return;

    // do not block scrolling on mobile pages by default; only handle tap
    let x = 0, y = 0;

    if (STRICT_CVR){
      // PACK 12: strict center shoot
      x = (WIN.innerWidth||0) / 2;
      y = (WIN.innerHeight||0) / 2;
      emitShoot('cvr_center', x, y);
      return;
    }

    // normal: shoot at tap point
    if (ev.touches && ev.touches[0]){
      x = ev.touches[0].clientX;
      y = ev.touches[0].clientY;
    } else {
      x = ev.clientX;
      y = ev.clientY;
    }
    emitShoot('tap', x, y);
  }

  // ---- init ----
  ensureUI();

  // Listen on document (capture) so targets don't steal events
  try{ DOC.addEventListener('pointerdown', onPointerDown, { passive:true, capture:true }); }catch{}
  try{ DOC.addEventListener('touchstart', onPointerDown, { passive:true, capture:true }); }catch{}

})();