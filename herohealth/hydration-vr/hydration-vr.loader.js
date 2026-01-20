// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (pc/mobile/cvr) แต่ "ห้าม override" ถ้ามี ?view= อยู่แล้ว
// ✅ Cardboard: ?cardboard=1 => body.cardboard + layers L/R + show cbWrap
// ✅ Sets body classes: view-pc / view-mobile / view-cvr
// ✅ Fullscreen + best-effort landscape for cardboard (optional, safe)
// ✅ Start overlay: ปุ่มเริ่ม + tap-to-start -> emits hha:start
// ✅ Back HUB button (.btnBackHub) works everywhere
// -------------------------------------------------------

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  const hub = String(qs('hub','../hub.html'));
  const viewQ = String(qs('view','')||'').toLowerCase();      // if present => do not override
  const cardboardQ = String(qs('cardboard','0')||'0').toLowerCase();
  const isCardboard = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  function isTouch(){
    return ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
  }

  function detectView(){
    // pc / mobile / cvr
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch()){
      // wide landscape touch => cVR (ยิงกลางจอ)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    b.classList.add('view-' + view);
  }

  function setupCardboard(){
    const b = DOC.body;
    b.classList.toggle('cardboard', !!isCardboard);

    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap) cbWrap.hidden = !isCardboard;

    // expose layers list for engine (hydration.safe.js)
    if (isCardboard){
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
    } else {
      WIN.HHA_VIEW = WIN.HHA_VIEW || {};
      WIN.HHA_VIEW.layers = ['hydration-layer'];
    }
  }

  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }catch(_){}
  }

  async function lockLandscape(){
    try{
      if (screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  function bindBackHub(){
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; }, { passive:true });
    });
  }

  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if (!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }

  function showOverlayText(){
    const sub = DOC.getElementById('ovSub');
    if (!sub) return;
    const v = (viewQ || detectView()).toUpperCase();
    const cb = isCardboard ? ' + CARDBOARD' : '';
    sub.textContent = `พร้อมแล้ว: ${v}${cb} — แตะ “เริ่ม!” เพื่อเล่น`;
  }

  function startGame(){
    // hide overlay first (so it doesn't block clicks)
    hideOverlay();

    // fire start event
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}

    // best-effort FS/orientation for cardboard/cVR
    // (ต้องเรียกจาก user gesture — start button click)
    if (isCardboard){
      requestFullscreen();
      lockLandscape();
    } else if ((viewQ || '').toLowerCase() === 'cvr'){
      // optional: fullscreen for cVR to reduce browser UI
      requestFullscreen();
    }
  }

  function bindStartOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    if (!ov) return;

    // Tap anywhere to start (kids-friendly)
    ov.addEventListener('pointerdown', (ev)=>{
      // if clicking on buttons, allow their handler to run
      const t = ev.target;
      if (t && (t.id === 'btnStart' || (t.classList && t.classList.contains('btnBackHub')))) return;
      try{ ev.preventDefault(); }catch(_){}
      startGame();
    }, { passive:false });

    btn?.addEventListener('click', (ev)=>{
      try{ ev.preventDefault(); }catch(_){}
      startGame();
    }, { passive:false });
  }

  // ----- init -----
  const view = viewQ || detectView();   // respect ?view=..., otherwise detect
  setBodyView(view);
  setupCardboard();
  bindBackHub();
  showOverlayText();
  bindStartOverlay();

})();