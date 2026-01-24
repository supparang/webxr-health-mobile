// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (PC/Mobile/cVR) BUT: if ?view= exists => DO NOT override
// ✅ Cardboard: ?cardboard=1 (forces view=cvr unless explicit view exists)
// ✅ Sets body classes: view-pc / view-mobile / view-vr / view-cvr + cardboard
// ✅ Exposes window.HHA_VIEW.layers for engine (safe.js) to mount targets on correct layer(s)
// ✅ Start overlay: tap / Start button => hides overlay + dispatches hha:start (user-gesture safe)
// ✅ Back HUB buttons (.btnBackHub) => go to ?hub=...
// ✅ cVR strict: disables direct tapping targets (shoot via crosshair -> hha:shoot)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const hasParam = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  const hub = String(qs('hub','../hub.html'));
  const viewParam = String(qs('view','')).toLowerCase().trim();
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const CARD = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, innerWidth||1);
    const h = Math.max(1, innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // tablet/landscape => cVR feels nicer (crosshair)
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(v){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    const vv = (v==='mobile') ? 'view-mobile'
            : (v==='cvr') ? 'view-cvr'
            : (v==='vr') ? 'view-vr'
            : 'view-pc';
    b.classList.add(vv);
    b.dataset.view = v || '';
  }

  function setCardboard(on){
    DOC.body.classList.toggle('cardboard', !!on);

    const cbWrap = DOC.getElementById('cbWrap');
    const mainLayer = DOC.getElementById('hydration-layer');

    if (cbWrap){
      // NOTE: in HTML cbWrap is inside playfield; hidden attribute used
      cbWrap.hidden = !on;
    }
    if (mainLayer){
      mainLayer.style.display = on ? 'none' : '';
    }

    // Provide layers list for engine (hydration.safe.js)
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    if (on){
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
    }else{
      WIN.HHA_VIEW.layers = ['hydration-layer'];
    }
  }

  // cVR strict: prevent kids from tapping random targets (shoot from crosshair only)
  function applyCVRStrict(on){
    const id = 'hvr-cvr-strict-style';
    let st = DOC.getElementById(id);
    if (on){
      if (!st){
        st = DOC.createElement('style');
        st.id = id;
        st.textContent = `
          body.view-cvr .hvr-target{ pointer-events:none !important; }
          body.view-cvr #playfieldWrap{ pointer-events:none; } /* keep input to vr-ui crosshair */
        `;
        DOC.head.appendChild(st);
      }
    } else {
      if (st) st.remove();
    }
  }

  // Fullscreen + best-effort landscape lock (Cardboard helpers)
  async function tryFullscreen(){
    try{
      const el = DOC.documentElement;
      if (!DOC.fullscreenElement && el.requestFullscreen){
        await el.requestFullscreen({ navigationUI:'hide' }).catch(()=>{});
      }
    }catch(_){}
  }
  async function tryLandscape(){
    try{
      const scr = screen;
      if (scr?.orientation?.lock){
        await scr.orientation.lock('landscape').catch(()=>{});
      }
    }catch(_){}
  }

  // Decide effective view:
  // 1) If ?view= exists => use it (NO override)
  // 2) Else if cardboard => use cvr (crosshair) for split view
  // 3) Else detect
  let view = 'pc';
  if (viewParam){
    view = viewParam;
  } else if (CARD){
    view = 'cvr';
  } else {
    view = detectView();
  }

  // Normalize view strings
  if (view === 'desktop') view = 'pc';
  if (view === 'phone') view = 'mobile';

  setBodyView(view);
  setCardboard(!!CARD);

  // Only enforce strict in cVR (kids-friendly)
  applyCVRStrict(view === 'cvr');

  // Back HUB buttons
  function bindBackHub(){
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
        location.href = hub;
      }, { passive:false });
    });
  }
  bindBackHub();

  // Start overlay behavior
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const ovSub = DOC.getElementById('ovSub');

  function hideOverlayAndStart(){
    try{
      if (overlay){
        overlay.classList.add('hide');
        // allow CSS transition if any; then hard-hide
        setTimeout(()=>{ try{ overlay.style.display='none'; }catch(_){ } }, 120);
      }
    }catch(_){}
    // user gesture path — safe for audio beeps & fullscreen
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function setupOverlayText(){
    if (!ovSub) return;
    const nice = (view==='cvr') ? 'cVR (ยิงจากกลางจอ)' : (view==='mobile') ? 'Mobile' : 'PC';
    ovSub.textContent = CARD ? `โหมด: Cardboard (${nice})` : `โหมด: ${nice}`;
  }
  setupOverlayText();

  // Tap anywhere on card / overlay to start (kid-friendly)
  if (overlay){
    overlay.addEventListener('pointerdown', (ev)=>{
      // ignore taps on back hub button (it has its own handler)
      const t = ev.target;
      const isBack = t && (t.classList?.contains('btnBackHub') || t.closest?.('.btnBackHub'));
      if (isBack) return;

      // If they tap on overlay background, also allow start
      hideOverlayAndStart();

      // If cardboard, try helpers after user gesture
      if (CARD){
        tryFullscreen();
        tryLandscape();
      }
    }, { passive:true });
  }

  btnStart?.addEventListener('click', (ev)=>{
    try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
    hideOverlayAndStart();
    if (CARD){
      tryFullscreen();
      tryLandscape();
    }
  }, { passive:false });

  // If overlay is missing/hidden (rare), auto start
  setTimeout(()=>{
    const hidden = !overlay
      || getComputedStyle(overlay).display === 'none'
      || overlay.classList.contains('hide');
    if (hidden){
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }
  }, 600);

  // Handle resize: keep strict rule aligned with view
  WIN.addEventListener('resize', ()=>{
    // no re-detect if user explicitly set ?view= (NO override)
    if (viewParam) return;
    if (CARD) return;

    const v2 = detectView();
    if (v2 !== view){
      view = v2;
      setBodyView(view);
      applyCVRStrict(view === 'cvr');
      setupOverlayText();
    }
  }, { passive:true });

})();