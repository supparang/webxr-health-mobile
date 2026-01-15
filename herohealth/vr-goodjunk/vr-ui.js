// === /herohealth/vr-goodjunk/vr-ui.js ===
// Universal VR UI (LOCAL COPY)
// ✅ ENTER VR / EXIT / RECENTER
// ✅ Crosshair overlay + tap-to-shoot
// ✅ Emits window event: 'hha:shoot' {x,y,lockPx,source}

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_VRUI_LOCAL__) return;
  WIN.__HHA_VRUI_LOCAL__ = true;

  const CFG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const view = String(qs('view','')).toLowerCase();

  let lastShot = 0;

  function emitShoot(x,y,source){
    const t = performance?.now?.() ?? Date.now();
    if(t - lastShot < CFG.cooldownMs) return;
    lastShot = t;
    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ x, y, lockPx: CFG.lockPx, source } }));
    }catch(_){}
  }

  function ensure(){
    let wrap = DOC.querySelector('.hha-vrui');
    if(wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'hha-vrui';
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:260;
      pointer-events:none;
      font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
    `;

    // crosshair
    const cross = DOC.createElement('div');
    cross.className = 'hha-crosshair';
    cross.style.cssText = `
      position:absolute; left:50%; top:50%;
      width:18px; height:18px;
      transform:translate(-50%,-50%);
      border:2px solid rgba(255,255,255,.72);
      border-radius:999px;
      box-shadow:0 0 0 6px rgba(255,255,255,.07);
      opacity:${(view==='cvr'||view==='vr'||view==='cardboard') ? 1 : .0};
      transition: opacity 180ms ease;
      pointer-events:none;
    `;
    wrap.appendChild(cross);

    // buttons tray
    const tray = DOC.createElement('div');
    tray.style.cssText = `
      position:fixed;
      right: calc(10px + env(safe-area-inset-right, 0px));
      bottom: calc(10px + env(safe-area-inset-bottom, 0px));
      display:flex; gap:8px;
      pointer-events:auto;
      z-index:261;
    `;

    const mkBtn = (txt)=>{
      const b = DOC.createElement('button');
      b.textContent = txt;
      b.style.cssText = `
        height:44px; padding:0 12px;
        border-radius:14px;
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.60);
        color:#e5e7eb;
        font-weight:1000;
        cursor:pointer;
        backdrop-filter:blur(10px);
      `;
      return b;
    };

    const bEnter = mkBtn('ENTER VR');
    const bExit  = mkBtn('EXIT');
    const bRe    = mkBtn('RECENTER');

    tray.appendChild(bEnter);
    tray.appendChild(bExit);
    tray.appendChild(bRe);
    wrap.appendChild(tray);

    DOC.body.appendChild(wrap);

    // wire A-Frame scene if present
    const scene = ()=> DOC.querySelector('a-scene');
    bEnter.addEventListener('click', async ()=>{
      try{
        const s = scene();
        if(s && s.enterVR) await s.enterVR();
      }catch(_){}
    });
    bExit.addEventListener('click', async ()=>{
      try{
        const s = scene();
        if(s && s.exitVR) await s.exitVR();
      }catch(_){}
    });
    bRe.addEventListener('click', ()=>{
      // best-effort recenter: emit coach/any listeners can handle; A-Frame has no universal recenter
      try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ ts: Date.now() } })); }catch(_){}
    });

    // tap-to-shoot (important for cVR/VR)
    DOC.addEventListener('pointerdown', (ev)=>{
      const v = String(qs('view','')).toLowerCase();
      if(v !== 'cvr' && v !== 'vr' && v !== 'cardboard') return;
      emitShoot(ev.clientX, ev.clientY, 'tap');
    }, { passive:true });

    // also allow "center shoot" by quick tap anywhere (cVR strict)
    DOC.addEventListener('touchstart', (ev)=>{
      const v = String(qs('view','')).toLowerCase();
      if(v !== 'cvr') return;
      const x = WIN.innerWidth/2;
      const y = WIN.innerHeight/2;
      emitShoot(x,y,'touch-center');
    }, { passive:true });

    return wrap;
  }

  ensure();
})();