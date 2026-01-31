// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION PATCHED
// ✅ ENTER VR / EXIT / RECENTER buttons (best effort)
// ✅ Crosshair overlay
// ✅ Tap-to-shoot emits: hha:shoot {x,y,lockPx,source}
// ✅ PATCH: mobile/pc uses touch point (real finger coordinate)
// ✅ cVR strict uses center crosshair (shoot from center)
// Config: window.HHA_VRUI_CONFIG = { lockPx: 92, cooldownMs: 90 }

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const qs = (s)=>DOC.querySelector(s);

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

  function getView(){
    try{
      const v = new URL(location.href).searchParams.get('view');
      return (v||'').toLowerCase();
    }catch(_){ return ''; }
  }

  function isCvrStrict(){
    const v = getView();
    return (v === 'cvr'); // strict center shooting only for cvr
  }

  // ---------------- UI root ----------------
  const root = DOC.createElement('div');
  root.id = 'hha-vrui';
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'pointer-events:none',
    'z-index:9998'
  ].join(';');

  // Crosshair
  const cross = DOC.createElement('div');
  cross.id = 'hha-crosshair';
  cross.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:50%',
    'width:18px',
    'height:18px',
    'transform:translate(-50%,-50%)',
    'border:2px solid rgba(255,255,255,.70)',
    'border-radius:999px',
    'box-shadow:0 0 0 2px rgba(2,6,23,.35)',
    'opacity:.85',
    'pointer-events:none'
  ].join(';');
  root.appendChild(cross);

  // Buttons container
  const btnWrap = DOC.createElement('div');
  btnWrap.style.cssText = [
    'position:absolute',
    'top:calc(env(safe-area-inset-top,0px) + 10px)',
    'right:calc(env(safe-area-inset-right,0px) + 10px)',
    'display:flex',
    'gap:8px',
    'pointer-events:auto',
    'z-index:9999'
  ].join(';');

  function mkBtn(txt){
    const b = DOC.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.style.cssText = [
      'appearance:none',
      'border:1px solid rgba(148,163,184,.22)',
      'background:rgba(2,6,23,.55)',
      'color:rgba(255,255,255,.92)',
      'border-radius:14px',
      'padding:10px 12px',
      'font:800 12px/1.1 system-ui,-apple-system,"Noto Sans Thai",sans-serif',
      'backdrop-filter: blur(10px)',
      'box-shadow:0 10px 30px rgba(0,0,0,.25)',
      'cursor:pointer'
    ].join(';');
    return b;
  }

  const btnEnter = mkBtn('ENTER VR');
  const btnExit  = mkBtn('EXIT');
  const btnRec   = mkBtn('RECENTER');

  btnWrap.appendChild(btnEnter);
  btnWrap.appendChild(btnExit);
  btnWrap.appendChild(btnRec);
  root.appendChild(btnWrap);

  DOC.body.appendChild(root);

  // ---------------- XR hooks (best effort) ----------------
  function getScene(){
    // find a-scene if exists
    return DOC.querySelector('a-scene');
  }

  btnEnter.addEventListener('click', ()=>{
    try{
      const sc = getScene();
      if (sc && sc.enterVR) sc.enterVR();
    }catch(_){}
  });

  btnExit.addEventListener('click', ()=>{
    try{
      const sc = getScene();
      if (sc && sc.exitVR) sc.exitVR();
    }catch(_){}
  });

  btnRec.addEventListener('click', ()=>{
    // best-effort: A-Frame has different recenter methods by device; we just emit an event others can listen
    try{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ t: nowMs() } }));
    }catch(_){}
  });

  // ---------------- Shooting (PATCH CORE) ----------------
  let lastShotAt = 0;

  function emitShoot(x, y, source){
    const t = nowMs();
    if (t - lastShotAt < CFG.cooldownMs) return;
    lastShotAt = t;

    const lockPx = clamp(CFG.lockPx, 10, 220);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{ x, y, lockPx, source: source || 'tap' }
      }));
    }catch(_){}
  }

  function centerXY(){
    // use visualViewport if available (mobile browsers)
    const vv = WIN.visualViewport;
    const w = vv ? vv.width : WIN.innerWidth;
    const h = vv ? vv.height : WIN.innerHeight;
    const ox = vv ? vv.offsetLeft : 0;
    const oy = vv ? vv.offsetTop : 0;
    return { x: ox + w/2, y: oy + h/2 };
  }

  function pointFromEvent(ev){
    // pointer/touch/mouse compatible
    if (!ev) return null;

    // touch
    const te = ev.touches && ev.touches[0];
    const ce = ev.changedTouches && ev.changedTouches[0];
    const t0 = te || ce;
    if (t0 && typeof t0.clientX === 'number'){
      return { x: t0.clientX, y: t0.clientY };
    }

    // pointer/mouse
    if (typeof ev.clientX === 'number'){
      return { x: ev.clientX, y: ev.clientY };
    }
    return null;
  }

  function shouldIgnoreTarget(ev){
    // ignore clicks on UI buttons
    const t = ev && ev.target;
    if (!t) return false;
    if (t === btnEnter || t === btnExit || t === btnRec) return true;
    if (t.closest && t.closest('#hha-vrui')) {
      // if inside vrui and is button area
      if (t.closest('button')) return true;
    }
    return false;
  }

  function onShootInput(ev){
    if (shouldIgnoreTarget(ev)) return;

    // cVR strict: always shoot from center (crosshair)
    if (isCvrStrict()){
      const c = centerXY();
      emitShoot(c.x, c.y, 'cvr-center');
      return;
    }

    // mobile/pc: shoot at finger point (PATCH FIX)
    const p = pointFromEvent(ev);
    if (!p) {
      const c = centerXY();
      emitShoot(c.x, c.y, 'fallback-center');
      return;
    }
    emitShoot(p.x, p.y, 'touch-point');
  }

  // Use pointer events (best), fallback touch
  DOC.addEventListener('pointerdown', onShootInput, { passive:true });
  DOC.addEventListener('touchstart',  onShootInput, { passive:true });

})();