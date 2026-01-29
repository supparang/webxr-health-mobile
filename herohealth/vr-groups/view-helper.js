// === /herohealth/vr-groups/view-helper.js ===
// View Helper — PRODUCTION (HHA Standard)
// ✅ init({view}) sets body class + safe viewport flags
// ✅ fullscreen + best-effort orientation lock (mobile/cVR)
// ✅ tryImmersiveForCVR(): attempt enter immersive-vr on user gesture
// ✅ applyCVRStrict(): disable pointer-events for targets; shooting only via crosshair (hha:shoot)
// ✅ emits: groups:view {view}
// Notes:
// - "cvr" = Cardboard-like (mobile, crosshair shooting)
// - This module is defensive: no-throw on unsupported APIs.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.ViewHelper && WIN.GroupsVR.ViewHelper.__loaded) return;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  const STATE = {
    view: 'pc',
    inited: false,
    strictApplied: false,
    gestureBound: false,
    lastFSAt: 0
  };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function isMobileUA(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua);
  }

  function isCoarsePointer(){
    try{ return matchMedia && matchMedia('(pointer: coarse)').matches; }
    catch{ return false; }
  }

  function likelyMobile(){
    return isMobileUA() || isCoarsePointer();
  }

  function normView(v){
    v = String(v||'').toLowerCase();
    if (v === 'vr') return 'vr';
    if (v === 'cvr') return 'cvr';
    if (v === 'mobile') return 'mobile';
    return 'pc';
  }

  function setBodyViewClass(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-'+view);

    // helpful flags
    b.classList.toggle('is-mobile', view==='mobile' || view==='cvr' || likelyMobile());
    b.classList.toggle('is-cvr', view==='cvr');
  }

  function emitView(view){
    try{
      WIN.dispatchEvent(new CustomEvent('groups:view', { detail:{ view } }));
    }catch(_){}
  }

  // ---------- Fullscreen + Orientation ----------
  async function requestFullscreen(){
    const t = Date.now();
    if (t - STATE.lastFSAt < 700) return false;
    STATE.lastFSAt = t;

    const el = DOC.documentElement;
    if (!el) return false;

    try{
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen){ await el.requestFullscreen(); return true; }
      // iOS Safari doesn't really support; ignore
      return false;
    }catch(_){
      return false;
    }
  }

  async function lockOrientationLandscape(){
    try{
      // Only if supported + usually must be fullscreen
      if (!screen || !screen.orientation || !screen.orientation.lock) return false;
      await screen.orientation.lock('landscape');
      return true;
    }catch(_){
      return false;
    }
  }

  async function bestEffortMobileUX(view){
    // For mobile + cvr, try fullscreen and landscape lock
    if (!(view==='mobile' || view==='cvr')) return;
    await requestFullscreen();
    await lockOrientationLandscape();
  }

  // ---------- cVR strict ----------
  function applyCVRStrict(root){
    // disables pointer events so taps do not click targets;
    // instead, shooting comes from vr-ui.js crosshair event hha:shoot
    try{
      const b = DOC.body;
      if (!b) return;
      b.classList.add('view-cvr-strict');

      // Root is usually #playLayer
      const host = root || DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;

      // disable pointer events in play layer
      if (host){
        host.style.pointerEvents = 'none';
        host.setAttribute('data-cvr-strict','1');
      }

      // BUT keep overlays clickable
      const allowSel = [
        '.overlay', '.overlay *',
        '.hud', '.hud *',
        '.questTop', '.questTop *',
        '.powerWrap', '.powerWrap *',
        '.coachWrap', '.coachWrap *',
        '#bigBanner', '#bigBanner *'
      ];
      allowSel.forEach(sel=>{
        const nodes = DOC.querySelectorAll(sel);
        nodes && nodes.forEach(n=>{
          try{ n.style.pointerEvents = 'auto'; }catch(_){}
        });
      });

      STATE.strictApplied = true;
    }catch(_){}
  }

  function removeCVRStrict(root){
    try{
      DOC.body && DOC.body.classList.remove('view-cvr-strict','view-cvr-strict');
      const host = root || DOC.getElementById('playLayer') || DOC.querySelector('.playLayer');
      if (host){
        host.style.pointerEvents = '';
        host.removeAttribute('data-cvr-strict');
      }
      STATE.strictApplied = false;
    }catch(_){}
  }

  // minimal css injection for strict
  function ensureCss(){
    if (DOC.getElementById('groupsViewHelperCss')) return;
    const st = DOC.createElement('style');
    st.id = 'groupsViewHelperCss';
    st.textContent = `
      /* cVR strict: targets should not capture taps */
      body.view-cvr .playLayer[data-cvr-strict="1"]{ pointer-events:none; }
      /* keep overlays interactive */
      body.view-cvr .hud,
      body.view-cvr .questTop,
      body.view-cvr .powerWrap,
      body.view-cvr .coachWrap,
      body.view-cvr #bigBanner,
      body.view-cvr .overlay { pointer-events:auto; }

      /* optional: reduce accidental selections */
      body.is-mobile *{ -webkit-tap-highlight-color: transparent; }
    `;
    DOC.head.appendChild(st);
  }

  // ---------- Try immersive for cVR ----------
  async function tryEnterImmersiveVR(){
    // best effort: click/tap must happen
    try{
      const scene = DOC.querySelector('a-scene');
      if (!scene) return false;

      // A-Frame 1.5: enterVR exists
      if (scene.enterVR){
        scene.enterVR();
        return true;
      }

      // fallback: WebXR session request (rarely needed here)
      const xr = navigator.xr;
      if (xr && xr.isSessionSupported){
        const ok = await xr.isSessionSupported('immersive-vr');
        if (ok && xr.requestSession){
          await xr.requestSession('immersive-vr', { optionalFeatures:['local-floor','bounded-floor'] });
          return true;
        }
      }
      return false;
    }catch(_){
      return false;
    }
  }

  function bindOneGestureForMobile(view){
    if (STATE.gestureBound) return;
    if (!(view==='mobile' || view==='cvr')) return;

    STATE.gestureBound = true;

    const onFirst = async ()=>{
      // run once
      DOC.removeEventListener('pointerdown', onFirst, true);
      DOC.removeEventListener('touchstart', onFirst, true);

      // best-effort UX
      await bestEffortMobileUX(view);

      // cVR: optionally try enter immersive if user uses Cardboard
      if (view==='cvr'){
        // do not force; allow vr-ui buttons to handle too
        // but we can attempt if "autoVR=1"
        const autoVR = String(qs('autoVR','0')||'0');
        if (autoVR==='1' || autoVR==='true'){
          await tryEnterImmersiveVR();
        }
      }
    };

    DOC.addEventListener('pointerdown', onFirst, true);
    DOC.addEventListener('touchstart', onFirst, true);
  }

  // ---------- Public API ----------
  function init(opts){
    opts = opts || {};
    const view = normView(opts.view || qs('view','') || (likelyMobile() ? 'mobile' : 'pc'));
    STATE.view = view;
    STATE.inited = true;

    ensureCss();
    setBodyViewClass(view);
    emitView(view);

    // bind gesture helpers for mobile/cvr
    bindOneGestureForMobile(view);

    // strict mode for cVR
    if (view === 'cvr'){
      applyCVRStrict(opts.layerEl || null);
    }else{
      removeCVRStrict(opts.layerEl || null);
    }

    return view;
  }

  function tryImmersiveForCVR(){
    // called by run page after engine start
    if (STATE.view !== 'cvr') return false;
    // best effort; must be from user gesture ideally
    return tryEnterImmersiveVR();
  }

  function getView(){
    return STATE.view;
  }

  WIN.GroupsVR.ViewHelper = {
    __loaded: true,
    init,
    getView,
    applyCVRStrict,
    removeCVRStrict,
    requestFullscreen,
    lockOrientationLandscape,
    tryImmersiveForCVR
  };

})();