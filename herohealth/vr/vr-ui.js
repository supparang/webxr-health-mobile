// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (Bottom Bar)
// ✅ Bottom bar: ENTER VR / EXIT / RECENTER (won't cover top HUD)
// ✅ Auto hide EXIT/RECENTER until actually in VR
// ✅ Crosshair overlay + tap-to-shoot (mobile/cVR)
// ✅ Emits: hha:shoot {x,y,lockPx,source}
// ✅ Supports view=cvr strict (aim from center screen)
// ✅ Sets CSS var: --hha-vrui-h for game safe-area calc
// Config: window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90 }

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function getView(){
    const v = String(qs('view','')).trim().toLowerCase();
    return v || ''; // do not assume
  }

  function setRootVar(name, px){
    try{ DOC.documentElement.style.setProperty(name, (Math.max(0, Math.floor(px||0)) + 'px')); }catch(_){}
  }

  function el(tag, attrs={}, children=[]){
    const n = DOC.createElement(tag);
    for(const k in attrs){
      if(k === 'style') n.style.cssText = String(attrs[k]||'');
      else if(k === 'class') n.className = String(attrs[k]||'');
      else if(k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k], { passive:true });
      else n.setAttribute(k, String(attrs[k]));
    }
    for(const c of children){
      if(typeof c === 'string') n.appendChild(DOC.createTextNode(c));
      else if(c) n.appendChild(c);
    }
    return n;
  }

  function findScene(){
    // Prefer AFRAME scenes; fallback to a-scene element
    try{
      if(WIN.AFRAME && Array.isArray(WIN.AFRAME.scenes) && WIN.AFRAME.scenes[0]) return WIN.AFRAME.scenes[0];
    }catch(_){}
    return DOC.querySelector('a-scene') || null;
  }

  function isInVR(scene){
    try{
      // A-Frame scene has is('vr-mode')
      if(scene && typeof scene.is === 'function') return !!scene.is('vr-mode');
    }catch(_){}
    return false;
  }

  function enterVR(scene){
    try{
      if(scene && typeof scene.enterVR === 'function') scene.enterVR();
    }catch(_){}
  }

  function exitVR(scene){
    try{
      if(scene && typeof scene.exitVR === 'function') scene.exitVR();
    }catch(_){}
  }

  function recenter(scene){
    // Best-effort: reset camera rotation (works for mobile “fake VR” / cardboard-ish)
    try{
      const cam =
        DOC.querySelector('[camera]') ||
        (scene && scene.camera && scene.camera.el) ||
        null;

      if(cam && cam.setAttribute){
        cam.setAttribute('rotation', '0 0 0');
      }
    }catch(_){}

    // Emit helper event in case games want to hook deeper recenter later
    try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'vr-ui' } })); }catch(_){}
  }

  // ---------------- UI Mount ----------------
  const root = el('div', { class:'hha-vrui-root', 'aria-hidden':'false' });

  // Crosshair
  const cross = el('div', { class:'hha-crosshair', 'aria-hidden':'false' }, [
    el('div', { class:'hha-cross-dot' })
  ]);

  // Bottom bar
  const bar = el('div', { class:'hha-vrui-bar', role:'group', 'aria-label':'VR Controls' });

  const btnEnter = el('button', { class:'hha-btn enter', type:'button' }, ['ENTER VR']);
  const btnExit  = el('button', { class:'hha-btn exit',  type:'button' }, ['EXIT']);
  const btnRec   = el('button', { class:'hha-btn rec',   type:'button' }, ['RECENTER']);

  bar.appendChild(btnEnter);
  bar.appendChild(btnExit);
  bar.appendChild(btnRec);

  root.appendChild(cross);
  root.appendChild(bar);

  DOC.body.appendChild(root);

  // Styles (inline injected to avoid needing separate css)
  const style = el('style', {}, [`
    :root{
      --hha-vrui-h: 0px;
      --hha-vrui-pad: 10px;
      --hha-sab: env(safe-area-inset-bottom, 0px);
    }

    .hha-vrui-root{
      position: fixed;
      inset: 0;
      z-index: 9999;
      pointer-events: none;
    }

    /* Crosshair always centered */
    .hha-crosshair{
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 36px;
      height: 36px;
      border-radius: 999px;
      border: 2px solid rgba(229,231,235,.28);
      background: rgba(2,6,23,.08);
      box-shadow: 0 10px 35px rgba(0,0,0,.35);
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .hha-cross-dot{
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: rgba(34,197,94,.95);
      box-shadow: 0 0 0 6px rgba(34,197,94,.12);
    }

    /* Bottom bar */
    .hha-vrui-bar{
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      padding: var(--hha-vrui-pad) calc(12px + env(safe-area-inset-right,0px))
               calc(var(--hha-vrui-pad) + var(--hha-sab))
               calc(12px + env(safe-area-inset-left,0px));
      display: flex;
      gap: 10px;
      justify-content: center;
      align-items: center;
      pointer-events: auto;
    }

    .hha-btn{
      height: 46px;
      padding: 0 16px;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.62);
      color: rgba(229,231,235,.96);
      font-weight: 950;
      letter-spacing: .2px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 14px 40px rgba(0,0,0,.34);
    }
    .hha-btn:active{ transform: translateY(1px); }

    .hha-btn.enter{
      border-color: rgba(34,197,94,.35);
      background: rgba(34,197,94,.16);
    }

    /* Hide EXIT/RECENTER until in VR */
    .hha-btn.exit, .hha-btn.rec{ display: none; }

    body.hha-in-vr .hha-btn.exit,
    body.hha-in-vr .hha-btn.rec{
      display: inline-flex;
    }

    /* If HUD is hidden, still keep VR bar (user can exit VR) */
    body.hud-hidden .hha-vrui-bar{ opacity: 1; }

    /* Optional: view=cvr strict -> keep crosshair, bar still usable */
  `]);
  DOC.head.appendChild(style);

  // ---------------- Safe height measure ----------------
  function updateBarHeight(){
    try{
      const r = bar.getBoundingClientRect();
      setRootVar('--hha-vrui-h', r.height || 0);
    }catch(_){}
  }
  setTimeout(updateBarHeight, 0);
  setTimeout(updateBarHeight, 120);
  WIN.addEventListener('resize', updateBarHeight, { passive:true });
  WIN.addEventListener('orientationchange', updateBarHeight, { passive:true });

  // ---------------- Shoot handling ----------------
  let lastShotAt = 0;

  function emitShoot(source){
    const now = performance.now ? performance.now() : Date.now();
    if(now - lastShotAt < (CFG.cooldownMs|0)) return;
    lastShotAt = now;

    // center screen shoot
    const rect = DOC.documentElement.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{
          x: cx,
          y: cy,
          lockPx: CFG.lockPx|0,
          source: source || 'tap'
        }
      }));
    }catch(_){}
  }

  // Tap anywhere on playfield should shoot (but ignore taps on UI buttons)
  function onPointerDown(ev){
    // if tap hits our buttons => ignore (buttons have their own handler)
    const t = ev.target;
    if(t && (t.closest && t.closest('.hha-vrui-bar'))) return;

    // in cVR strict, pointer events on targets are disabled; so shoot is primary
    emitShoot('tap');
  }

  // Only enable tap-to-shoot on mobile/cVR (still ok on pc, but you can keep it)
  DOC.addEventListener('pointerdown', onPointerDown, { passive:true });

  // ---------------- Buttons wiring ----------------
  const scene = findScene();

  function syncVRState(){
    const inVR = isInVR(scene);
    DOC.body.classList.toggle('hha-in-vr', !!inVR);
    // keep safe height fresh
    updateBarHeight();
  }

  btnEnter.addEventListener('click', ()=>{ enterVR(scene); setTimeout(syncVRState, 150); }, { passive:true });
  btnExit.addEventListener('click',  ()=>{ exitVR(scene);  setTimeout(syncVRState, 150); }, { passive:true });
  btnRec.addEventListener('click',   ()=>{ recenter(scene); }, { passive:true });

  // A-Frame events if available
  try{
    if(scene && scene.addEventListener){
      scene.addEventListener('enter-vr', ()=>syncVRState(), { passive:true });
      scene.addEventListener('exit-vr',  ()=>syncVRState(), { passive:true });
    }
  }catch(_){}

  // initial state
  setTimeout(syncVRState, 0);

  // view=cvr strict hint (optional hook)
  const view = getView();
  if(view === 'cvr'){
    // Keep everything; gameplay layer will disable pointer-events on targets already
    // Crosshair stays visible
  }
})();