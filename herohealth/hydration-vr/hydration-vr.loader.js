// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view: PC / Mobile / cVR (NO override if ?view= exists)
// ✅ Cardboard flag: ?cardboard=1 => body.cardboard + sets HHA_VIEW.layers [L,R]
// ✅ Adds body classes: view-pc / view-mobile / view-cvr + is-touch + is-fs
// ✅ Start overlay wiring: #btnStart hides overlay -> dispatch hha:start
// ✅ Back-to-hub wiring: .btnBackHub -> go hub
// ✅ Fullscreen best-effort (Mobile/cVR/Cardboard): on first tap
// ✅ Orientation hint (Cardboard): best-effort landscape lock (non-fatal)
// ✅ Safe: if engine waits for overlay hidden, we dispatch hha:start reliably

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

  const hub = String(qs('hub','../hub.html'));
  const viewQ = String(qs('view','')||'').toLowerCase();
  const cardboardQ = String(qs('cardboard','0')||'').toLowerCase();
  const cardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  // ---------------- view detect (only if no ?view=) ----------------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth  || 1);
    const h = Math.max(1, WIN.innerHeight || 1);
    const landscape = w >= h;

    if (isTouch){
      // Big-screen touch in landscape -> cVR (center crosshair shooting feels best)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }
  const view = viewQ ? viewQ : detectView();

  // ---------------- body classes ----------------
  function setBodyView(v){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (v === 'cvr') b.classList.add('view-cvr');
    else if (v === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');

    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    b.classList.toggle('is-touch', !!isTouch);
  }

  // ---------------- cardboard layer wiring ----------------
  function applyCardboard(on){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!on);

    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap) cbWrap.hidden = !on;

    // expose layers for engine
    if (on){
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      // keep unset OR single-layer
      WIN.HHA_VIEW.layers = ['hydration-layer'];
    }
  }

  // ---------------- fullscreen helpers ----------------
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement) return true;
      if (el.requestFullscreen) { await el.requestFullscreen({ navigationUI:'hide' }); return true; }
      return false;
    }catch(_){
      return false;
    }
  }
  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if (o && o.lock) { await o.lock('landscape'); return true; }
    }catch(_){}
    return false;
  }
  function markFsClass(){
    try{
      DOC.body.classList.toggle('is-fs', !!DOC.fullscreenElement);
    }catch(_){}
  }
  DOC.addEventListener('fullscreenchange', markFsClass, { passive:true });

  // For mobile UX: hide address bar on load (best-effort)
  function nudgeScroll(){
    try{ setTimeout(()=>WIN.scrollTo(0,1), 60); }catch(_){}
  }

  // ---------------- overlay wiring ----------------
  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.style.display = 'none';
    ov.classList.add('hide');
  }
  function startGame(){
    // Dispatch hha:start (engine listens once:true)
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function wireButtons(){
    const btnStart = DOC.getElementById('btnStart');
    const btnBacks = Array.from(DOC.querySelectorAll('.btnBackHub'));

    btnBacks.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        // flush logs if any
        try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
        location.href = hub;
      });
    });

    async function onFirstTapStart(){
      // For mobile/cVR/cardboard: attempt fullscreen + orientation (non-fatal)
      if (view === 'mobile' || view === 'cvr' || cardboard){
        await requestFullscreen();
        if (cardboard) await lockLandscape();
      }
      hideOverlay();
      startGame();
      nudgeScroll();
    }

    if (btnStart){
      btnStart.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        onFirstTapStart();
      }, { passive:false });
    }

    // Also allow tapping anywhere on overlay card/backdrop area
    const ov = DOC.getElementById('startOverlay');
    if (ov){
      ov.addEventListener('click', (ev)=>{
        // avoid clicking buttons twice
        const t = ev.target;
        if (t && (t.id==='btnStart' || (t.closest && t.closest('button')))) return;
        onFirstTapStart();
      }, { passive:true });
    }
  }

  // ---------------- text hints ----------------
  function setOverlayText(){
    const sub = DOC.getElementById('ovSub');
    const hint = DOC.getElementById('ovHint');

    const vLabel =
      cardboard ? 'CARDBOARD' :
      (view === 'cvr') ? 'cVR' :
      (view === 'mobile') ? 'MOBILE' : 'PC';

    if (sub){
      sub.textContent = cardboard
        ? `โหมด ${vLabel}: ใส่โทรศัพท์เข้ากล่อง แล้วกดเริ่ม`
        : `โหมด ${vLabel}: แตะเพื่อเริ่ม`;
    }
    if (hint){
      const kids = String(qs('kids','0')).toLowerCase();
      const kidsOn = (kids==='1'||kids==='true'||kids==='yes');
      hint.innerHTML =
        `• ${view==='cvr' ? 'cVR: ยิงจากกลางจอ (crosshair)' : 'แตะ/คลิกเป้าเพื่อยิง'} <br/>` +
        `• Cardboard: <b>?view=cvr&cardboard=1</b> <br/>` +
        `• เด็ก ป.5: <b>?kids=1</b> ${kidsOn ? '✅ (เปิดอยู่)' : ''}`;
    }
  }

  // ---------------- boot ----------------
  function boot(){
    setBodyView(view);

    // Cardboard decision:
    // - if ?cardboard=1 => cardboard ON
    // - else OFF
    applyCardboard(!!cardboard);

    setOverlayText();
    wireButtons();
    markFsClass();
    nudgeScroll();

    // expose view info for other modules if needed
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    WIN.HHA_VIEW.view = view;
    WIN.HHA_VIEW.cardboard = !!cardboard;

    // Safety: if overlay is already hidden by css/restore, start automatically
    const ov = DOC.getElementById('startOverlay');
    setTimeout(()=>{
      const hidden = !ov || (getComputedStyle(ov).display === 'none') || ov.classList.contains('hide');
      if (hidden){
        startGame();
      }
    }, 550);
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();