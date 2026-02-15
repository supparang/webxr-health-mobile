// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — SAFE — v20260215a
// ✅ ENTER VR / EXIT / RECENTER (A-Frame friendly)
// ✅ Crosshair overlay (PC/Mobile/cVR)
// ✅ Tap-to-shoot => emits window event: 'hha:shoot' {x,y,lockPx,cooldownMs,source}
// ✅ view=cvr strict: shoot from center crosshair (not relying on clicking targets)
// ✅ Never crashes if A-Frame missing
//
// Config (optional):
//   window.HHA_VRUI_CONFIG = { lockPx: 28, cooldownMs: 90, crosshair: true, buttons: true }

(function(){
  'use strict';

  const ROOT = window;
  const DOC = document;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();

  const CFG = (function(){
    const c = ROOT.HHA_VRUI_CONFIG || {};
    return {
      lockPx: clamp(c.lockPx ?? 28, 8, 120),
      cooldownMs: clamp(c.cooldownMs ?? 90, 30, 400),
      crosshair: (c.crosshair !== false),
      buttons: (c.buttons !== false),
      recenter: (c.recenter !== false),
      // if you want strict center shooting always:
      alwaysCenter: !!c.alwaysCenter
    };
  })();

  // Detect view=cvr
  const VIEW = (function(){
    try{
      const u = new URL(location.href);
      return String(u.searchParams.get('view')||'').toLowerCase();
    }catch{ return ''; }
  })();
  const IS_CVR = (VIEW === 'cvr') || (DOC.documentElement?.dataset?.view === 'cvr');

  // State
  const S = {
    mounted:false,
    lastShotAt:0,
    inVR:false,
    scene:null,
    uiRoot:null,
    crosshairEl:null,
    btnEnter:null,
    btnExit:null,
    btnRecenter:null
  };

  function emitShoot(x,y, source){
    const t = now();
    if(t - S.lastShotAt < CFG.cooldownMs) return;
    S.lastShotAt = t;

    try{
      ROOT.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{
          x: Number(x)||0,
          y: Number(y)||0,
          lockPx: CFG.lockPx,
          cooldownMs: CFG.cooldownMs,
          source: source || 'vrui'
        }
      }));
    }catch{}
  }

  // --------- UI DOM ---------
  function ensureStyles(){
    if(DOC.getElementById('hha-vrui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      #hha-vrui{
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
      }
      #hha-vrui .vrui-btns{
        position: fixed;
        left: 10px;
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        pointer-events: none;
        z-index: 10000;
      }
      #hha-vrui button{
        pointer-events: auto;
        appearance: none;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.70);
        color: rgba(229,231,235,.95);
        font: 900 12px/1 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        border-radius: 999px;
        padding: 10px 12px;
        box-shadow: 0 16px 40px rgba(0,0,0,.30);
        backdrop-filter: blur(10px);
        cursor: pointer;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
      }
      #hha-vrui button:active{ transform: translateY(1px); }

      /* Crosshair */
      #hha-crosshair{
        position: fixed;
        left: 50%;
        top: 50%;
        width: 18px;
        height: 18px;
        transform: translate(-50%,-50%);
        pointer-events: none;
        z-index: 10001;
        opacity: .95;
      }
      #hha-crosshair:before, #hha-crosshair:after{
        content:"";
        position:absolute;
        left:50%;
        top:50%;
        width: 18px;
        height: 2px;
        background: rgba(229,231,235,.92);
        transform: translate(-50%,-50%);
        border-radius: 2px;
        box-shadow: 0 0 14px rgba(34,211,238,.22);
      }
      #hha-crosshair:after{
        width: 2px;
        height: 18px;
      }

      /* mode hints */
      #hha-vrui[data-cvr="1"] #hha-crosshair{
        opacity: .98;
      }
    `;
    DOC.head.appendChild(st);
  }

  function mountUI(){
    if(S.mounted) return;
    S.mounted = true;

    ensureStyles();

    const root = DOC.createElement('div');
    root.id = 'hha-vrui';
    root.dataset.cvr = IS_CVR ? '1' : '0';

    // crosshair
    let ch = null;
    if(CFG.crosshair){
      ch = DOC.createElement('div');
      ch.id = 'hha-crosshair';
      root.appendChild(ch);
    }

    // buttons
    let btnWrap = null;
    if(CFG.buttons){
      btnWrap = DOC.createElement('div');
      btnWrap.className = 'vrui-btns';

      const bEnter = DOC.createElement('button');
      bEnter.type = 'button';
      bEnter.textContent = '🕶 ENTER VR';

      const bExit = DOC.createElement('button');
      bExit.type = 'button';
      bExit.textContent = '🚪 EXIT VR';

      const bRecenter = DOC.createElement('button');
      bRecenter.type = 'button';
      bRecenter.textContent = '🎯 RECENTER';

      btnWrap.appendChild(bEnter);
      btnWrap.appendChild(bExit);
      if(CFG.recenter) btnWrap.appendChild(bRecenter);

      root.appendChild(btnWrap);

      S.btnEnter = bEnter;
      S.btnExit = bExit;
      S.btnRecenter = bRecenter;

      // bind buttons
      bEnter.addEventListener('click', ()=> enterVR(), {passive:true});
      bExit.addEventListener('click', ()=> exitVR(), {passive:true});
      bRecenter.addEventListener('click', ()=> recenter(), {passive:true});
    }

    DOC.body.appendChild(root);
    S.uiRoot = root;
    S.crosshairEl = ch;

    syncButtons();
  }

  // --------- A-Frame integration ---------
  function findScene(){
    // try cache
    if(S.scene && S.scene.isConnected) return S.scene;

    // prefer a-scene
    const sc = DOC.querySelector('a-scene');
    if(sc){
      S.scene = sc;
      return sc;
    }
    return null;
  }

  function enterVR(){
    try{
      const sc = findScene();
      if(sc && typeof sc.enterVR === 'function') sc.enterVR();
    }catch{}
  }

  function exitVR(){
    try{
      const sc = findScene();
      if(sc && typeof sc.exitVR === 'function') sc.exitVR();
    }catch{}
  }

  function recenter(){
    // For A-Frame: try to "reset" camera rig yaw by toggling look-controls
    try{
      const cam = DOC.querySelector('a-camera');
      if(cam){
        const lc = cam.components && cam.components['look-controls'];
        if(lc && typeof lc.resetOrientation === 'function'){
          lc.resetOrientation();
          return;
        }
      }
    }catch{}

    // fallback: emit a custom event so games can hook it
    try{ ROOT.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'vr-ui' } })); }catch{}
  }

  function syncButtons(){
    // best-effort: show/hide exit depending on VR state
    const inVr = !!S.inVR;
    if(S.btnExit) S.btnExit.style.display = inVr ? 'inline-flex' : 'none';
    if(S.btnEnter) S.btnEnter.style.display = inVr ? 'none' : 'inline-flex';
  }

  function bindSceneEvents(){
    const sc = findScene();
    if(!sc || sc.__hhaVrBound) return;
    sc.__hhaVrBound = true;

    // A-Frame emits "enter-vr" / "exit-vr"
    sc.addEventListener('enter-vr', ()=>{
      S.inVR = true;
      syncButtons();
    });
    sc.addEventListener('exit-vr', ()=>{
      S.inVR = false;
      syncButtons();
    });

    // initial heuristic
    try{
      // if scene has renderer and is in vr mode
      S.inVR = !!(sc.is('vr-mode'));
    }catch{}
    syncButtons();
  }

  // --------- Shooting (tap/click/space) ---------
  function centerXY(){
    // center of viewport
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pointerXY(ev){
    // support pointer/touch/mouse
    if(!ev) return centerXY();

    // touches
    const te = ev.touches && ev.touches[0];
    if(te && isFinite(te.clientX) && isFinite(te.clientY)){
      return { x: te.clientX, y: te.clientY };
    }

    // changedTouches
    const ce = ev.changedTouches && ev.changedTouches[0];
    if(ce && isFinite(ce.clientX) && isFinite(ce.clientY)){
      return { x: ce.clientX, y: ce.clientY };
    }

    // mouse/pointer
    const x = Number(ev.clientX), y = Number(ev.clientY);
    if(isFinite(x) && isFinite(y)) return { x, y };

    return centerXY();
  }

  function shouldCenterShoot(){
    // cVR strict OR config override
    return CFG.alwaysCenter || IS_CVR || S.inVR;
  }

  function onPointerDown(ev){
    // Don't block UI buttons; those are pointer-events:auto inside root
    // But document pointerdown will still fire; check composedPath
    try{
      const path = ev.composedPath ? ev.composedPath() : [];
      for(const n of path){
        if(n && n.id === 'hha-vrui') return; // clicking on our overlay buttons
      }
    }catch{}

    // In gameplay, we want shooting anywhere:
    // - cVR/VR: always shoot from center
    // - PC/mobile: shoot from click position (helps "tap target" style)
    const p = shouldCenterShoot() ? centerXY() : pointerXY(ev);
    emitShoot(p.x, p.y, 'pointerdown');
  }

  function onKeyDown(ev){
    const k = String(ev.key||'').toLowerCase();
    if(k === ' ' || k === 'spacebar' || k === 'enter'){
      const p = centerXY();
      emitShoot(p.x, p.y, 'key');
    }
  }

  function bindInputs(){
    if(DOC.__hhaVruiInputBound) return;
    DOC.__hhaVruiInputBound = true;

    // pointerdown better than click on mobile
    DOC.addEventListener('pointerdown', onPointerDown, { passive:false });
    DOC.addEventListener('keydown', onKeyDown, { passive:true });
  }

  // --------- Boot ---------
  function boot(){
    mountUI();
    bindInputs();
    bindSceneEvents();

    // if scene loads later
    let tries = 0;
    const timer = setInterval(()=>{
      tries++;
      bindSceneEvents();
      if(findScene() || tries > 60) clearInterval(timer);
    }, 250);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();