// === /herohealth/vr-groups/view-helper.js ===
// GroupsVR ViewHelper — PRODUCTION (PC/Mobile/VR/Cardboard)
// ✅ set view classes: view-pc/view-mobile/view-vr/view-cvr
// ✅ best-effort fullscreen + orientation lock (cVR/mobile)
// ✅ tryImmersiveForCVR(): request VR session (if supported) without hard fail
// ✅ safe-area + HUD safe-zone measurement helper
// ✅ never throw (SAFE)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.ViewHelper) return;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function isMobileUA(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua);
  }

  function prefersCoarsePointer(){
    try{
      return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    }catch(_){ return false; }
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if (v === 'pc' || v === 'desktop') return 'pc';
    if (v === 'mobile' || v === 'phone') return 'mobile';
    if (v === 'vr') return 'vr';
    if (v === 'cvr' || v === 'cardboard') return 'cvr';
    return '';
  }

  function autoDetectView(){
    // priority: ?view= explicit
    const explicit = normalizeView(qs('view',''));
    if (explicit) return explicit;

    // heuristic
    if (isMobileUA() && prefersCoarsePointer()) return 'cvr'; // common case for cardboard-like
    if (isMobileUA()) return 'mobile';
    return 'pc';
  }

  function setBodyClass(view){
    const b = DOC.body;
    if (!b) return;

    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add('view-' + view);
  }

  // ---------------------------
  // Fullscreen / Orientation
  // ---------------------------
  async function requestFullscreen(el){
    try{
      el = el || DOC.documentElement;
      if (!el) return false;

      // already fullscreen
      if (DOC.fullscreenElement) return true;

      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (!fn) return false;

      await fn.call(el);
      return !!DOC.fullscreenElement;
    }catch(_){
      return false;
    }
  }

  async function lockLandscape(){
    // best-effort
    try{
      const scr = screen;
      if (!scr || !scr.orientation || !scr.orientation.lock) return false;
      await scr.orientation.lock('landscape');
      return true;
    }catch(_){
      return false;
    }
  }

  async function unlockOrientation(){
    try{
      const scr = screen;
      if (!scr || !scr.orientation || !scr.orientation.unlock) return false;
      scr.orientation.unlock();
      return true;
    }catch(_){
      return false;
    }
  }

  // ---------------------------
  // WebXR immersive helper (cVR)
  // ---------------------------
  async function tryImmersiveForCVR(){
    // "สุภาพ": ไม่บังคับ, ไม่ throw, ถ้าไม่ได้ก็จบ
    try{
      // A-Frame present?
      const scene = DOC.querySelector('a-scene');
      const xrSys = scene && scene.systems && scene.systems['webxr'];
      // If A-Frame has enterVR method, prefer it
      if (scene && typeof scene.enterVR === 'function'){
        // If already in VR, skip
        if (scene.is && scene.is('vr-mode')) return true;
        scene.enterVR();
        return true;
      }

      // Raw WebXR fallback
      const xr = navigator.xr;
      if (!xr || !xr.isSessionSupported) return false;

      const ok = await xr.isSessionSupported('immersive-vr');
      if (!ok) return false;

      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor','bounded-floor','hand-tracking','layers']
      });

      // Immediately end; this is only to "warm up" / allow UI to show.
      // Real immersive should be via ENTER VR button (vr-ui.js / A-Frame).
      try{ await session.end(); }catch(_){}
      return true;
    }catch(_){
      return false;
    }
  }

  // ---------------------------
  // Safe-zone measurement
  // ---------------------------
  function measureSafeZone(){
    // return rectangles so engine can avoid spawning behind HUD
    // If elements missing, return conservative safe margin
    const res = {
      ts: Date.now(),
      w: window.innerWidth || 0,
      h: window.innerHeight || 0,
      hudTop: 0,
      questTop: 0,
      coachBottom: 0,
      powerBottom: 0
    };

    try{
      const hud = DOC.querySelector('.hud');
      if (hud){
        const r = hud.getBoundingClientRect();
        res.hudTop = Math.max(0, r.bottom);
      }
    }catch(_){}

    try{
      const qt = DOC.querySelector('.questTop');
      if (qt){
        const r = qt.getBoundingClientRect();
        res.questTop = Math.max(res.questTop, r.bottom);
      }
    }catch(_){}

    try{
      const cw = DOC.querySelector('.coachWrap');
      if (cw){
        const r = cw.getBoundingClientRect();
        // bottom overlay eats space from bottom
        res.coachBottom = Math.max(0, res.h - r.top);
      }
    }catch(_){}

    try{
      const pw = DOC.querySelector('.powerWrap');
      if (pw){
        const r = pw.getBoundingClientRect();
        res.powerBottom = Math.max(0, res.h - r.top);
      }
    }catch(_){}

    // clamp
    res.hudTop = clamp(res.hudTop, 0, res.h);
    res.questTop = clamp(res.questTop, 0, res.h);
    res.coachBottom = clamp(res.coachBottom, 0, res.h);
    res.powerBottom = clamp(res.powerBottom, 0, res.h);

    // emit for anyone who listens
    try{
      WIN.dispatchEvent(new CustomEvent('groups:safezone', { detail: res }));
    }catch(_){}

    return res;
  }

  function bindAutoMeasure(){
    let tmr = 0;
    const kick = ()=>{
      clearTimeout(tmr);
      tmr = setTimeout(()=> measureSafeZone(), 80);
    };
    WIN.addEventListener('resize', kick, { passive:true });
    WIN.addEventListener('orientationchange', kick, { passive:true });
    // allow manual measure
    WIN.addEventListener('groups:measureSafe', kick, { passive:true });
    kick();
  }

  // ---------------------------
  // init
  // ---------------------------
  let _view = 'pc';

  function init(opts){
    opts = opts || {};
    const v = normalizeView(opts.view || '') || autoDetectView();
    _view = v;

    setBodyClass(v);
    bindAutoMeasure();

    // best-effort fullscreen/orientation for mobile/cvr
    const wantFS = (v === 'mobile' || v === 'cvr');
    const wantLock = (v === 'cvr');

    // defer to user gesture if browser blocks
    setTimeout(async ()=>{
      if (wantFS) await requestFullscreen(DOC.documentElement);
      if (wantLock) await lockLandscape();
    }, 120);

    // helpful coach hint
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', {
        detail:{
          text: (v==='cvr')
            ? 'โหมด Cardboard: แตะจอเพื่อยิงจาก crosshair • กด RECENTER เพื่อปรับศูนย์ ✅'
            : (v==='mobile')
              ? 'โหมด Mobile: แตะ/กดยิงได้เลย • ถ้าจอเต็มไม่ขึ้น ลองกดปุ่ม fullscreen ✅'
              : 'โหมด PC: คลิก/เมาส์ยิงได้เลย ✅',
          mood:'neutral'
        }
      }));
    }catch(_){}
  }

  function getView(){ return _view; }

  function goFullscreen(){
    return requestFullscreen(DOC.documentElement);
  }

  function lockCVR(){
    return lockLandscape();
  }

  function unlock(){
    return unlockOrientation();
  }

  // expose
  WIN.GroupsVR.ViewHelper = {
    init,
    getView,
    autoDetectView,
    setBodyClass,
    goFullscreen,
    lockCVR,
    unlock,
    measureSafeZone,
    tryImmersiveForCVR
  };

})();