// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view: pc / mobile / cvr / cardboard
// ✅ NO override if URL has ?view=... already  (สำคัญมาก)
// ✅ Cardboard: mount split layers + body.cardboard + HHA_VIEW.layers = [L,R]
// ✅ cVR strict: body.view-cvr (shoot from center via vr-ui.js)
// ✅ Start overlay: tap-to-start + btnStart + backHub
// ✅ Practice pass-through (?practice=15) => engine reads & runs practice
// ✅ Fullscreen/orientation best-effort (mobile/cardboard) — non-blocking
// ✅ Safe-area CSS vars: --sat/--sar/--sab/--sal

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  // --- safe-area vars (px -> css var for layout) ---
  function syncSafeArea(){
    try{
      const r = DOC.documentElement;
      const sat = parseFloat(getComputedStyle(r).getPropertyValue('--sat')) || 0;
      const sar = parseFloat(getComputedStyle(r).getPropertyValue('--sar')) || 0;
      const sab = parseFloat(getComputedStyle(r).getPropertyValue('--sab')) || 0;
      const sal = parseFloat(getComputedStyle(r).getPropertyValue('--sal')) || 0;
      // if already set by CSS, keep; otherwise set from env values
      // NOTE: hydration-vr.css should define:
      // --sat: env(safe-area-inset-top, 0px) etc.
      // so we only force refresh by re-setting computed values
      r.style.setProperty('--sat', sat + 'px');
      r.style.setProperty('--sar', sar + 'px');
      r.style.setProperty('--sab', sab + 'px');
      r.style.setProperty('--sal', sal + 'px');
    }catch(_){}
  }

  // --- view detection ---
  function hasViewParam(){
    const v = (qs('view','') || '').trim();
    return !!v;
  }

  function isProbablyMobile(){
    const ua = navigator.userAgent || '';
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    const small = Math.min(screen.width||9999, screen.height||9999) <= 900;
    return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && small);
  }

  function hasXR(){
    try{ return !!(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'); }
    catch(_){ return false; }
  }

  // detect cVR: user likely in mobile + wants crosshair shoot (no pointer targets)
  function wantCVR(){
    const v = (qs('view','')||'').toLowerCase();
    if (v === 'cvr') return true;
    // heuristic: if inside iframe / webview sometimes pointer hits messy -> cvr feels better
    const isEmbed = (WIN.self !== WIN.top);
    const m = isProbablyMobile();
    return m && isEmbed;
  }

  // detect cardboard: if XR available and mobile + user pressed Enter VR later,
  // loader sets mode to allow split layers if explicitly view=cardboard or if user requests via ?cardboard=1
  function wantCardboard(){
    const v = (qs('view','')||'').toLowerCase();
    if (v === 'cardboard') return true;
    const cb = (qs('cardboard','0')||'').toLowerCase();
    if (cb === '1' || cb === 'true' || cb === 'yes') return true;
    return false;
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');
    b.classList.add('view-' + view);
  }

  function setBodyVR(flag){
    DOC.body.classList.toggle('view-vr', !!flag);
  }

  // --- Cardboard layer wiring ---
  function setupCardboardLayers(enable){
    const cbWrap = DOC.getElementById('cbWrap');
    const mainLayer = DOC.getElementById('hydration-layer');
    const layerL = DOC.getElementById('hydration-layerL');
    const layerR = DOC.getElementById('hydration-layerR');

    if (!cbWrap || !mainLayer || !layerL || !layerR) return;

    if (enable){
      // show cb wrap, hide main layer usage (but keep in DOM)
      cbWrap.hidden = false;
      DOC.body.classList.add('cardboard');

      // engine should render into L/R
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        view: 'cardboard',
        layers: ['hydration-layerL','hydration-layerR']
      });
    } else {
      cbWrap.hidden = true;
      DOC.body.classList.remove('cardboard');

      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        view: 'main',
        layers: ['hydration-layer']
      });
    }
  }

  // --- Fullscreen + orientation (best-effort, non-blocking) ---
  async function tryFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    }catch(_){}
  }

  async function tryLandscape(){
    try{
      const o = screen.orientation;
      if (o && o.lock){
        await o.lock('landscape');
      }
    }catch(_){}
  }

  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.classList.add('hide');
    setTimeout(()=>{ try{ ov.style.display='none'; }catch(_){ } }, 220);
  }

  function bindOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btnStart = DOC.getElementById('btnStart');
    if (!ov || !btnStart) return;

    // Back hub
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const hub = qs('hub','../hub.html');
        location.href = hub;
      });
    });

    const start = async ()=>{
      hideOverlay();

      // best-effort for mobile/cardboard
      const view = (qs('view','')||'').toLowerCase();
      if (view === 'mobile' || view === 'cvr' || view === 'cardboard'){
        tryFullscreen();
      }
      if (view === 'cardboard'){
        tryLandscape();
      }

      // unlock audio context in engine/ticks
      try{
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if (AC){
          const ac = new AC();
          if (ac && ac.state === 'suspended') await ac.resume();
          setTimeout(()=>{ try{ ac.close(); }catch(_){ } }, 100);
        }
      }catch(_){}

      // Start game
      WIN.dispatchEvent(new CustomEvent('hha:start'));
    };

    btnStart.addEventListener('click', start);
    ov.addEventListener('click', (e)=>{
      // click outside card => start (kids friendly)
      if (e.target === ov) start();
    }, { passive:true });

    // also allow key
    WIN.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter' || e.key === ' ') start();
    }, { passive:true });
  }

  async function detectAndApply(){
    // 1) Respect existing view param (NO override)
    let view = (qs('view','')||'').toLowerCase();

    if (!view){
      // 2) Auto-detect
      const mobile = isProbablyMobile();
      const cb = wantCardboard();
      const cvr = wantCVR();
      const xr = hasXR();

      if (cb) view = 'cardboard';
      else if (cvr) view = 'cvr';
      else if (mobile) view = 'mobile';
      else view = 'pc';

      // IMPORTANT: do NOT write back to URL (no override / no mutation)
    }

    // Apply body class
    setBodyView(view);

    // Cardboard split
    if (view === 'cardboard'){
      setupCardboardLayers(true);
    } else {
      setupCardboardLayers(false);
    }

    // cVR strict: prevent pointer hits issues (targets still pointer-events in DOM,
    // but vr-ui.js will shoot via hha:shoot from crosshair; CSS should disable pointer events on targets in view-cvr)
    if (view === 'cvr') DOC.body.classList.add('view-cvr');

    // Sync safe-area
    syncSafeArea();

    // Update overlay subtitle hint
    const ovSub = DOC.getElementById('ovSub');
    if (ovSub){
      const kids = (qs('kids','0')||'').toLowerCase();
      const KIDS = (kids==='1'||kids==='true'||kids==='yes');
      const hint = (view==='pc') ? 'คลิกเพื่อเริ่ม' :
                   (view==='mobile') ? 'แตะเพื่อเริ่ม (แนะนำแนวนอน)' :
                   (view==='cvr') ? 'แตะเพื่อเริ่ม (ยิงจากกลางจอ)' :
                   'แตะเพื่อเริ่ม (Cardboard VR)';
      ovSub.textContent = KIDS ? (hint + ' • โหมดเด็ก') : hint;
    }

    // A-Frame: detect when entering VR session
    // This helps class view-vr for HUD adjustments.
    try{
      const scene = DOC.querySelector('a-scene');
      if (scene){
        scene.addEventListener('enter-vr', ()=>setBodyVR(true));
        scene.addEventListener('exit-vr', ()=>setBodyVR(false));
      }
    }catch(_){}
  }

  // --- init ---
  function init(){
    bindOverlay();
    detectAndApply();

    // re-sync safe area on resize/orientation
    WIN.addEventListener('resize', syncSafeArea, { passive:true });
    WIN.addEventListener('orientationchange', ()=>{
      setTimeout(syncSafeArea, 60);
      setTimeout(syncSafeArea, 260);
    }, { passive:true });
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})();