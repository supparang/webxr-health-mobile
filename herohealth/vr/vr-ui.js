// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION
// ✅ Adds: ENTER VR / EXIT / RECENTER buttons (A-Frame)
// ✅ Crosshair overlay + tap-to-shoot (for mobile/cVR)
// ✅ Emits: hha:shoot {x,y,lockPx,source}
// ✅ Supports view=cvr strict (aim from center screen)
// ✅ Config: window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90 }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function getView(){
    try{
      const v = String(qs('view','')).toLowerCase();
      return v || '';
    }catch(_){ return ''; }
  }

  // --- overlay mount ---
  const wrap = DOC.createElement('div');
  wrap.id = 'hha-vrui';
  wrap.style.cssText = `
    position:fixed; inset:0; pointer-events:none; z-index:9999;
    font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
  `;

  // buttons container (pointer-events enabled)
  const btns = DOC.createElement('div');
  btns.style.cssText = `
    position:fixed; left:12px; right:12px; top:12px;
    display:flex; gap:8px; justify-content:flex-end; align-items:center;
    pointer-events:auto; z-index:10000;
  `;

  function mkBtn(txt){
    const b = DOC.createElement('button');
    b.type='button';
    b.textContent = txt;
    b.style.cssText = `
      height:38px; padding:0 12px; border-radius:14px;
      border:1px solid rgba(148,163,184,.22);
      background:rgba(2,6,23,.55); color:#e5e7eb;
      font-weight:900; cursor:pointer;
      backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
    `;
    b.addEventListener('pointerdown', (e)=>{ e.preventDefault(); e.stopPropagation(); }, {passive:false});
    return b;
  }

  const bEnter = mkBtn('ENTER VR');
  const bExit  = mkBtn('EXIT');
  const bRe    = mkBtn('RECENTER');

  btns.appendChild(bRe);
  btns.appendChild(bExit);
  btns.appendChild(bEnter);

  // crosshair (center)
  const cross = DOC.createElement('div');
  cross.id='hha-crosshair';
  cross.style.cssText = `
    position:fixed; left:50%; top:50%;
    width:22px; height:22px; transform:translate(-50%,-50%);
    border-radius:999px;
    border:2px solid rgba(229,231,235,.92);
    box-shadow:0 0 0 6px rgba(34,211,238,.10);
    pointer-events:none;
  `;

  // tiny dot
  const dot = DOC.createElement('div');
  dot.style.cssText = `
    position:absolute; left:50%; top:50%;
    width:4px; height:4px; transform:translate(-50%,-50%);
    border-radius:999px; background:rgba(34,197,94,.95);
  `;
  cross.appendChild(dot);

  wrap.appendChild(btns);
  wrap.appendChild(cross);
  DOC.documentElement.appendChild(wrap);

  // --- A-Frame helpers ---
  function scene(){
    return DOC.querySelector('a-scene');
  }

  function enterVR(){
    const sc = scene();
    try{
      if(sc && sc.enterVR) sc.enterVR();
    }catch(_){}
  }
  function exitVR(){
    const sc = scene();
    try{
      if(sc && sc.exitVR) sc.exitVR();
    }catch(_){}
  }
  function recenter(){
    // best-effort: reset look-controls yaw
    try{
      const cam = DOC.querySelector('[camera]');
      if(cam && cam.components && cam.components['look-controls']){
        const lc = cam.components['look-controls'];
        if(lc && lc.pitchObject) lc.pitchObject.rotation.x = 0;
        if(lc && lc.yawObject)   lc.yawObject.rotation.y = 0;
      }
    }catch(_){}
  }

  bEnter.addEventListener('click', ()=>enterVR());
  bExit.addEventListener('click',  ()=>exitVR());
  bRe.addEventListener('click',    ()=>recenter());

  // --- tap/click => emit shoot (for cVR / mobile) ---
  let lastShot = 0;
  function canShootNow(){
    const now = performance.now();
    if(now - lastShot < (CFG.cooldownMs|0)) return false;
    lastShot = now;
    return true;
  }

  function emitShoot(source='tap'){
    if(!canShootNow()) return;

    // use center aim
    const r = DOC.documentElement.getBoundingClientRect();
    const x = r.width/2;
    const y = r.height/2;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{
        x, y,
        lockPx: Number(CFG.lockPx||28),
        source
      }}));
    }catch(_){}
  }

  // strict cVR: always shoot by tap anywhere (targets have pointer-events none)
  DOC.addEventListener('pointerdown', (ev)=>{
    const v = getView();
    if(v === 'cvr'){
      emitShoot('cvr');
    }
  }, {passive:true});

  // mobile: optional tap-to-shoot (if you want, keep it enabled for all)
  DOC.addEventListener('dblclick', (ev)=>{
    emitShoot('dbl');
  }, {passive:true});

})();