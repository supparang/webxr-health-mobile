// === /herohealth/vr/vr-ui.js ===
// HeroHealth — Universal VR UI (PRODUCTION++ PATCH)
// ✅ Buttons: ENTER VR / EXIT / RECENTER (A-Frame only)
// ✅ Crosshair (for view-vr / view-cvr)
// ✅ Tap-to-shoot => dispatch CustomEvent('hha:shoot', {detail:{x,y,lockPx,source,view,ts}})
// ✅ Fires ONLY in view-vr/view-cvr by default (prevents double-action in mobile/pc)
// ✅ Auto-avoid overlap with #hudBtns when present
// ✅ Uses window.HHA_VRUI_CONFIG.lockPx (+ optional perDiffLockPx map)
// ✅ Soft cooldown to prevent double fire
// ✅ Safe to include on every game page

(function (root) {
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  if (root.__HHA_VR_UI_BOUND__) return;
  root.__HHA_VR_UI_BOUND__ = true;

  const qs = (sel) => DOC.querySelector(sel);

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function bodyHas(cls){
    return DOC.body && DOC.body.classList && DOC.body.classList.contains(cls);
  }

  function getView(){
    // priority: body class
    if (bodyHas('view-cvr')) return 'cvr';
    if (bodyHas('view-vr')) return 'vr';
    if (bodyHas('view-cardboard')) return 'cardboard';
    if (bodyHas('view-pc')) return 'pc';
    if (bodyHas('view-mobile')) return 'mobile';
    // fallback: query param
    try{
      const v = new URL(location.href).searchParams.get('view');
      return (v||'').toLowerCase() || 'unknown';
    }catch(e){ return 'unknown'; }
  }

  function getDiff(){
    try{
      return (new URL(location.href).searchParams.get('diff') || '').toLowerCase();
    }catch(e){ return ''; }
  }

  function getCfg(){
    const c = root.HHA_VRUI_CONFIG || {};
    const diff = getDiff();

    // base lockPx
    let lockPx = Math.max(8, Number(c.lockPx || 26) || 26);

    // optional per-diff override
    // example:
    // window.HHA_VRUI_CONFIG = { perDiffLockPx:{ easy:30, normal:26, hard:22 } }
    if (c.perDiffLockPx && typeof c.perDiffLockPx === 'object'){
      const v = c.perDiffLockPx[diff];
      if (v != null) lockPx = Math.max(8, Number(v) || lockPx);
    }

    return {
      lockPx,
      cooldownMs: Math.max(0, Number(c.cooldownMs || 90) || 90),
      // ✅ NEW: enable shoot in non-vr views (default false)
      allowShootInAllViews: !!c.allowShootInAllViews,
      // ✅ NEW: if true, also allow shoot in cardboard view even without view-cvr/view-vr class
      allowShootInCardboard: (c.allowShootInCardboard == null) ? true : !!c.allowShootInCardboard,
      // ✅ NEW: selector list to ignore for shooting (targets, inputs, etc.)
      ignoreShootSelectors: Array.isArray(c.ignoreShootSelectors) ? c.ignoreShootSelectors : [],
    };
  }

  function emitShoot(detail){
    try{
      root.dispatchEvent(new CustomEvent('hha:shoot', { detail }));
    }catch(e){}
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
        bottom:calc(12px + env(safe-area-inset-bottom,0px) + var(--hha-vrui-lift, 0px));
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
      <button class="btn primary" data-act="enter" type="button">🕶 ENTER VR</button>
      <button class="btn" data-act="exit" type="button">🚪 EXIT</button>
      <button class="btn warn" data-act="recenter" type="button">🎯 RECENTER</button>
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
      const scene = getScene();
      if (scene && typeof scene.enterVR === 'function') scene.enterVR();
      // after enterVR, viewport/layout often changes; nudge reflow for pages that care
      try{ root.dispatchEvent(new CustomEvent('hha:vrui', { detail:{ type:'enter' } })); }catch(e){}
    }catch(e){}
  }
  function exitVR(){
    try{
      const scene = getScene();
      if (scene && typeof scene.exitVR === 'function') scene.exitVR();
      try{ root.dispatchEvent(new CustomEvent('hha:vrui', { detail:{ type:'exit' } })); }catch(e){}
    }catch(e){}
  }
  function recenter(){
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
      try{ root.dispatchEvent(new CustomEvent('hha:vrui', { detail:{ type:'recenter' } })); }catch(e){}
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

  function shouldShootNow(e){
    const cfg = getCfg();
    const view = getView();

    // ✅ default: only shoot in vr/cvr (prevents double action on mobile/pc)
    if(!cfg.allowShootInAllViews){
      const okVR = (view === 'vr' || view === 'cvr');
      const okCB = (cfg.allowShootInCardboard && view === 'cardboard');
      if(!okVR && !okCB) return false;
    }

    // don't shoot when clicking UI buttons or form elements
    if (e && e.target){
      if (e.target.closest('.hha-vrui .panel button')) return false;
      if (e.target.closest('button, a, input, textarea, select, label')) return false;

      // ignore custom selectors
      for(const sel of (cfg.ignoreShootSelectors || [])){
        try{ if(sel && e.target.closest(sel)) return false; }catch(_){}
      }

      // ✅ if NOT in cVR, and user clicked a known target element, don't also shoot
      // (goodjunk/plate/groups/hydration targets are usually buttons)
      if(view !== 'cvr' && view !== 'vr'){
        if(e.target.closest('.plateTarget, .target, .hha-target, .gj-target, .groupsTarget')) return false;
      }
    }

    return true;
  }

  function bindTapToShoot(){
    let lastFireAt = 0;

    DOC.addEventListener('pointerdown', (e)=>{
      if(!shouldShootNow(e)) return;

      const cfg = getCfg();
      const now = Date.now();
      if (now - lastFireAt < cfg.cooldownMs) return;
      lastFireAt = now;

      const W = root.innerWidth || 360;
      const H = root.innerHeight || 640;

      emitShoot({
        x: W/2,
        y: H/2,
        lockPx: cfg.lockPx,
        source:'tap',
        view: getView(),
        ts: now
      });
    }, { passive:true, capture:true });

    // controllers (best-effort; some runtimes don't emit this)
    DOC.addEventListener('triggerdown', ()=>{
      const cfg = getCfg();
      const now = Date.now();
      if (now - lastFireAt < cfg.cooldownMs) return;
      lastFireAt = now;

      const W = root.innerWidth || 360;
      const H = root.innerHeight || 640;

      emitShoot({
        x: W/2,
        y: H/2,
        lockPx: cfg.lockPx,
        source:'trigger',
        view: getView(),
        ts: now
      });
    }, { passive:true });
  }

  function syncButtonsVisibility(){
    const wrap = DOC.querySelector('.hha-vrui');
    if(!wrap) return;

    const scene = getScene();
    const panel = wrap.querySelector('.panel');
    if(!panel) return;

    // show buttons only on A-Frame pages (a-scene exists)
    panel.style.display = scene ? 'flex' : 'none';
  }

  // ✅ auto-lift panel if overlaps #hudBtns (per game)
  function avoidHudOverlap(){
    const wrap = DOC.querySelector('.hha-vrui');
    if(!wrap) return;
    const panel = wrap.querySelector('.panel');
    if(!panel) return;

    const hud = DOC.querySelector('#hudBtns');
    if(!hud){
      DOC.documentElement.style.setProperty('--hha-vrui-lift', '0px');
      return;
    }

    // defer a frame for accurate rects
    requestAnimationFrame(()=>{
      try{
        const pr = panel.getBoundingClientRect();
        const hr = hud.getBoundingClientRect();
        const overlap =
          !(pr.right < hr.left || hr.right < pr.left || pr.bottom < hr.top || hr.bottom < pr.top);

        if(!overlap){
          DOC.documentElement.style.setProperty('--hha-vrui-lift', '0px');
          return;
        }

        // lift panel above hud with margin
        const lift = Math.max(0, (pr.bottom - hr.top) + 10);
        DOC.documentElement.style.setProperty('--hha-vrui-lift', `${lift}px`);
      }catch(e){
        DOC.documentElement.style.setProperty('--hha-vrui-lift', '0px');
      }
    });
  }

  ensureCss();
  const wrap = ensureUi();
  bindButtons(wrap);
  bindTapToShoot();
  syncButtonsVisibility();
  avoidHudOverlap();

  // keep it stable on resize/orientation/visualViewport (EnterVR changes too)
  root.addEventListener('resize', avoidHudOverlap, { passive:true });
  root.addEventListener('orientationchange', avoidHudOverlap, { passive:true });
  if(root.visualViewport){
    root.visualViewport.addEventListener('resize', avoidHudOverlap, { passive:true });
    root.visualViewport.addEventListener('scroll', avoidHudOverlap, { passive:true });
  }
  root.addEventListener('hha:vrui', avoidHudOverlap, { passive:true });

})(window);