// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (HHA Standard)
// ✅ Adds: ENTER VR / EXIT / RECENTER buttons (WebXR via A-Frame scene if present)
// ✅ Adds: Crosshair overlay + Tap-to-shoot (mobile/cVR)
// ✅ Emits: window.dispatchEvent('hha:shoot', {x,y,lockPx,source})
// ✅ Supports view=cvr strict (always shoot from screen center)
// ✅ Anti-spam cooldown + pointer lock-friendly
// ✅ Dynamic aim-assist: reacts to hha:boss events (boss on / phase2 / rage) -> lockPx adjusts
//
// Config (optional):
// window.HHA_VRUI_CONFIG = {
//   lockPx: 28,          // base lock radius (px)
//   lockPxMin: 18,
//   lockPxMax: 52,
//   cooldownMs: 95,
//   showCrosshair: true,
//   showButtons: true,
//   allowTapShoot: true,
//   recenterMethod: 'aframe' | 'device' | 'none'
// };

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  if(WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  const CFG = Object.assign({
    lockPx: 28,
    lockPxMin: 18,
    lockPxMax: 52,
    cooldownMs: 95,
    showCrosshair: true,
    showButtons: true,
    allowTapShoot: true,
    recenterMethod: 'aframe' // safest default (A-Frame scene exists in your pages)
  }, WIN.HHA_VRUI_CONFIG || {});

  function getView(){
    const v = String(qs('view', '') || '').toLowerCase();
    if(v) return v;
    // auto fallback:
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    if(!isTouch) return 'pc';
    // user may still want mobile:
    return 'mobile';
  }

  const VIEW = getView();
  const IS_CVR = (VIEW === 'cvr');
  const IS_VR  = (VIEW === 'vr');

  // ---------- dynamic aim assist (Boss / Phase2 / Rage) ----------
  // We adjust lock radius only (engine decides nearest target).
  // - Normal: base lockPx
  // - Boss P1: +6
  // - Boss P2: +10 (harder, but give slightly more assist so it's "โหดแต่แฟร์")
  // - Rage: +6 extra
  // - If user hides HUD or screen small, we still keep within min/max.
  let bossState = { on:false, phase:0, rage:false };

  function computeLockPx(){
    let lp = Number(CFG.lockPx) || 28;

    if(bossState.on){
      lp += (bossState.phase === 2) ? 10 : 6;
      if(bossState.rage) lp += 6;
    }

    // Slightly reduce assist for PC (mouse is precise)
    if(VIEW === 'pc') lp = Math.max(CFG.lockPxMin, lp - 6);

    // On very small screens, allow a bit more assist (kids-friendly)
    const w = Math.max(1, DOC.documentElement.clientWidth || 1);
    if(w < 380) lp += 4;

    return clamp(Math.round(lp), CFG.lockPxMin, CFG.lockPxMax);
  }

  function onBossEvent(ev){
    const d = ev?.detail || {};
    bossState.on = !!d.on;
    bossState.phase = Number(d.phase || 0) || 0;
    bossState.rage = !!d.rage;
    // optionally mark body for CSS (if your css wants it)
    try{
      DOC.body.classList.toggle('hha-boss-on', bossState.on);
      DOC.body.classList.toggle('hha-boss-p2', bossState.on && bossState.phase===2);
      DOC.body.classList.toggle('hha-rage-on', !!bossState.rage);
    }catch(_){}
  }
  WIN.addEventListener('hha:boss', onBossEvent, { passive:true });
  DOC.addEventListener('hha:boss', onBossEvent, { passive:true });

  // ---------- UI elements ----------
  function ensureRoot(){
    let root = DOC.getElementById('hhaVruRoot');
    if(root) return root;

    root = DOC.createElement('div');
    root.id = 'hhaVruRoot';
    root.style.cssText = `
      position:fixed; inset:0;
      z-index:190;
      pointer-events:none;
      font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
    `;
    DOC.body.appendChild(root);
    return root;
  }

  function ensureStyle(){
    if(DOC.getElementById('hhaVruStyle')) return;

    const style = DOC.createElement('style');
    style.id = 'hhaVruStyle';
    style.textContent = `
      .hha-vru-btns{
        position:fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        display:flex; gap:8px; flex-wrap:wrap;
        z-index:195;
        pointer-events:auto;
      }
      .hha-vru-btn{
        height:44px;
        padding:0 12px;
        border-radius: 14px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.60);
        color:#e5e7eb;
        font-weight: 900;
        font-size: 13px;
        cursor:pointer;
        backdrop-filter: blur(10px);
        box-shadow: 0 10px 28px rgba(0,0,0,.35);
      }
      .hha-vru-btn.primary{
        border-color: rgba(34,197,94,.35);
        background: rgba(34,197,94,.14);
        color:#eafff3;
      }

      .hha-crosshair{
        position:fixed;
        left:50%; top:50%;
        transform: translate(-50%, -50%);
        width: 18px; height: 18px;
        border-radius:999px;
        border: 2px solid rgba(255,255,255,.85);
        box-shadow: 0 0 0 4px rgba(34,211,238,.10);
        opacity: .95;
        z-index:194;
        pointer-events:none;
      }
      .hha-crosshair::after{
        content:"";
        position:absolute;
        left:50%; top:50%;
        transform: translate(-50%, -50%);
        width: 4px; height: 4px;
        border-radius:999px;
        background: rgba(255,255,255,.95);
      }
      .hha-crosshair.pulse{
        animation: hhaCrossPulse 120ms ease both;
      }
      @keyframes hhaCrossPulse{
        0%{ transform: translate(-50%,-50%) scale(1); opacity:.95; }
        60%{ transform: translate(-50%,-50%) scale(1.18); opacity:1; }
        100%{ transform: translate(-50%,-50%) scale(1); opacity:.95; }
      }

      /* subtle assist cue during boss P2 */
      body.hha-boss-p2 .hha-crosshair{
        box-shadow: 0 0 0 6px rgba(239,68,68,.10);
      }

      /* user can hide crosshair via ?cross=0 */
      body.hha-hide-cross .hha-crosshair{ display:none !important; }
    `;
    DOC.head.appendChild(style);
  }

  function ensureButtons(){
    if(!CFG.showButtons) return null;

    let wrap = DOC.querySelector('.hha-vru-btns');
    if(wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'hha-vru-btns';

    const btnEnter = DOC.createElement('button');
    btnEnter.className = 'hha-vru-btn primary';
    btnEnter.type = 'button';
    btnEnter.textContent = 'ENTER VR';

    const btnExit = DOC.createElement('button');
    btnExit.className = 'hha-vru-btn';
    btnExit.type = 'button';
    btnExit.textContent = 'EXIT VR';

    const btnRecenter = DOC.createElement('button');
    btnRecenter.className = 'hha-vru-btn';
    btnRecenter.type = 'button';
    btnRecenter.textContent = 'RECENTER';

    wrap.appendChild(btnEnter);
    wrap.appendChild(btnExit);
    wrap.appendChild(btnRecenter);

    DOC.body.appendChild(wrap);

    // Wire
    btnEnter.addEventListener('click', ()=> enterVr(), { passive:true });
    btnExit.addEventListener('click', ()=> exitVr(), { passive:true });
    btnRecenter.addEventListener('click', ()=> recenter(), { passive:true });

    return wrap;
  }

  function ensureCrosshair(){
    if(!CFG.showCrosshair) return null;
    if(qs('cross','1') === '0') {
      try{ DOC.body.classList.add('hha-hide-cross'); }catch(_){}
      return null;
    }

    let ch = DOC.querySelector('.hha-crosshair');
    if(ch) return ch;

    ch = DOC.createElement('div');
    ch.className = 'hha-crosshair';
    DOC.body.appendChild(ch);
    return ch;
  }

  // ---------- WebXR / A-Frame helpers ----------
  function findAFrameScene(){
    try{
      const sc = DOC.querySelector('a-scene');
      return sc || null;
    }catch(_){ return null; }
  }

  function enterVr(){
    // Most reliable: A-Frame scene enterVR()
    const sc = findAFrameScene();
    try{
      if(sc && typeof sc.enterVR === 'function'){
        sc.enterVR();
        return;
      }
    }catch(_){}

    // fallback: WebXR direct (best-effort)
    try{
      const xr = navigator.xr;
      if(xr && xr.requestSession){
        xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor','bounded-floor','hand-tracking'] })
          .then(()=>{})
          .catch(()=>{});
      }
    }catch(_){}
  }

  function exitVr(){
    const sc = findAFrameScene();
    try{
      if(sc && typeof sc.exitVR === 'function'){
        sc.exitVR();
        return;
      }
    }catch(_){}

    try{
      const s = (sc && sc.xrSession) ? sc.xrSession : null;
      if(s && typeof s.end === 'function') s.end();
    }catch(_){}
  }

  function recenter(){
    const method = String(CFG.recenterMethod || 'aframe').toLowerCase();
    if(method === 'none') return;

    // A-Frame: try scene.emit('recenter') or camera look-controls reset
    const sc = findAFrameScene();
    if(method === 'aframe'){
      try{
        if(sc && typeof sc.emit === 'function') sc.emit('recenter');
      }catch(_){}
      // try common A-Frame controls reset patterns
      try{
        const cam = sc ? sc.querySelector('[camera]') : null;
        const lc = cam ? cam.components && cam.components['look-controls'] : null;
        if(lc && typeof lc.reset === 'function') lc.reset();
      }catch(_){}
      return;
    }

    // device orientation reset (best-effort)
    if(method === 'device'){
      try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'vr-ui' } })); }catch(_){}
    }
  }

  // ---------- Shooting (tap/click -> hha:shoot) ----------
  let lastShotAt = 0;
  const crosshair = ensureCrosshair();

  function pulseCrosshair(){
    if(!crosshair) return;
    try{
      crosshair.classList.remove('pulse');
      // restart
      void crosshair.offsetHeight;
      crosshair.classList.add('pulse');
    }catch(_){}
  }

  function emitShoot(source='tap'){
    const t = now();
    const cd = Math.max(30, Number(CFG.cooldownMs)||90);
    if(t - lastShotAt < cd) return;
    lastShotAt = t;

    const cx = Math.floor(DOC.documentElement.clientWidth / 2);
    const cy = Math.floor(DOC.documentElement.clientHeight / 2);

    const lockPx = computeLockPx();

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ x:cx, y:cy, lockPx, source } }));
    }catch(_){}
    try{
      DOC.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ x:cx, y:cy, lockPx, source } }));
    }catch(_){}

    pulseCrosshair();
  }

  function shouldEnableTapShoot(){
    if(!CFG.allowTapShoot) return false;
    // We generally want tap-to-shoot on touch devices, especially cVR
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    if(IS_CVR || IS_VR) return true;
    if(VIEW === 'mobile') return isTouch;
    return false;
  }

  // Aiming rules:
  // - view=cvr strict -> always shoot from center screen.
  // - If user taps anywhere, we still fire from center (same as your engine expects).
  const tapShootEnabled = shouldEnableTapShoot();

  function onPointerDown(ev){
    // allow UI buttons to work normally
    const t = ev?.target;
    if(t && (t.closest && t.closest('.hha-vru-btns'))) return;

    // If user is dragging/scrolling: ignore multi-touch / long-press
    try{
      if(ev && ev.isPrimary === false) return;
    }catch(_){}

    emitShoot(IS_CVR ? 'cvr' : (IS_VR ? 'vr' : 'tap'));
  }

  // Keyboard shoot for PC (space)
  function onKeyDown(ev){
    const k = String(ev?.key || '').toLowerCase();
    if(k === ' ' || k === 'spacebar' || k === 'enter'){
      emitShoot('key');
    }
  }

  // Bind inputs
  if(tapShootEnabled){
    // Use capture=true to get tap even if target elements exist, but we don't preventDefault to avoid breaking UI.
    DOC.addEventListener('pointerdown', onPointerDown, { passive:true, capture:true });
  }
  DOC.addEventListener('keydown', onKeyDown, { passive:true });

  // Buttons + style
  ensureStyle();
  ensureRoot();
  ensureButtons();

  // Show/hide buttons by view:
  // - PC: can keep buttons but not necessary
  // - Mobile/cVR/VR: keep
  try{
    if(VIEW === 'pc'){
      // leave buttons on; some people still want ENTER VR in PC browser
    }
  }catch(_){}

  // Optional: expose debug
  WIN.__HHA_VRUI__ = {
    view: VIEW,
    isCVR: IS_CVR,
    isVR: IS_VR,
    computeLockPx
  };
})();