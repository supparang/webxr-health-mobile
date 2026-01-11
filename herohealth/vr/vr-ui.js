// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION
// ✅ ENTER VR / EXIT / RECENTER (best-effort)
// ✅ Crosshair overlay (optional) + tap-to-shoot
// ✅ Emits: hha:shoot { x, y, lockPx, source }
// ✅ Supports view=cvr strict (shoot from center screen)
// ✅ Works with DOM games (Hydration/GoodJunk/Plate/Groups) and A-Frame (if present)
//
// Config (optional):
// window.HHA_VRUI_CONFIG = {
//   lockPx: 28,         // aim assist lock radius hint (px)
//   cooldownMs: 90,     // shot cooldown
//   autoCrosshair: true,// auto inject crosshair if none
//   showButtons: true,  // show enter/exit/recenter buttons
//   preferView: 'cvr',  // for DOM games: enterVR will switch to this view if no WebXR scene
// };

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
    autoCrosshair: true,
    showButtons: true,
    preferView: 'cvr'
  }, WIN.HHA_VRUI_CONFIG || {});

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function getView(){
    const v = String(qs('view','')).toLowerCase();
    // we also respect body classes if view param not present
    const b = DOC.body;
    if (v) return v;
    if (b.classList.contains('view-cvr')) return 'cvr';
    if (b.classList.contains('cardboard')) return 'cardboard';
    if (b.classList.contains('view-mobile')) return 'mobile';
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','cardboard','view-cvr');
    if (view === 'mobile') b.classList.add('view-mobile');
    else if (view === 'cardboard') b.classList.add('cardboard');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-pc');
    emit('hha:view', { view });
  }

  async function enterFull(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' });
      }
    }catch(_){}
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  async function exitFull(){
    try{
      if (DOC.fullscreenElement && DOC.exitFullscreen){
        await DOC.exitFullscreen();
      }
    }catch(_){}
    try{
      if (screen.orientation && screen.orientation.unlock){
        screen.orientation.unlock();
      }
    }catch(_){}
  }

  // --- A-Frame / WebXR (optional) ---
  function getAFrameScene(){
    try{
      const scene = DOC.querySelector('a-scene');
      if (scene && scene.isScene) return scene;
    }catch(_){}
    return null;
  }

  async function enterVR(){
    await enterFull();

    const scene = getAFrameScene();
    if (scene && typeof scene.enterVR === 'function'){
      try{ scene.enterVR(); }catch(_){}
      return;
    }

    // DOM-game fallback: switch to preferView (default cvr)
    const v = String(CFG.preferView || 'cvr').toLowerCase();
    setBodyView(v);
  }

  async function exitVR(){
    const scene = getAFrameScene();
    if (scene && typeof scene.exitVR === 'function'){
      try{ scene.exitVR(); }catch(_){}
    }
    // DOM fallback: back to pc
    setBodyView('pc');
    await exitFull();
  }

  function recenter(){
    // A-Frame scene recenter (best-effort)
    const scene = getAFrameScene();
    if (scene){
      try{
        // Some setups expose scene.xrSession or renderer.xr
        // We keep this generic and also emit an event for your engine to handle.
      }catch(_){}
    }
    emit('hha:recenter', { at: Date.now(), view: getView() });
  }

  // --- Crosshair overlay ---
  function ensureCrosshair(){
    if (!CFG.autoCrosshair) return null;

    // If your page already has .crosshair (Hydration HTML has one), don’t duplicate.
    let ch = DOC.querySelector('.crosshair');
    if (ch) return ch;

    ch = DOC.createElement('div');
    ch.className = 'crosshair';
    ch.setAttribute('aria-hidden','true');
    DOC.body.appendChild(ch);

    // inject minimal style if not already present
    if (!DOC.getElementById('hha-vrui-crosshair-style')){
      const st = DOC.createElement('style');
      st.id = 'hha-vrui-crosshair-style';
      st.textContent = `
      .crosshair{
        position:fixed; left:50%; top:50%;
        transform:translate(-50%,-50%);
        z-index:95; pointer-events:none;
        width:22px; height:22px;
        opacity:.92;
        filter: drop-shadow(0 6px 18px rgba(0,0,0,.55));
        display:none;
      }
      .crosshair::before,.crosshair::after{
        content:""; position:absolute; left:50%; top:50%;
        transform:translate(-50%,-50%); border-radius:999px;
      }
      .crosshair::before{ width:18px; height:18px; border:2px solid rgba(229,231,235,.85); }
      .crosshair::after{ width:4px; height:4px; background:rgba(34,211,238,.95); }
      body.view-cvr .crosshair{ display:block; }
      `;
      DOC.head.appendChild(st);
    }
    return ch;
  }

  // --- Tap-to-shoot (strict cVR) ---
  const SHOOT = { lastAt: 0 };

  function centerPoint(){
    const r = DOC.documentElement.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2 };
  }

  function shootFromCenter(source){
    const now = performance.now();
    if (now - SHOOT.lastAt < clamp(CFG.cooldownMs, 40, 260)) return;
    SHOOT.lastAt = now;

    const c = centerPoint();
    emit('hha:shoot', {
      x: c.x,
      y: c.y,
      lockPx: clamp(CFG.lockPx, 10, 160),
      source: source || 'tap'
    });
  }

  function onPointerDown(ev){
    // Only strict-shoot when in view=cvr
    if (getView() !== 'cvr') return;

    // ignore clicks on UI buttons
    const t = ev.target;
    if (t && t.closest && t.closest('.hha-vrui')) return;

    // Allow pages to block shooting by setting data-no-shoot
    if (t && t.closest && t.closest('[data-no-shoot="1"]')) return;

    shootFromCenter('tap');
  }

  function onKeyDown(ev){
    // Space / Enter -> shoot for convenience
    if (getView() !== 'cvr') return;
    if (ev.code === 'Space' || ev.code === 'Enter'){
      shootFromCenter('key');
    }
  }

  // --- UI Buttons ---
  function ensureButtons(){
    if (!CFG.showButtons) return null;
    if (DOC.querySelector('.hha-vrui')) return DOC.querySelector('.hha-vrui');

    const wrap = DOC.createElement('div');
    wrap.className = 'hha-vrui';
    wrap.innerHTML = `
      <div class="hha-vrui-row" data-no-shoot="1">
        <button class="hha-vrui-btn" data-act="enter" type="button">ENTER VR</button>
        <button class="hha-vrui-btn" data-act="exit"  type="button">EXIT</button>
        <button class="hha-vrui-btn" data-act="recenter" type="button">RECENTER</button>
      </div>
    `;
    DOC.body.appendChild(wrap);

    if (!DOC.getElementById('hha-vrui-style')){
      const st = DOC.createElement('style');
      st.id = 'hha-vrui-style';
      st.textContent = `
      .hha-vrui{
        position:fixed;
        top: calc(10px + env(safe-area-inset-top, 0px));
        left: calc(10px + env(safe-area-inset-left, 0px));
        z-index: 110;
        pointer-events:none;
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
      }
      .hha-vrui-row{
        display:flex;
        gap:8px;
        pointer-events:auto;
      }
      .hha-vrui-btn{
        appearance:none;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.55);
        color: rgba(229,231,235,.95);
        font-weight:900;
        font-size:12px;
        padding:8px 10px;
        border-radius: 14px;
        cursor:pointer;
        user-select:none;
        backdrop-filter: blur(10px);
        box-shadow: 0 14px 45px rgba(0,0,0,.35);
      }
      .hha-vrui-btn:active{ transform: translateY(1px); }
      /* If your HUD needs space at top-left, you can hide these in PC view */
      body.view-pc .hha-vrui{ opacity:.95; }
      `;
      DOC.head.appendChild(st);
    }

    wrap.addEventListener('click', async (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-act]') : null;
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();

      const act = btn.getAttribute('data-act');
      if (act === 'enter') await enterVR();
      if (act === 'exit') await exitVR();
      if (act === 'recenter') recenter();
    }, { passive:false });

    return wrap;
  }

  // --- init ---
  try{ ensureButtons(); }catch(_){}
  try{ ensureCrosshair(); }catch(_){}

  DOC.addEventListener('pointerdown', onPointerDown, { passive:false });
  DOC.addEventListener('keydown', onKeyDown, { passive:true });

  // keep button visibility consistent on fullscreen changes
  DOC.addEventListener('fullscreenchange', ()=>{
    emit('hha:fullscreen', { on: !!DOC.fullscreenElement });
  });

  // allow external: force view switch without reload
  WIN.addEventListener('hha:set_view', (ev)=>{
    const v = String(ev?.detail?.view || '').toLowerCase();
    if (!v) return;
    setBodyView(v);
  });

})();