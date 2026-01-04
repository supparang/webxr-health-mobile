// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION
// ✅ Adds: ENTER VR / EXIT / RECENTER buttons
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
  const qs = (s)=>DOC.querySelector(s);

  function getView(){
    try{
      const v = new URL(location.href).searchParams.get('view');
      return (v||'').toLowerCase();
    }catch(_){ return ''; }
  }
  function inCVR(){ return getView() === 'cvr' || DOC.body.classList.contains('view-cvr'); }
  function inVR(){ return DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr') || DOC.body.classList.contains('in-vr'); }

  function emitShoot(x,y, source){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', { detail:{
        x, y,
        lockPx: CFG.lockPx,
        source: source || (inCVR() ? 'cvr' : 'tap')
      }}));
    }catch(_){}
  }

  // ---------- UI Layer ----------
  function ensureStyle(){
    if(DOC.getElementById('hha-vrui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      .hha-vrui{
        position:fixed; inset:0; pointer-events:none; z-index:120;
        font-family:system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
      }
      .hha-vrui .bar{
        position:fixed; left:10px; top:10px;
        display:flex; gap:8px; flex-wrap:wrap;
        pointer-events:none;
      }
      .hha-vrui .btn{
        pointer-events:auto;
        appearance:none; border:none;
        border-radius:999px;
        padding:10px 12px;
        background:rgba(2,6,23,.70);
        border:1px solid rgba(148,163,184,.20);
        color:rgba(229,231,235,.95);
        font: 1000 12px/1 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
        box-shadow: 0 16px 40px rgba(0,0,0,.32);
        backdrop-filter: blur(10px);
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        user-select:none;
      }
      .hha-vrui .btn:active{ transform: translateY(1px); }

      /* crosshair */
      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        width:26px; height:26px;
        transform:translate(-50%,-50%);
        pointer-events:none;
        opacity:.95;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,.45));
      }
      .hha-crosshair:before,
      .hha-crosshair:after{
        content:'';
        position:absolute; left:50%; top:50%;
        background:rgba(229,231,235,.92);
        transform:translate(-50%,-50%);
        border-radius:2px;
      }
      .hha-crosshair:before{ width:18px; height:2px; }
      .hha-crosshair:after { width:2px; height:18px; }

      .hha-vrui .hint{
        position:fixed; left:50%; bottom:14px;
        transform:translateX(-50%);
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        color:rgba(229,231,235,.92);
        padding:8px 10px;
        border-radius:999px;
        font-weight:900;
        font-size:12px;
        pointer-events:none;
        opacity:.0;
        transition: opacity .18s ease;
      }
      .hha-vrui.show-hint .hint{ opacity:1; }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUI(){
    ensureStyle();
    let root = qs('.hha-vrui');
    if(root) return root;

    root = DOC.createElement('div');
    root.className = 'hha-vrui';

    const bar = DOC.createElement('div');
    bar.className = 'bar';

    const bEnter = DOC.createElement('button');
    bEnter.className = 'btn';
    bEnter.type = 'button';
    bEnter.textContent = '🕶 ENTER VR';

    const bExit = DOC.createElement('button');
    bExit.className = 'btn';
    bExit.type = 'button';
    bExit.textContent = '🚪 EXIT';

    const bRecenter = DOC.createElement('button');
    bRecenter.className = 'btn';
    bRecenter.type = 'button';
    bRecenter.textContent = '🎯 RECENTER';

    bar.appendChild(bEnter);
    bar.appendChild(bExit);
    bar.appendChild(bRecenter);

    const cross = DOC.createElement('div');
    cross.className = 'hha-crosshair';

    const hint = DOC.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'ยิงจากจุดกากบาทกลางจอ (cVR)';

    root.appendChild(bar);
    root.appendChild(cross);
    root.appendChild(hint);

    DOC.body.appendChild(root);

    return { root, bEnter, bExit, bRecenter, cross, hint };
  }

  const UI = ensureUI();
  const scene = ()=>DOC.querySelector('a-scene');

  function setHint(on){
    try{
      UI.root.classList.toggle('show-hint', !!on);
    }catch(_){}
  }

  // ---------- VR controls ----------
  function enterVR(){
    try{
      const sc = scene();
      if(sc && typeof sc.enterVR === 'function') sc.enterVR();
    }catch(_){}
  }
  function exitVR(){
    try{
      const sc = scene();
      if(sc && typeof sc.exitVR === 'function') sc.exitVR();
    }catch(_){}
  }
  function recenter(){
    try{
      // A-Frame: try camera rig reset
      const rig = DOC.getElementById('rig');
      if(rig){
        rig.setAttribute('position', '0 0 0');
        rig.setAttribute('rotation', '0 0 0');
      }
      WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'vr-ui' }}));
    }catch(_){}
  }

  UI.bEnter.addEventListener('click', enterVR, { passive:true });
  UI.bExit.addEventListener('click', exitVR, { passive:true });
  UI.bRecenter.addEventListener('click', recenter, { passive:true });

  // ---------- Crosshair + tap-to-shoot ----------
  let lastShootMs = 0;
  function canShoot(){
    const t = (WIN.performance && performance.now) ? performance.now() : Date.now();
    if(t - lastShootMs < (CFG.cooldownMs||90)) return false;
    lastShootMs = t;
    return true;
  }

  function shootFromCenter(){
    if(!canShoot()) return;
    const x = (WIN.innerWidth || 360) / 2;
    const y = (WIN.innerHeight || 640) / 2;
    emitShoot(x, y, 'crosshair');
  }

  // On pointer/tap: in cVR strict -> always shoot from center
  WIN.addEventListener('pointerdown', (e)=>{
    // ignore clicks on buttons
    const t = e && e.target;
    if(t && t.closest && t.closest('.hha-vrui .btn')) return;

    if(inCVR() || inVR()){
      e.preventDefault();
      shootFromCenter();
      return;
    }

    // normal mobile: shoot at tap point (still helps lockPx)
    if(!canShoot()) return;
    const x = Number(e.clientX)||((WIN.innerWidth||360)/2);
    const y = Number(e.clientY)||((WIN.innerHeight||640)/2);
    emitShoot(x, y, 'tap');
  }, { passive:false });

  // ---------- show crosshair when cVR/VR ----------
  function refresh(){
    const show = (inCVR() || inVR());
    UI.cross.style.display = show ? 'block' : 'none';
    setHint(inCVR());
  }
  refresh();
  WIN.addEventListener('hashchange', refresh, { passive:true });
  WIN.addEventListener('popstate', refresh, { passive:true });
  WIN.addEventListener('resize', refresh, { passive:true });

  // detect A-Frame VR state toggles
  WIN.addEventListener('enter-vr', ()=>{
    DOC.body.classList.add('in-vr');
    refresh();
  });
  WIN.addEventListener('exit-vr', ()=>{
    DOC.body.classList.remove('in-vr');
    refresh();
  });

})();