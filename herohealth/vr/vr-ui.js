// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — SAFE — PRODUCTION v20260215a
// ✅ Buttons: ENTER VR / EXIT / RECENTER (works even if A-Frame changes a bit)
// ✅ Crosshair overlay for PC/Mobile/cVR
// ✅ Emits: window dispatchEvent('hha:shoot', {x,y,lockPx,cooldownMs,source})
// ✅ view=cvr strict: always shoot from center (ignore pointer position)
// ✅ Tap-to-shoot (mobile) + Space/Enter to shoot (desktop)
// ✅ Cooldown guard prevents double fires
//
// Usage:
// - Include on run pages: <script src="../vr/vr-ui.js" defer></script>
// - Optional config: window.HHA_VRUI_CONFIG = { lockPx:28, cooldownMs:90 }
// - Optional: set <html data-view="cvr"> or URL ?view=cvr (your page can set dataset)
//
// Notes:
// - Does NOT depend on modules.
// - Never throws if A-Frame absent.

'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  const CFG = (function(){
    const c = WIN.HHA_VRUI_CONFIG || {};
    const lockPx = Math.max(6, Number(c.lockPx || 28) || 28);
    const cooldownMs = Math.max(30, Number(c.cooldownMs || 90) || 90);
    const showCrosshair = (c.showCrosshair == null) ? true : !!c.showCrosshair;
    const strictCvr = (c.strictCvr == null) ? true : !!c.strictCvr;
    return { lockPx, cooldownMs, showCrosshair, strictCvr };
  })();

  // ---- helpers ----
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const qs = (s)=>DOC.querySelector(s);

  function isCvr(){
    const v = String(DOC.documentElement?.dataset?.view || '').toLowerCase();
    if(v === 'cvr') return true;
    try{
      const sp = new URL(location.href).searchParams;
      return String(sp.get('view') || '').toLowerCase() === 'cvr';
    }catch{}
    return false;
  }

  function dispatchShoot(x,y, source){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail: {
          x, y,
          lockPx: CFG.lockPx,
          cooldownMs: CFG.cooldownMs,
          source: source || 'ui'
        }
      }));
    }catch{}
  }

  // ---- UI elements ----
  let uiRoot=null, crosshair=null;
  let btnEnter=null, btnExit=null, btnRecenter=null;

  function ensureUI(){
    if(uiRoot) return;

    uiRoot = DOC.createElement('div');
    uiRoot.id = 'hha-vrui';
    uiRoot.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:9999'
    ].join(';');

    // crosshair
    crosshair = DOC.createElement('div');
    crosshair.id = 'hha-crosshair';
    crosshair.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      'width:18px',
      'height:18px',
      'transform:translate(-50%,-50%)',
      'border-radius:999px',
      'box-shadow:0 0 0 1px rgba(229,231,235,.35) inset, 0 0 18px rgba(34,211,238,.18)',
      'background:radial-gradient(circle, rgba(229,231,235,.35), rgba(229,231,235,0) 58%)',
      'opacity:' + (CFG.showCrosshair ? '1' : '0'),
      'pointer-events:none'
    ].join(';');

    // buttons bar
    const bar = DOC.createElement('div');
    bar.style.cssText = [
      'position:absolute',
      'right:10px',
      'top:10px',
      'display:flex',
      'gap:8px',
      'flex-wrap:wrap',
      'pointer-events:none'
    ].join(';');

    const makeBtn = (txt)=>{
      const b = DOC.createElement('button');
      b.type = 'button';
      b.textContent = txt;
      b.style.cssText = [
        'pointer-events:auto',
        'appearance:none',
        'border:none',
        'border-radius:999px',
        'padding:10px 12px',
        'background:rgba(2,6,23,.62)',
        'border:1px solid rgba(148,163,184,.22)',
        'color:rgba(229,231,235,.95)',
        'font:1000 12px/1 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif',
        'backdrop-filter:blur(10px)',
        'box-shadow:0 16px 46px rgba(0,0,0,.35)',
        '-webkit-tap-highlight-color:transparent',
        'user-select:none',
        'cursor:pointer'
      ].join(';');
      b.addEventListener('pointerdown', (e)=>{ try{ e.preventDefault(); }catch{} }, {passive:false});
      return b;
    };

    btnEnter = makeBtn('🕶 ENTER VR');
    btnExit  = makeBtn('🚪 EXIT VR');
    btnRecenter = makeBtn('🎯 RECENTER');

    // default hide exit (will toggle when in VR)
    btnExit.style.display = 'none';

    bar.appendChild(btnEnter);
    bar.appendChild(btnExit);
    bar.appendChild(btnRecenter);

    uiRoot.appendChild(crosshair);
    uiRoot.appendChild(bar);
    DOC.body.appendChild(uiRoot);
  }

  // ---- A-Frame hooks ----
  function getScene(){
    // embedded scenes used in HeroHealth run pages
    return qs('a-scene');
  }
  function enterVR(){
    const scene = getScene();
    try{
      if(scene && typeof scene.enterVR === 'function'){ scene.enterVR(); return true; }
    }catch{}
    return false;
  }
  function exitVR(){
    const scene = getScene();
    try{
      if(scene && typeof scene.exitVR === 'function'){ scene.exitVR(); return true; }
      // sometimes A-Frame exposes sceneEl
      if(scene && scene.sceneEl && typeof scene.sceneEl.exitVR === 'function'){ scene.sceneEl.exitVR(); return true; }
    }catch{}
    return false;
  }
  function recenter(){
    // Soft recenter: request fullscreen/orientation if possible, then reset look-controls yaw by toggling
    try{
      const cam = qs('a-camera');
      if(cam){
        const lc = cam.components && cam.components['look-controls'];
        if(lc){
          // A-Frame look-controls has yawObject; zeroing rotation is ok-ish
          try{
            if(lc.yawObject) lc.yawObject.rotation.y = 0;
            if(lc.pitchObject) lc.pitchObject.rotation.x = 0;
          }catch{}
        }
      }
    }catch{}
  }

  function updateVrButtons(){
    const scene = getScene();
    let inVr = false;
    try{
      inVr = !!(scene && (scene.is('vr-mode') || (scene.sceneEl && scene.sceneEl.is && scene.sceneEl.is('vr-mode'))));
    }catch{}
    if(btnEnter) btnEnter.style.display = inVr ? 'none' : 'inline-flex';
    if(btnExit)  btnExit.style.display  = inVr ? 'inline-flex' : 'none';
  }

  function wireSceneEvents(){
    const scene = getScene();
    if(!scene || scene.__HHA_VRUI_WIRED) return;
    scene.__HHA_VRUI_WIRED = true;

    // A-Frame emits enter-vr / exit-vr
    scene.addEventListener('enter-vr', ()=>{ updateVrButtons(); }, {passive:true});
    scene.addEventListener('exit-vr',  ()=>{ updateVrButtons(); }, {passive:true});
    // fallback polling
    setInterval(updateVrButtons, 800);
  }

  // ---- Shooting input ----
  let cooldownUntil = 0;

  function shootAt(x,y, source){
    const t = now();
    if(t < cooldownUntil) return;
    cooldownUntil = t + CFG.cooldownMs;
    dispatchShoot(x,y, source);
    // micro flash
    try{
      if(crosshair){
        crosshair.style.transform = 'translate(-50%,-50%) scale(0.92)';
        setTimeout(()=>{ if(crosshair) crosshair.style.transform = 'translate(-50%,-50%) scale(1)'; }, 80);
      }
    }catch{}
  }

  function getCenter(){
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function onPointerDown(ev){
    // Allow shooting by tap anywhere, but in non-cvr use pointer position
    // In cvr strict => shoot center
    try{
      const cvr = isCvr();
      if(cvr && CFG.strictCvr){
        const c = getCenter();
        shootAt(c.x, c.y, 'tap-cvr');
        return;
      }
      const x = Number(ev.clientX);
      const y = Number(ev.clientY);
      if(isFinite(x) && isFinite(y)) shootAt(x, y, 'tap');
    }catch{}
  }

  function onKeyDown(ev){
    const k = String(ev.key||'').toLowerCase();
    if(k === ' ' || k === 'spacebar' || k === 'enter'){
      try{ ev.preventDefault(); }catch{}
      const c = getCenter();
      shootAt(c.x, c.y, 'key');
    }
  }

  // ---- init ----
  function init(){
    ensureUI();
    wireSceneEvents();

    // bind UI buttons
    btnEnter?.addEventListener('click', ()=>{ enterVR(); }, {passive:true});
    btnExit?.addEventListener('click',  ()=>{ exitVR(); }, {passive:true});
    btnRecenter?.addEventListener('click', ()=>{ recenter(); }, {passive:true});

    // global input
    // Use capture to receive taps even if some layers stop propagation
    DOC.addEventListener('pointerdown', onPointerDown, {passive:false, capture:true});
    DOC.addEventListener('keydown', onKeyDown, {passive:false});

    // keep crosshair centered on resize
    WIN.addEventListener('resize', ()=>{ /* crosshair uses 50% so ok */ }, {passive:true});

    // initial update
    updateVrButtons();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }

})();