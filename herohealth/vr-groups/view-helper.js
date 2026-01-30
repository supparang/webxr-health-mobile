// === /herohealth/vr-groups/view-helper.js ===
// GroupsVR ViewHelper — PRODUCTION
// ✅ init({view}) : apply body class + safe-zone + input hints
// ✅ tryImmersiveForCVR(): fullscreen + best-effort landscape lock (Cardboard)
// ✅ measureSafe(): compute safe play area (avoid HUD/Quest/Power/Coach) + emit groups:safe
// ✅ no "override" of ?view — respects caller param
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  const VH = WIN.GroupsVR.ViewHelper = WIN.GroupsVR.ViewHelper || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function hasEl(sel){ try{ return !!DOC.querySelector(sel); }catch{ return false; } }
  function q(sel){ try{ return DOC.querySelector(sel); }catch{ return null; } }

  function setBodyView(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
  }

  // ---------------- Fullscreen / Orientation helpers ----------------
  async function requestFullscreen(){
    const el = DOC.documentElement || DOC.body;
    if (!el) return false;

    try{
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI:'hide' }); return true; }
    }catch(_){}
    return false;
  }

  async function lockLandscape(){
    try{
      const so = screen.orientation;
      if (so && so.lock) { await so.lock('landscape'); return true; }
    }catch(_){}
    return false;
  }

  function nudgeScrollTop(){
    // mobile Safari/Chrome address bar minimize
    try{ WIN.scrollTo(0, 0); }catch(_){}
  }

  // ---------------- Safe-zone measurement ----------------
  // We measure “avoid areas” from HUD/Quest/Power/Coach to help spawning & FX
  // and expose as CSS variables + event groups:safe
  function rectOf(el){
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    if (!isFinite(r.left+r.top+r.width+r.height)) return null;
    if (r.width <= 2 || r.height <= 2) return null;
    return r;
  }

  function measureSafe(){
    const vw = Math.max(320, WIN.innerWidth||360);
    const vh = Math.max(480, WIN.innerHeight||640);

    // baseline insets (small padding)
    let top = 10, left = 10, right = 10, bottom = 10;

    // avoid HUD (top left/right)
    const hud = q('.hud');
    const quest = q('.questTop');
    const power = q('.powerWrap');
    const coach = q('.coachWrap');
    const vrui = q('#hhaVrUi') || q('.hha-vrui') || q('#hha-vr-ui'); // best-effort

    const rh = rectOf(hud);
    const rq = rectOf(quest);
    const rp = rectOf(power);
    const rc = rectOf(coach);
    const rv = rectOf(vrui);

    // top avoid: max bottom of hud/quest
    const topAvoid = Math.max(
      rh ? rh.bottom : 0,
      rq ? rq.bottom : 0,
      rv ? rv.bottom : 0,
      92 // minimal top safe for notches/HUD
    );
    top = Math.max(top, Math.min(vh*0.45, topAvoid + 10));

    // bottom avoid: power/coach take space
    const bottomAvoid = Math.max(
      rp ? (vh - rp.top) : 0,
      rc ? (vh - rc.top) : 0,
      180
    );
    bottom = Math.max(bottom, Math.min(vh*0.55, bottomAvoid + 10));

    // left/right small insets
    left  = Math.max(left, 12);
    right = Math.max(right, 12);

    // clamp final safe rect
    const safe = {
      x: left,
      y: top,
      w: Math.max(120, vw - left - right),
      h: Math.max(160, vh - top - bottom),
      vw, vh,
      top, bottom, left, right
    };

    // expose css vars (optional use in CSS / engines)
    try{
      DOC.documentElement.style.setProperty('--hha-safe-x', safe.x + 'px');
      DOC.documentElement.style.setProperty('--hha-safe-y', safe.y + 'px');
      DOC.documentElement.style.setProperty('--hha-safe-w', safe.w + 'px');
      DOC.documentElement.style.setProperty('--hha-safe-h', safe.h + 'px');
      DOC.documentElement.style.setProperty('--hha-safe-top', safe.top + 'px');
      DOC.documentElement.style.setProperty('--hha-safe-bottom', safe.bottom + 'px');
    }catch(_){}

    emit('groups:safe', safe);
    return safe;
  }

  // throttled measure
  let _msrTmr = 0;
  function measureSafeSoon(){
    clearTimeout(_msrTmr);
    _msrTmr = setTimeout(measureSafe, 60);
  }

  // ---------------- Public API ----------------
  VH.init = function init(opts={}){
    const view = String(opts.view || qs('view','mobile') || 'mobile').toLowerCase();
    setBodyView(view);

    // tiny UX hints by view
    try{
      if (view === 'cvr'){
        DOC.body.classList.add('is-cvr');
        // keep targets clickable (do NOT disable pointer-events) because engine uses elementFromPoint.
        // vr-ui.js provides crosshair tap-to-shoot; we only help fullscreen/landscape.
      }else{
        DOC.body.classList.remove('is-cvr');
      }
    }catch(_){}

    // initial safe
    measureSafeSoon();

    // re-measure on resize/orientation changes
    WIN.addEventListener('resize', measureSafeSoon, { passive:true });
    WIN.addEventListener('orientationchange', ()=>{
      setTimeout(()=>{ nudgeScrollTop(); measureSafeSoon(); }, 80);
    }, { passive:true });

    // if FX pack exists and wants safe rect
    WIN.addEventListener('groups:safe', (ev)=>{
      try{
        const FX = WIN.GroupsVR && WIN.GroupsVR.EffectsPack;
        FX && FX.setSafeRect && FX.setSafeRect(ev.detail);
      }catch(_){}
    }, { passive:true });

    // allow external trigger
    WIN.addEventListener('groups:measureSafe', measureSafeSoon, { passive:true });

    return view;
  };

  VH.measureSafe = measureSafe;

  VH.tryImmersiveForCVR = async function tryImmersiveForCVR(){
    // Cardboard “feel”: fullscreen + landscape lock (best-effort)
    // Do not force WebXR enterVR here; vr-ui.js handles Enter VR button when supported.
    nudgeScrollTop();

    const fs = await requestFullscreen();
    const lk = await lockLandscape();

    // re-measure after transition
    setTimeout(()=>{ nudgeScrollTop(); measureSafeSoon(); }, 120);

    emit('groups:viewhelper', { kind:'cvr_immersive', fullscreen:!!fs, landscapeLock:!!lk });
    return { fullscreen:!!fs, landscapeLock:!!lk };
  };

})();