// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION (Floating Corner Bar)
// ✅ ENTER VR / EXIT / RECENTER
// ✅ Crosshair overlay + tap-to-shoot
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
  const qs = (s)=>DOC.querySelector(s);

  function getView(){
    try{
      const v = new URL(location.href).searchParams.get('view');
      return (v||'').toLowerCase();
    }catch(_){ return ''; }
  }

  function ensureStyles(){
    if(qs('#hha-vrui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      .hha-vrui-root{ position:fixed; inset:0; pointer-events:none; z-index:9999; }
      .hha-vrui-bar{
        position: fixed;
        left: auto !important;
        right: calc(10px + env(safe-area-inset-right, 0px)) !important;
        bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important;
        top: auto !important;

        z-index: 9999;
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;

        width: auto !important;
        padding: 0 !important;
        margin: 0 !important;

        pointer-events: auto;
      }
      .hha-btn{
        height: 42px;
        padding: 0 12px;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.62);
        color: rgba(229,231,235,.95);
        font-weight: 1000;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        cursor: pointer;
      }
      .hha-btn:active{ transform: translateY(1px); }
      .hha-btn.hha-enter{
        border-color: rgba(34,197,94,.40);
        background: rgba(34,197,94,.16);
      }
      body.view-vr .hha-vrui-bar,
      body.view-cvr .hha-vrui-bar{
        bottom: calc(18px + env(safe-area-inset-bottom, 0px)) !important;
      }

      /* Crosshair */
      .hha-crosshair{
        position: fixed;
        left: 50%;
        top: 50%;
        width: 22px;
        height: 22px;
        transform: translate(-50%, -50%);
        border-radius: 999px;
        border: 2px solid rgba(229,231,235,.85);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        pointer-events: none;
      }
      .hha-crosshair::after{
        content:'';
        position:absolute;
        inset: 6px;
        border-radius: 999px;
        background: rgba(34,197,94,.85);
        opacity:.85;
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureDOM(){
    let root = qs('#hha-vrui-root');
    if(root) return root;

    ensureStyles();

    root = DOC.createElement('div');
    root.id = 'hha-vrui-root';
    root.className = 'hha-vrui-root';

    const bar = DOC.createElement('div');
    bar.className = 'hha-vrui-bar';

    const btnEnter = DOC.createElement('button');
    btnEnter.className = 'hha-btn hha-enter';
    btnEnter.type = 'button';
    btnEnter.textContent = 'ENTER VR';

    const btnExit = DOC.createElement('button');
    btnExit.className = 'hha-btn';
    btnExit.type = 'button';
    btnExit.textContent = 'EXIT';

    const btnRecenter = DOC.createElement('button');
    btnRecenter.className = 'hha-btn';
    btnRecenter.type = 'button';
    btnRecenter.textContent = 'RECENTER';

    bar.appendChild(btnEnter);
    bar.appendChild(btnExit);
    bar.appendChild(btnRecenter);

    const cross = DOC.createElement('div');
    cross.className = 'hha-crosshair';

    root.appendChild(bar);
    root.appendChild(cross);
    DOC.body.appendChild(root);

    // Wire buttons (A-Frame best effort)
    function scene(){
      return DOC.querySelector('a-scene');
    }
    btnEnter.addEventListener('click', ()=>{
      try{
        const sc = scene();
        if(sc && sc.enterVR) sc.enterVR();
      }catch(_){}
    }, { passive:true });

    btnExit.addEventListener('click', ()=>{
      try{
        const sc = scene();
        if(sc && sc.exitVR) sc.exitVR();
      }catch(_){}
    }, { passive:true });

    btnRecenter.addEventListener('click', ()=>{
      // best effort: emit event; games can handle if needed
      try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', {detail:{source:'vrui'}})); }catch(_){}
    }, { passive:true });

    return root;
  }

  // Tap-to-shoot => emit hha:shoot
  let lastShotAt = 0;
  function shoot(source){
    const now = performance.now ? performance.now() : Date.now();
    if(now - lastShotAt < (CFG.cooldownMs||90)) return;
    lastShotAt = now;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{ x:0.5, y:0.5, lockPx: (CFG.lockPx||28), source: source||'tap' }
      }));
    }catch(_){}
  }

  function onPointerDown(ev){
    // If tapping on a button => ignore (buttons already handle)
    const t = ev?.target;
    if(t && (t.closest && t.closest('.hha-vrui-bar'))) return;

    const v = getView();
    // In cVR strict OR mobile: allow tap to shoot
    if(v === 'cvr' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')){
      shoot('tap');
    }
  }

  function init(){
    ensureDOM();
    DOC.addEventListener('pointerdown', onPointerDown, { passive:true });
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();