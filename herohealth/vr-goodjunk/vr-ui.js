// === /herohealth/vr-goodjunk/vr-ui.js ===
// Universal VR UI — PRODUCTION (local copy for folder-run)
// ✅ ENTER VR / EXIT / RECENTER buttons (best-effort)
// ✅ Crosshair overlay + tap-to-shoot (mobile/cVR)
// ✅ Emits: window event 'hha:shoot' {x,y,lockPx,source}
// ✅ view=cvr strict supported (shoot from center)
// Config: window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90 }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function getView(){
    return String(qs('view','')).toLowerCase();
  }

  function emitShoot(x,y,source){
    WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{
      x, y, lockPx: CFG.lockPx, source: source || 'tap'
    }}));
  }

  // UI shell
  const ui = DOC.createElement('div');
  ui.className = 'hha-vrui';
  ui.style.cssText = `
    position:fixed; left:calc(10px + env(safe-area-inset-left,0px));
    bottom:calc(10px + env(safe-area-inset-bottom,0px));
    z-index:250; display:flex; gap:8px; align-items:center;
    pointer-events:auto;
  `;

  function mkBtn(txt){
    const b = DOC.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.style.cssText = `
      height:40px; padding:0 12px; border-radius:14px;
      border:1px solid rgba(148,163,184,.22);
      background:rgba(2,6,23,.62); color:#e5e7eb;
      font: 900 12px/1 system-ui;
      backdrop-filter: blur(10px);
    `;
    return b;
  }

  const btnEnter = mkBtn('ENTER VR');
  const btnExit  = mkBtn('EXIT');
  const btnRe    = mkBtn('RECENTER');
  ui.appendChild(btnEnter);
  ui.appendChild(btnExit);
  ui.appendChild(btnRe);
  DOC.body.appendChild(ui);

  // Crosshair
  const cross = DOC.createElement('div');
  cross.className = 'hha-crosshair';
  cross.style.cssText = `
    position:fixed; left:50%; top:50%;
    width:18px; height:18px; transform:translate(-50%,-50%);
    border:2px solid rgba(255,255,255,.85);
    border-radius:999px;
    box-shadow:0 10px 30px rgba(0,0,0,.55);
    z-index:240;
    pointer-events:none;
  `;
  DOC.body.appendChild(cross);

  // cooldown for tap-to-shoot
  let lastShoot = 0;

  function shootFromTap(ev){
    const t = performance.now();
    if(t - lastShoot < CFG.cooldownMs) return;
    lastShoot = t;

    const view = getView();
    if(view === 'cvr' || view === 'vr' || DOC.body.classList.contains('view-cvr') || DOC.body.classList.contains('view-vr')){
      // strict: shoot from center for cVR/VR
      emitShoot(WIN.innerWidth/2, WIN.innerHeight/2, 'crosshair');
    }else{
      // pc/mobile: shoot where tapped
      const x = ev?.clientX ?? (WIN.innerWidth/2);
      const y = ev?.clientY ?? (WIN.innerHeight/2);
      emitShoot(x, y, 'tap');
    }
  }

  // tap anywhere triggers shoot (but HUD buttons still clickable)
  DOC.addEventListener('pointerdown', (ev)=>{
    const target = ev.target;
    if(target && (target.tagName === 'BUTTON' || target.closest('button'))) return;
    shootFromTap(ev);
  }, { passive:true });

  // A-Frame/WebXR best-effort hooks (if present)
  function findScene(){
    return DOC.querySelector('a-scene');
  }
  btnEnter.addEventListener('click', ()=>{
    const sc = findScene();
    try{
      // A-Frame enterVR if available
      if(sc && sc.enterVR) sc.enterVR();
      else DOC.documentElement.requestFullscreen?.();
    }catch(_){}
  });
  btnExit.addEventListener('click', ()=>{
    const sc = findScene();
    try{
      if(sc && sc.exitVR) sc.exitVR();
      else DOC.exitFullscreen?.();
    }catch(_){}
  });
  btnRe.addEventListener('click', ()=>{
    // simple "recenter" = trigger custom event; engine may listen later
    WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ t: Date.now() }}));
  });
})();