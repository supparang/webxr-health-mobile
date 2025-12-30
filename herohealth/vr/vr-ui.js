/* === /herohealth/vr/vr-ui.js ===
Universal VR UI — Enter/Exit/Reset + Crosshair + Tap-to-shoot
✅ Works with A-Frame if present, but does NOT require A-Frame
✅ Emits:
  - hha:shoot  {x,y,lockPx,source}
  - hha:vr     {state:'reset'}
Usage:
  <script src="../vr/vr-ui.js" defer></script>
  (optional) set <body class="view-cvr"> to enable cardboard mode (targets pointer-events disabled)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const emit = (name, detail)=>{
    try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{}
  };

  function qs(sel, parent){ return (parent||DOC).querySelector(sel); }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  // --------- DOM: inject UI ----------
  function ensureUI(){
    let ui = qs('.hha-vr-ui');
    if (ui) return ui;

    ui = DOC.createElement('div');
    ui.className = 'hha-vr-ui';
    ui.innerHTML = `
      <div class="hha-vr-ui-left">
        <button class="hha-btn hha-enter" type="button">ENTER VR</button>
        <button class="hha-btn hha-exit" type="button" style="display:none;">EXIT</button>
      </div>
      <div class="hha-vr-ui-right">
        <button class="hha-btn hha-reset" type="button" title="Recenter">RECENTER</button>
      </div>

      <div class="hha-crosshair" aria-hidden="true">
        <div class="hha-dot"></div>
        <div class="hha-ring"></div>
      </div>
      <div class="hha-tap-hint" aria-hidden="true">แตะ/คลิกเพื่อยิง 🎯</div>
    `;
    DOC.body.appendChild(ui);

    // styles (lightweight, no external css required)
    const st = DOC.createElement('style');
    st.textContent = `
      .hha-vr-ui{ position:fixed; inset:0; pointer-events:none; z-index:999; }
      .hha-vr-ui-left,.hha-vr-ui-right{ position:fixed; top:calc(10px + env(safe-area-inset-top,0px)); display:flex; gap:8px; pointer-events:auto; }
      .hha-vr-ui-left{ left:calc(10px + env(safe-area-inset-left,0px)); }
      .hha-vr-ui-right{ right:calc(10px + env(safe-area-inset-right,0px)); }
      .hha-btn{
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.65);
        color:rgba(226,232,240,.95);
        font:900 12px/1.1 system-ui,-apple-system,Segoe UI,sans-serif;
        padding:10px 12px;
        border-radius:14px;
        box-shadow:0 14px 40px rgba(0,0,0,.35);
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .hha-btn:active{ transform:scale(.98); filter:brightness(1.06); }

      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        transform:translate(-50%,-50%);
        width:44px; height:44px;
        pointer-events:none;
        opacity:.92;
        filter: drop-shadow(0 10px 20px rgba(0,0,0,.35));
      }
      .hha-dot{
        position:absolute; left:50%; top:50%;
        width:6px; height:6px; border-radius:999px;
        background:rgba(255,255,255,.95);
        transform:translate(-50%,-50%);
        box-shadow:0 0 0 2px rgba(2,6,23,.40);
      }
      .hha-ring{
        position:absolute; inset:0;
        border-radius:999px;
        border:2px solid rgba(255,255,255,.35);
        box-shadow:0 0 0 2px rgba(2,6,23,.25) inset;
      }

      .hha-tap-hint{
        position:fixed; left:50%; bottom:calc(14px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        font:900 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;
        color:rgba(226,232,240,.90);
        background:rgba(2,6,23,.55);
        border:1px solid rgba(148,163,184,.18);
        padding:8px 10px;
        border-radius:999px;
        pointer-events:none;
        opacity:.0;
        transition: opacity .25s ease;
      }
      body.view-cvr .hha-tap-hint{ opacity:.95; }
      body.view-vr  .hha-tap-hint{ opacity:.0; }

      /* small screens: compact */
      @media (max-width:520px){
        .hha-btn{ padding:9px 10px; border-radius:13px; }
      }
    `;
    DOC.head.appendChild(st);

    return ui;
  }

  // --------- VR helpers ----------
  function isFs(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }
  async function enterFs(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }catch{}
  }
  async function exitFs(){
    try{
      if (DOC.exitFullscreen) await DOC.exitFullscreen();
      else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
    }catch{}
  }

  function tryAFrameEnterVR(){
    const scene = qs('a-scene');
    const af = scene && scene.components && scene.components['vr-mode-ui'];
    // Most A-Frame scenes can enter VR via scene.enterVR()
    try{
      if (scene && typeof scene.enterVR === 'function'){ scene.enterVR(); return true; }
    }catch{}
    // fallback: try XR button (if exists)
    const btn = qs('.a-enter-vr-button') || qs('.a-enter-ar-button');
    if (btn){ btn.click(); return true; }
    return false;
  }
  function tryAFrameExitVR(){
    const scene = qs('a-scene');
    try{
      if (scene && typeof scene.exitVR === 'function'){ scene.exitVR(); return true; }
    }catch{}
    return false;
  }

  // --------- Shoot (tap/space) ----------
  function centerPoint(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;
    return { x: W*0.5, y: H*0.5 };
  }

  function fireShoot(source){
    const p = centerPoint();
    const lockPx = clamp(Number(root.HHA_LOCKPX || 92), 40, 160);
    emit('hha:shoot', { x:p.x, y:p.y, lockPx, source: source || 'tap' });
  }

  function bindShootOnce(){
    if (bindShootOnce._done) return;
    bindShootOnce._done = true;

    // Cardboard mode: tap anywhere shoots (targets are pointer-events:none via CSS)
    DOC.addEventListener('pointerdown', (e)=>{
      // ignore if clicking UI buttons
      const t = e.target;
      if (t && t.closest && t.closest('.hha-vr-ui-left, .hha-vr-ui-right')) return;

      if (DOC.body.classList.contains('view-cvr')){
        fireShoot('cvr-tap');
      }
    }, { passive:true });

    // keyboard
    DOC.addEventListener('keydown', (e)=>{
      if (e.code === 'Space' || e.key === ' '){
        fireShoot('space');
      }
      if (e.code === 'KeyR'){
        emit('hha:vr', { state:'reset' });
      }
    }, { passive:true });
  }

  // --------- Bind UI ----------
  function bindUI(){
    const ui = ensureUI();
    const btnEnter = qs('.hha-enter', ui);
    const btnExit  = qs('.hha-exit', ui);
    const btnReset = qs('.hha-reset', ui);

    function syncButtons(inVR){
      btnEnter.style.display = inVR ? 'none' : 'inline-flex';
      btnExit.style.display  = inVR ? 'inline-flex' : 'none';
    }

    btnEnter.addEventListener('click', async ()=>{
      // For phone/cardboard: go fullscreen helps a lot
      await enterFs();
      // Try A-Frame VR if available; still ok if not present
      const ok = tryAFrameEnterVR();
      // If no A-Frame, just switch to cardboard view so user can shoot center
      if (!ok){
        DOC.body.classList.add('view-cvr');
      }else{
        DOC.body.classList.add('view-vr');
      }
      syncButtons(true);
    });

    btnExit.addEventListener('click', async ()=>{
      tryAFrameExitVR();
      await exitFs();
      DOC.body.classList.remove('view-vr');
      // keep view-cvr if user wants, but default back to normal view
      DOC.body.classList.remove('view-cvr');
      syncButtons(false);
    });

    btnReset.addEventListener('click', ()=>{
      emit('hha:vr', { state:'reset' });
    });

    // sync on fullscreen / visibility
    DOC.addEventListener('fullscreenchange', ()=>{
      if (!isFs()){
        // leaving FS -> also leave VR UI mode
        DOC.body.classList.remove('view-vr');
        // do not force remove view-cvr; but safer to exit
        DOC.body.classList.remove('view-cvr');
        syncButtons(false);
      }
    });

    // initial
    syncButtons(false);
  }

  // boot
  function boot(){
    ensureUI();
    bindUI();
    bindShootOnce();
  }
  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();

})(typeof window !== 'undefined' ? window : globalThis);