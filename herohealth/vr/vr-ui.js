// === /herohealth/vr/vr-ui.js ===
// HeroHealth — Universal VR UI (PRODUCTION)
// ✅ Buttons: ENTER VR / EXIT / RECENTER
// ✅ Crosshair (for view-vr / view-cvr)
// ✅ Tap-to-shoot => dispatch CustomEvent('hha:shoot', {detail:{x,y,lockPx,source}})
// ✅ Emits: hha:enter_vr / hha:exit_vr / hha:recenter (for DOM-based games like GoodJunk)
// ✅ Optional A-Frame scene enterVR/exitVR/recenter best-effort
// ✅ Safe to include on every game page

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  if (root.__HHA_VR_UI_BOUND__) return;
  root.__HHA_VR_UI_BOUND__ = true;

  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  };

  function emit(type, detail){
    try{ root.dispatchEvent(new CustomEvent(type, { detail })); }catch(e){}
  }

  function emitShoot(detail){
    emit('hha:shoot', detail);
  }

  function getLockPx(){
    const cfg = root.HHA_VRUI_CONFIG || {};
    const v = Number(cfg.lockPx ?? 26) || 26;
    return clamp(v, 8, 240);
  }

  function ensureCss(){
    if (DOC.getElementById('hha-vr-ui-css')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vr-ui-css';
    st.textContent = `
      .hha-vrui{
        position:fixed; inset:0;
        pointer-events:none;
        z-index:95;
      }
      .hha-vrui .panel{
        position:absolute;
        right:12px;
        bottom:calc(12px + env(safe-area-inset-bottom,0px));
        display:flex;
        gap:8px;
        pointer-events:auto;
      }
      .hha-vrui .btn{
        appearance:none;
        border:none;
        border-radius:999px;
        padding:10px 12px;
        background:rgba(2,6,23,.70);
        border:1px solid rgba(148,163,184,.20);
        color:rgba(229,231,235,.95);
        font: 1000 12px/1 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        box-shadow:0 16px 40px rgba(0,0,0,.32);
        backdrop-filter: blur(10px);
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .hha-vrui .btn:active{ transform: translateY(1px); }
      .hha-vrui .btn.primary{
        background:rgba(34,197,94,.14);
        border-color:rgba(34,197,94,.30);
      }
      .hha-vrui .btn.warn{
        background:rgba(245,158,11,.14);
        border-color:rgba(245,158,11,.30);
      }
      .hha-crosshair{
        position:absolute;
        left:50%; top:50%;
        width:22px; height:22px;
        transform:translate(-50%,-50%);
        border-radius:999px;
        pointer-events:none;
        opacity:.0;
        transition: opacity .12s ease;
        z-index:96;
      }
      .hha-crosshair::before,
      .hha-crosshair::after{
        content:"";
        position:absolute;
        left:50%; top:50%;
        background:rgba(229,231,235,.92);
        transform:translate(-50%,-50%);
        border-radius:2px;
      }
      .hha-crosshair::before{ width:16px; height:2px; }
      .hha-crosshair::after{ width:2px; height:16px; }
      .hha-crosshair .dot{
        position:absolute;
        left:50%; top:50%;
        width:4px; height:4px;
        transform:translate(-50%,-50%);
        border-radius:999px;
        background:rgba(34,197,94,.85);
        box-shadow:0 0 0 4px rgba(34,197,94,.12);
      }

      /* show crosshair on view-vr / view-cvr */
      body.view-vr .hha-crosshair,
      body.view-cvr .hha-crosshair{ opacity:.92; }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUi(){
    let wrap = DOC.querySelector('.hha-vrui');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'hha-vrui';

    const cross = DOC.createElement('div');
    cross.className = 'hha-crosshair';
    cross.innerHTML = `<div class="dot"></div>`;

    const panel = DOC.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <button class="btn primary" data-act="enter" data-vrui="enter-vr">🕶 ENTER VR</button>
      <button class="btn" data-act="exit" data-vrui="exit-vr">🚪 EXIT</button>
      <button class="btn warn" data-act="recenter" data-vrui="recenter">🎯 RECENTER</button>
    `;

    wrap.appendChild(cross);
    wrap.appendChild(panel);
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function getScene(){
    return DOC.querySelector('a-scene');
  }

  function enterVR(){
    try{
      // notify DOM-based games (GoodJunk/Hydration DOM/etc.)
      emit('hha:enter_vr');

      // if A-Frame scene exists, also enter WebXR
      const scene = getScene();
      if (scene && typeof scene.enterVR === 'function') scene.enterVR();
    }catch(e){}
  }

  function exitVR(){
    try{
      emit('hha:exit_vr');
      const scene = getScene();
      if (scene && typeof scene.exitVR === 'function') scene.exitVR();
    }catch(e){}
  }

  function recenter(){
    // notify games first
    emit('hha:recenter');

    // best-effort across A-Frame versions
    try{
      const scene = getScene();
      const cam = scene ? (scene.camera && scene.camera.el ? scene.camera.el : scene.querySelector('[camera]')) : null;
      if (cam && cam.components && cam.components['look-controls']){
        const lc = cam.components['look-controls'];
        if (typeof lc.resetOrientation === 'function') lc.resetOrientation();
        if (lc.yawObject && lc.yawObject.rotation) lc.yawObject.rotation.y = 0;
        if (lc.pitchObject && lc.pitchObject.rotation) lc.pitchObject.rotation.x = 0;
      }
      if (cam) cam.setAttribute('rotation', '0 0 0');
      const rig = DOC.querySelector('#rig');
      if (rig) rig.setAttribute('rotation', '0 0 0');
    }catch(e){}
  }

  function bindButtons(wrap){
    const panel = wrap.querySelector('.panel');
    if(!panel) return;

    panel.addEventListener('click', (e)=>{
      const btn = e.target && e.target.closest('button[data-act]');
      if(!btn) return;
      const act = btn.getAttribute('data-act');
      if(act === 'enter') enterVR();
      else if(act === 'exit') exitVR();
      else if(act === 'recenter') recenter();
    }, { passive:true });
  }

  function bindTapToShoot(){
    DOC.addEventListener('pointerdown', (e)=>{
      const uiBtn = e.target && e.target.closest('.hha-vrui .panel button');
      if (uiBtn) return;

      const W = root.innerWidth || 360;
      const H = root.innerHeight || 640;

      emitShoot({ x:W/2, y:H/2, lockPx:getLockPx(), source:'tap' });
    }, { passive:true });

    // A-Frame controller triggerdown -> shoot (if present)
    DOC.addEventListener('triggerdown', ()=>{
      const W = root.innerWidth || 360;
      const H = root.innerHeight || 640;
      emitShoot({ x:W/2, y:H/2, lockPx:getLockPx(), source:'trigger' });
    }, { passive:true });
  }

  function syncButtonsVisibility(){
    const wrap = DOC.querySelector('.hha-vrui');
    if(!wrap) return;

    const scene = getScene();
    const panel = wrap.querySelector('.panel');
    if(!panel) return;

    // If no a-scene, still show buttons (DOM games use events).
    // So: keep panel visible always.
    panel.style.display = 'flex';
  }

  // ---------------- init ----------------
  ensureCss();
  const wrap = ensureUi();
  bindButtons(wrap);
  bindTapToShoot();
  syncButtonsVisibility();

  root.addEventListener('resize', ()=>{}, { passive:true });

})(window);