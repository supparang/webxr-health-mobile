// === /herohealth/vr-groups/view-helper.js ===
// GroupsVR View Helper — PRODUCTION (PATCH v20260208c)
// ✅ Sets body class: view-pc | view-mobile | view-vr | view-cvr
// ✅ Fullscreen + orientation helper (mobile/cVR friendly)
// ✅ cVR strict: keeps playLayer tappable + avoids HUD blocking critical area
// ✅ Adds CSS vars: --hha-hud-top, --hha-hud-safeTop, --hha-hud-safeBot
// ✅ Optional: tryImmersiveForCVR() (best-effort; safe no-op if unsupported)
// API: window.GroupsVR.ViewHelper.init({ view }), .tryImmersiveForCVR()

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};

  const S = {
    inited:false,
    view:'mobile',
    lastApplyAt:0
  };

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function setBodyView(view){
    view = String(view||'mobile').toLowerCase();
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
    S.view = view;
  }

  function isTouch(){
    return ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
  }

  function detectViewFallback(){
    // honor explicit ?view=
    const qv = String(qs('view','')||'').toLowerCase();
    if (qv === 'pc' || qv === 'mobile' || qv === 'vr' || qv === 'cvr') return qv;

    // basic fallback (no override rules elsewhere; this is only if missing)
    const w = WIN.innerWidth||360;
    const h = WIN.innerHeight||640;
    const small = Math.min(w,h) <= 540;
    if (small && isTouch()) return 'mobile';
    return 'pc';
  }

  // ---------------- Safe area + HUD space ----------------
  function applySafeAreaVars(){
    const b = DOC.body;

    // Top HUD height estimate (we’ll measure if possible)
    let hudTop = 0;
    try{
      const hud = DOC.querySelector('.hud');
      if (hud && hud.getBoundingClientRect){
        const r = hud.getBoundingClientRect();
        // if hud is positioned at top, use its bottom as reserved top space
        if (r.top <= 4) hudTop = Math.max(0, Math.round(r.bottom));
      }
    }catch(_){}

    // Additional padding so targets do not spawn under the HUD
    // (This is the #1 reason "good expired" spikes: target is under HUD, can't hit.)
    const extraTop = (S.view==='pc') ? 8 : 14;
    hudTop = Math.max(hudTop, (S.view==='pc') ? 56 : 64) + extraTop;

    // Bottom reserved for mobile browser bars / XR UI
    const extraBot = (S.view==='pc') ? 8 : 14;
    const hudBot = (S.view==='pc') ? 18 : 24;
    const safeBot = hudBot + extraBot;

    b.style.setProperty('--hha-hud-top', String(hudTop)+'px');
    b.style.setProperty('--hha-hud-safeTop', String(hudTop)+'px');
    b.style.setProperty('--hha-hud-safeBot', String(safeBot)+'px');
  }

  // ---------------- Prevent HUD blocking shots ----------------
  function makeHudPassThrough(pass){
    // In cVR, user taps anywhere; HUD should NOT eat taps.
    // We keep buttons clickable via pointer-events on inner controls (if any).
    const hud = DOC.querySelector('.hud');
    const questTop = DOC.querySelector('.questTop');
    const powerWrap = DOC.querySelector('.powerWrap');
    const coachWrap = DOC.querySelector('.coachWrap');

    const on = !!pass;

    const set = (el, css)=>{
      if(!el) return;
      el.style.pointerEvents = css;
    };

    if (on){
      set(hud, 'none');
      set(questTop, 'none');
      set(powerWrap, 'none');
      set(coachWrap, 'none');
    }else{
      set(hud, '');
      set(questTop, '');
      set(powerWrap, '');
      set(coachWrap, '');
    }

    // BUT: allow end overlay buttons as usual
    // (end overlay has its own pointer-events)
  }

  // ---------------- Fullscreen + orientation helpers ----------------
  async function tryFullscreen(){
    // best effort
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen){
        await el.requestFullscreen();
        return true;
      }
    }catch(_){}
    return false;
  }

  function tryLockOrientationLandscape(){
    // best effort; ignore failures
    try{
      const so = screen.orientation;
      if (so && so.lock){
        // cVR often works better in landscape
        return so.lock('landscape').catch(()=>{});
      }
    }catch(_){}
  }

  // ---------------- XR / immersive hint for cVR ----------------
  function tryImmersiveForCVR(){
    // We don’t force Enter VR (vr-ui.js controls that),
    // but we can: fullscreen + orientation lock to reduce UX friction.
    if (S.view !== 'cvr') return;
    tryFullscreen();
    tryLockOrientationLandscape();
  }

  // ---------------- Keep playLayer clickable / spawn-safe ----------------
  function applyPlayLayerPolicy(){
    // We push playLayer to respect safe areas via padding using CSS vars.
    // This doesn't move the actual layer element size; it’s used by CSS
    // and by the engine's getBoundingClientRect (if playLayer has padding).
    try{
      const layer = DOC.getElementById('playLayer') || DOC.querySelector('.playLayer');
      if (!layer) return;

      // Make layer be the real spawn area; ensure it has padding space
      layer.style.position = layer.style.position || 'absolute';
      layer.style.inset = layer.style.inset || '0';

      // Use padding to reserve space so targets won't appear under HUD.
      // IMPORTANT: engine mkTarget() uses layer.getBoundingClientRect()
      // but NOT padding; however the visual area is clearer and we can also
      // rely on CSS (if you add it) to keep the wrap inside.
      layer.style.paddingTop = 'var(--hha-hud-safeTop)';
      layer.style.paddingBottom = 'var(--hha-hud-safeBot)';

      // Keep taps going to vr-ui crosshair shooter (hha:shoot)
      // by ensuring layer is not blocked.
      layer.style.pointerEvents = 'none'; // targets are inside wrap with pointer-events:auto
    }catch(_){}
  }

  // ---------------- Resize/orientation events ----------------
  function applyAll(){
    const t = nowMs();
    if ((t - S.lastApplyAt) < 80) return;
    S.lastApplyAt = t;

    applySafeAreaVars();
    applyPlayLayerPolicy();

    // In cVR: HUD pass-through
    makeHudPassThrough(S.view === 'cvr');
  }

  function init(opts){
    if (S.inited) return true;
    S.inited = true;

    const view = String((opts && opts.view) ? opts.view : detectViewFallback()).toLowerCase();
    setBodyView(view);

    // Apply immediately + on resize/orientation change
    applyAll();

    WIN.addEventListener('resize', applyAll, { passive:true });
    WIN.addEventListener('orientationchange', ()=>{
      setTimeout(applyAll, 140);
      setTimeout(applyAll, 420);
    }, { passive:true });

    // If vr-ui emits enter/exit events, update view
    WIN.addEventListener('hha:enter-vr', ()=>{
      // entering WebXR: treat as vr/cvr depending on query view
      const qv = String(qs('view', S.view)||S.view).toLowerCase();
      setBodyView(qv === 'cvr' ? 'cvr' : 'vr');
      applyAll();
    }, { passive:true });

    WIN.addEventListener('hha:exit-vr', ()=>{
      // back to requested non-vr view
      const qv = String(qs('view', 'mobile')||'mobile').toLowerCase();
      setBodyView(qv);
      applyAll();
    }, { passive:true });

    // Run a couple of delayed applies (mobile CSS may settle late)
    setTimeout(applyAll, 160);
    setTimeout(applyAll, 520);

    return true;
  }

  WIN.GroupsVR.ViewHelper = { init, tryImmersiveForCVR };
})();