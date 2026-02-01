// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (HHA Standard) — PATCH ULTRA AIM-ASSIST
// ✅ ENTER VR / EXIT / RECENTER buttons
// ✅ Crosshair overlay + tap-to-shoot => emits: hha:shoot {x,y,lockPx,source}
// ✅ view=cvr strict: shoot from center screen (crosshair) + lock to nearest target in #playLayer
// ✅ Aim-assist never locks HUD: restrict to #playLayer only
// ✅ Config via window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90 }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  // ---------------- config ----------------
  const CFG = Object.assign({
    lockPx: 28,
    cooldownMs: 90,
    playLayerId: 'playLayer',
    // include the class names used across HHA games
    targetSelector: '.tgt,.target,.hha-target,[data-target],[data-group]',
    // optional: block shots if pointer is outside playLayer (mobile/pc)
    restrictPointerToPlayLayer: true
  }, WIN.HHA_VRUI_CONFIG || {});

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, d=''){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  }

  function getView(){
    const v = String(qs('view','')||'').toLowerCase();
    // do not override if caller forced view; default to mobile
    return v || 'mobile';
  }

  const VIEW = getView();

  // ---------------- UI mount ----------------
  function mkEl(tag, css, html){
    const el = DOC.createElement(tag);
    if(css) el.style.cssText = css;
    if(html != null) el.innerHTML = html;
    return el;
  }

  // Root overlay (pointer-events:none so gameplay layer still tappable)
  const ui = mkEl('div', [
    'position:fixed','inset:0','z-index:80','pointer-events:none',
    'font-family:system-ui,-apple-system,"Noto Sans Thai","Segoe UI",Roboto,sans-serif'
  ].join(';'));
  DOC.body.appendChild(ui);

  // Crosshair (for cVR + optional)
  const cross = mkEl('div', [
    'position:fixed','left:50%','top:50%',
    'transform:translate(-50%,-50%)',
    'width:18px','height:18px','border-radius:999px',
    'border:2px solid rgba(229,231,235,.85)',
    'box-shadow:0 10px 26px rgba(0,0,0,.35)',
    'opacity:' + ((VIEW==='cvr' || VIEW==='vr') ? '1' : '0'),
    'pointer-events:none'
  ].join(';'));
  ui.appendChild(cross);

  // Button bar (top-right)
  const bar = mkEl('div', [
    'position:fixed',
    'top:calc(env(safe-area-inset-top,0px) + 10px)',
    'right:calc(env(safe-area-inset-right,0px) + 10px)',
    'display:flex','gap:8px',
    'pointer-events:auto','z-index:90'
  ].join(';'));
  ui.appendChild(bar);

  function mkBtn(txt){
    const b = mkEl('button', [
      'appearance:none',
      'border-radius:14px',
      'padding:10px 12px',
      'border:1px solid rgba(148,163,184,.22)',
      'background:rgba(2,6,23,.68)',
      'color:rgba(229,231,235,.95)',
      'font-weight:1000','font-size:12px',
      'backdrop-filter:blur(10px)',
      'cursor:pointer','user-select:none'
    ].join(';'), txt);
    b.addEventListener('pointerdown', (e)=>{ try{ e.stopPropagation(); }catch(_){ } }, {passive:true});
    return b;
  }

  const btnEnter = mkBtn('ENTER VR');
  const btnExit  = mkBtn('EXIT');
  const btnRecenter = mkBtn('RECENTER');

  bar.appendChild(btnEnter);
  bar.appendChild(btnExit);
  bar.appendChild(btnRecenter);

  // ---------------- WebXR actions ----------------
  function getScene(){
    try{
      // prefer a-scene if exists
      return DOC.querySelector('a-scene') || null;
    }catch(_){ return null; }
  }

  function tryEnterVR(){
    try{
      const sc = getScene();
      if(sc && sc.enterVR) sc.enterVR();
    }catch(_){}
  }

  function tryExitVR(){
    try{
      const sc = getScene();
      if(sc && sc.exitVR) sc.exitVR();
      const xr = WIN.navigator && WIN.navigator.xr;
      // no direct exit here; scene.exitVR is enough for A-Frame
    }catch(_){}
  }

  function tryRecenter(){
    // A-Frame: emit "recenter" style events if you have hooks; otherwise do safe no-op
    try{
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ t: nowMs(), view: VIEW } }));
    }catch(_){}
  }

  btnEnter.addEventListener('click', tryEnterVR);
  btnExit.addEventListener('click', tryExitVR);
  btnRecenter.addEventListener('click', tryRecenter);

  // ---------------- Aim Assist (ULTRA) ----------------
  function getPlayLayer(){
    try{
      return DOC.getElementById(CFG.playLayerId) || DOC.querySelector('.playLayer') || null;
    }catch(_){ return null; }
  }

  function pointInsideRect(x,y,r){
    return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
  }

  function lockToNearestTarget(x,y){
    const lockPx = clamp(CFG.lockPx, 0, 220);
    if(lockPx <= 0) return { x, y, locked:false };

    const layer = getPlayLayer();
    if(!layer) return { x, y, locked:false };

    const layerRect = layer.getBoundingClientRect();
    // if caller wants pointer restricted, don't lock if outside play area
    if(CFG.restrictPointerToPlayLayer && !pointInsideRect(x,y,layerRect)){
      return { x, y, locked:false };
    }

    let best = null;
    let bestD = 1e9;

    // query only within playLayer => never locks HUD
    const nodes = layer.querySelectorAll(CFG.targetSelector);
    for(let i=0;i<nodes.length;i++){
      const el = nodes[i];
      if(!el || !el.getBoundingClientRect) continue;

      const r = el.getBoundingClientRect();
      if(r.width < 6 || r.height < 6) continue;

      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      // distance to center
      const dx = (cx - x);
      const dy = (cy - y);
      const d = Math.hypot(dx,dy);

      // prefer visible ones
      if(d < bestD && d <= lockPx){
        bestD = d;
        best = { x: cx, y: cy, el };
      }
    }

    if(best){
      return { x: best.x, y: best.y, locked:true, dist: bestD };
    }
    return { x, y, locked:false };
  }

  // ---------------- Shoot emission ----------------
  let lastShotAt = 0;

  function emitShoot(rawX, rawY, source){
    const t = nowMs();
    if(t - lastShotAt < clamp(CFG.cooldownMs, 30, 240)) return;
    lastShotAt = t;

    let x = Number(rawX)||0;
    let y = Number(rawY)||0;

    // In cVR strict: always shoot from center crosshair
    if(VIEW === 'cvr'){
      x = (WIN.innerWidth  || 360) / 2;
      y = (WIN.innerHeight || 640) / 2;
    }

    // Aim-assist lock (always tries inside playLayer only)
    const locked = lockToNearestTarget(x,y);
    x = locked.x; y = locked.y;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail: {
          x, y,
          lockPx: clamp(CFG.lockPx, 0, 220),
          locked: !!locked.locked,
          source: source || (VIEW==='cvr' ? 'crosshair' : 'tap'),
          t
        }
      }));
    }catch(_){}
  }

  // ---------------- Input hooks ----------------
  // IMPORTANT: ui is pointer-events:none, so we listen on document/window
  function onPointerDown(e){
    // ignore multi-touch / right click
    if(!e) return;
    if(typeof e.button === 'number' && e.button > 0) return;

    const x = (typeof e.clientX === 'number') ? e.clientX : 0;
    const y = (typeof e.clientY === 'number') ? e.clientY : 0;

    // If restrictPointerToPlayLayer, ignore taps outside playLayer (prevents HUD misfire)
    if(CFG.restrictPointerToPlayLayer){
      const layer = getPlayLayer();
      if(layer){
        const r = layer.getBoundingClientRect();
        if(!pointInsideRect(x,y,r)) return;
      }
    }

    emitShoot(x,y,'pointer');
  }

  // Keyboard fallback (space) => shoot
  function onKeyDown(e){
    if(!e) return;
    const k = String(e.key||'').toLowerCase();
    if(k === ' ' || k === 'spacebar' || k === 'enter'){
      emitShoot((WIN.innerWidth||360)/2, (WIN.innerHeight||640)/2, 'key');
    }
  }

  // In cVR, you usually want tap-to-shoot anywhere (but still restricted to playLayer by default)
  DOC.addEventListener('pointerdown', onPointerDown, { passive:true });
  DOC.addEventListener('keydown', onKeyDown, { passive:true });

  // Optional: show/hide crosshair on view change (if page changes query)
  function refreshCrosshair(){
    cross.style.opacity = (VIEW==='cvr' || VIEW==='vr') ? '1' : '0';
  }
  refreshCrosshair();

})();