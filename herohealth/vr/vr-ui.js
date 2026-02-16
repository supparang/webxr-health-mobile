// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — HeroHealth (HHA Standard) — PRODUCTION v20260215a
// ✅ Works with A-Frame (a-scene.enterVR/exitVR) but won't crash if absent
// ✅ Provides: ENTER VR / EXIT / RECENTER buttons (floating)
// ✅ Adds crosshair (for view=cvr / cardboard / fallback)
// ✅ Tap-to-shoot / click-to-shoot emits: window.dispatchEvent('hha:shoot', {x,y,lockPx})
// ✅ Aim assist: uses lockPx from config; cooldownMs prevents spam
//
// Config:
//   window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90, showCrosshairInPC: false }
//
// URL params:
//   view=cvr  -> forces crosshair + tap-to-shoot from screen center
//   view=pc|mobile|vr (optional)
//
// Notes:
// - This module does NOT depend on other HHA modules.
// - Games should listen to 'hha:shoot' and decide hit/miss.
//
// Security/Safety:
// - No network calls, no storage required.

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  // ---------- config ----------
  const CFG0 = WIN.HHA_VRUI_CONFIG || {};
  const CFG = {
    lockPx: Number(CFG0.lockPx ?? 28) || 28,
    cooldownMs: Number(CFG0.cooldownMs ?? 90) || 90,
    showCrosshairInPC: !!CFG0.showCrosshairInPC
  };

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  const VIEW = String(qs('view','')||'').toLowerCase(); // cvr, vr, pc, mobile
  const FORCE_CVR = (VIEW === 'cvr');

  // ---------- helpers ----------
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function emitShoot(x,y){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail: { x, y, lockPx: CFG.lockPx }
      }));
    }catch{}
  }

  function safeNow(){
    return (performance && performance.now) ? performance.now() : Date.now();
  }

  function findScene(){
    try{ return DOC.querySelector('a-scene'); }catch{ return null; }
  }

  function inVR(){
    const sc = findScene();
    // A-Frame: scene.is('vr-mode') or sc.is('vr-mode') when in VR
    try{
      if(sc && typeof sc.is === 'function') return !!sc.is('vr-mode');
    }catch{}
    // fallback via fullscreen-ish flag (not perfect)
    return false;
  }

  // ---------- style injection ----------
  function injectCSS(){
    if(DOC.getElementById('hha-vrui-css')) return;
    const s = DOC.createElement('style');
    s.id = 'hha-vrui-css';
    s.textContent = `
      :root{
        --hha-vrui-z: 9999;
        --hha-vrui-bg: rgba(2,6,23,.62);
        --hha-vrui-stroke: rgba(148,163,184,.22);
        --hha-vrui-text: rgba(229,231,235,.95);
        --hha-vrui-muted: rgba(148,163,184,.92);
        --hha-vrui-pill: 999px;
        --hha-vrui-radius: 18px;
        --hha-sat: env(safe-area-inset-top, 0px);
        --hha-sar: env(safe-area-inset-right, 0px);
        --hha-sab: env(safe-area-inset-bottom, 0px);
        --hha-sal: env(safe-area-inset-left, 0px);
      }

      .hha-vrui-wrap{
        position: fixed;
        left: 10px;
        bottom: calc(10px + var(--hha-sab));
        z-index: var(--hha-vrui-z);
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        pointer-events: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .hha-vrui-btn{
        pointer-events: auto;
        appearance: none;
        border: 1px solid var(--hha-vrui-stroke);
        background: var(--hha-vrui-bg);
        color: var(--hha-vrui-text);
        border-radius: var(--hha-vrui-pill);
        padding: 10px 12px;
        font: 1000 12px/1 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        box-shadow: 0 16px 40px rgba(0,0,0,.28);
        backdrop-filter: blur(10px);
        cursor: pointer;
      }
      .hha-vrui-btn:active{ transform: translateY(1px); }
      .hha-vrui-btn.small{ padding: 8px 10px; font-size: 11px; }
      .hha-vrui-btn.primary{
        border-color: rgba(34,197,94,.30);
        background: rgba(34,197,94,.14);
      }
      .hha-vrui-btn.warn{
        border-color: rgba(245,158,11,.32);
        background: rgba(245,158,11,.14);
      }

      .hha-crosshair{
        position: fixed;
        left: 50%;
        top: 50%;
        width: 20px;
        height: 20px;
        transform: translate(-50%, -50%);
        z-index: var(--hha-vrui-z);
        pointer-events: none;
        opacity: 0.95;
        display: none;
      }
      .hha-crosshair::before, .hha-crosshair::after{
        content:'';
        position:absolute;
        left:50%;
        top:50%;
        width: 2px;
        height: 2px;
        background: rgba(229,231,235,.95);
        border-radius: 999px;
        transform: translate(-50%,-50%);
        box-shadow: 0 0 0 2px rgba(229,231,235,.14), 0 0 18px rgba(34,197,94,.12);
      }
      .hha-crosshair .ring{
        position:absolute;
        left:50%; top:50%;
        width: 20px; height: 20px;
        transform: translate(-50%,-50%);
        border-radius: 999px;
        border: 1px solid rgba(229,231,235,.22);
        box-shadow: 0 0 0 2px rgba(2,6,23,.35);
        opacity: .85;
      }

      .hha-vrui-hint{
        position: fixed;
        right: 10px;
        top: calc(10px + var(--hha-sat));
        z-index: var(--hha-vrui-z);
        pointer-events: none;
        font: 900 12px/1.2 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        color: var(--hha-vrui-muted);
        background: rgba(2,6,23,.38);
        border: 1px solid rgba(148,163,184,.14);
        border-radius: 999px;
        padding: 8px 10px;
        backdrop-filter: blur(10px);
        display: none;
      }

      /* view-cvr strict: prevent accidental pointer capture on targets (optional)
         Games may use this by setting body[data-view="cvr"] and targets pointer-events toggles */
      body[data-view="cvr"] .hha-crosshair{ display: block; }
    `;
    DOC.head.appendChild(s);
  }

  // ---------- UI creation ----------
  function makeUI(){
    injectCSS();

    const wrap = DOC.createElement('div');
    wrap.className = 'hha-vrui-wrap';
    wrap.id = 'hha-vrui-wrap';

    const btnEnter = DOC.createElement('button');
    btnEnter.className = 'hha-vrui-btn primary';
    btnEnter.type = 'button';
    btnEnter.textContent = '🕶 ENTER VR';

    const btnExit = DOC.createElement('button');
    btnExit.className = 'hha-vrui-btn';
    btnExit.type = 'button';
    btnExit.textContent = '⏏ EXIT';

    const btnRecenter = DOC.createElement('button');
    btnRecenter.className = 'hha-vrui-btn warn';
    btnRecenter.type = 'button';
    btnRecenter.textContent = '🎯 RECENTER';

    wrap.appendChild(btnEnter);
    wrap.appendChild(btnExit);
    wrap.appendChild(btnRecenter);

    const cross = DOC.createElement('div');
    cross.className = 'hha-crosshair';
    cross.id = 'hha-crosshair';
    const ring = DOC.createElement('div');
    ring.className = 'ring';
    cross.appendChild(ring);

    const hint = DOC.createElement('div');
    hint.className = 'hha-vrui-hint';
    hint.id = 'hha-vrui-hint';
    hint.textContent = 'Tap/Click = ยิงจาก crosshair';

    DOC.body.appendChild(wrap);
    DOC.body.appendChild(cross);
    DOC.body.appendChild(hint);

    return { wrap, btnEnter, btnExit, btnRecenter, cross, hint };
  }

  // ---------- VR actions ----------
  function enterVR(){
    const sc = findScene();
    try{
      if(sc && typeof sc.enterVR === 'function') sc.enterVR();
    }catch{}
  }
  function exitVR(){
    const sc = findScene();
    try{
      if(sc && typeof sc.exitVR === 'function') sc.exitVR();
    }catch{}
  }
  function recenter(){
    // best-effort: emit an event games can listen to
    try{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'vr-ui' } }));
    }catch{}
    // A-Frame look-controls reset often uses "look-controls" component; safest is just emit.
  }

  // ---------- shooting ----------
  let cooldownUntil = 0;
  function canShoot(){
    const t = safeNow();
    if(t < cooldownUntil) return false;
    cooldownUntil = t + CFG.cooldownMs;
    return true;
  }

  function shootFromCenter(){
    if(!canShoot()) return;
    const x = innerWidth/2;
    const y = innerHeight/2;
    emitShoot(x,y);
  }

  function shootFromPointer(ev){
    if(!canShoot()) return;
    // pointer coords
    const x = Number(ev?.clientX);
    const y = Number(ev?.clientY);
    if(Number.isFinite(x) && Number.isFinite(y)){
      emitShoot(x,y);
      return;
    }
    shootFromCenter();
  }

  // ---------- mode decisions ----------
  function shouldShowCrosshair(){
    // show for cVR always
    if(FORCE_CVR) return true;
    // show if in VR (scene says vr-mode)
    if(inVR()) return true;
    // optionally in PC for debugging
    return !!CFG.showCrosshairInPC;
  }

  function applyViewMarkers(){
    if(FORCE_CVR){
      try{ DOC.body.dataset.view = 'cvr'; }catch{}
      try{ DOC.documentElement.dataset.view = 'cvr'; }catch{}
    }
  }

  // ---------- bootstrap ----------
  function init(){
    applyViewMarkers();
    const ui = makeUI();

    function refresh(){
      const show = shouldShowCrosshair();
      ui.cross.style.display = show ? 'block' : 'none';
      ui.hint.style.display = show ? 'block' : 'none';

      // ENTER/EXIT toggle
      const vr = inVR();
      ui.btnEnter.style.display = vr ? 'none' : '';
      ui.btnExit.style.display = vr ? '' : 'none';
    }

    ui.btnEnter.addEventListener('click', (e)=>{ e.preventDefault(); enterVR(); }, { passive:false });
    ui.btnExit.addEventListener('click', (e)=>{ e.preventDefault(); exitVR(); }, { passive:false });
    ui.btnRecenter.addEventListener('click', (e)=>{ e.preventDefault(); recenter(); }, { passive:false });

    // Tap/click to shoot:
    // - cVR: always shoot from center (crosshair)
    // - VR: also shoot from center (safer for gaze/crosshair)
    // - PC/mobile: shoot from pointer position
    DOC.addEventListener('pointerdown', (ev)=>{
      // prevent shooting if interacting with UI buttons
      const t = ev.target;
      if(t && t.closest && t.closest('#hha-vrui-wrap')) return;

      // If user is typing/selecting, ignore
      if(ev.button != null && ev.button !== 0) return;

      if(FORCE_CVR || inVR()) shootFromCenter();
      else shootFromPointer(ev);
    }, { passive:true });

    // Keyboard fallback (space)
    DOC.addEventListener('keydown', (ev)=>{
      if(ev.code === 'Space'){
        ev.preventDefault();
        shootFromCenter();
      }
    }, { passive:false });

    // Keep refreshing (VR mode changes)
    refresh();
    setInterval(refresh, 350);

    // Expose tiny api
    WIN.HHA_VRUI = {
      config: CFG,
      enterVR,
      exitVR,
      recenter,
      shootCenter: shootFromCenter
    };
  }

  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') init();
  else DOC.addEventListener('DOMContentLoaded', init, { once:true });

})();