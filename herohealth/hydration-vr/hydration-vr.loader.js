// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view (only when no ?view=) — NO override
// ✅ Sets body classes: view-pc / view-mobile / view-cvr / view-vr + optional .cardboard
// ✅ Cardboard: mounts split layers + exposes window.HHA_VIEW.layers
// ✅ Start overlay: tap/button -> emits hha:start
// ✅ Back HUB: flush logger before navigating
// ✅ Best-effort fullscreen + landscape lock (Cardboard)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  const hub = String(qs('hub','../hub.html'));
  const viewQ = (qs('view','')||'').toLowerCase().trim();
  const cardboardQ = String(qs('cardboard','0')).toLowerCase();
  const CARDBOARD = (cardboardQ==='1' || cardboardQ==='true' || cardboardQ==='yes');

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if(isTouch){
      // มือถือแนวนอนจอกว้าง -> cVR (ยิงกลางจอ)
      if(landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  // IMPORTANT: do not override if user has ?view=
  const view = viewQ || detectView();

  function setBodyView(v){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');
    if(v==='pc') b.classList.add('view-pc');
    else if(v==='mobile') b.classList.add('view-mobile');
    else if(v==='cvr') b.classList.add('view-cvr');
    else if(v==='vr') b.classList.add('view-vr');
    else b.classList.add('view-mobile');
  }

  function mountCardboard(on){
    const cbWrap = DOC.getElementById('cbWrap');
    const mainLayer = DOC.getElementById('hydration-layer');
    const L = DOC.getElementById('hydration-layerL');
    const R = DOC.getElementById('hydration-layerR');
    const cbPF = DOC.getElementById('cbPlayfield');

    if(on){
      DOC.body.classList.add('cardboard');
      if(cbWrap) cbWrap.hidden = false;
      if(mainLayer) mainLayer.style.display = 'none';

      // expose layers for engine
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        view,
        cardboard:true,
        layers: ['hydration-layerL','hydration-layerR'],
        playfieldId: 'cbPlayfield'
      });

      // small guard
      if(!L || !R || !cbPF){
        console.warn('[HydrationLoader] Cardboard requested but split layers missing.');
      }
    } else {
      if(cbWrap) cbWrap.hidden = true;
      if(mainLayer) mainLayer.style.display = '';
      WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
        view,
        cardboard:false,
        layers: ['hydration-layer'],
        playfieldId: 'playfield'
      });
    }
  }

  // best-effort fullscreen + landscape (Cardboard)
  async function tryFullscreenLandscape(){
    try{
      const el = DOC.documentElement;
      if(el.requestFullscreen) await el.requestFullscreen();
    }catch(_){}
    try{
      const o = screen.orientation;
      if(o && o.lock) await o.lock('landscape');
    }catch(_){}
  }

  // flush helper (logger listens hha:flush)
  function flushNow(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:flush')); }catch(_){}
  }

  // bind back hub buttons
  function bindBackHub(){
    const btns = Array.from(DOC.querySelectorAll('.btnBackHub'));
    btns.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        flushNow();
        setTimeout(()=>{ location.href = hub; }, 80);
      });
    });
  }

  // start overlay
  function bindStart(){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const ovSub = DOC.getElementById('ovSub');

    // update overlay hint
    if(ovSub){
      const kids = String(qs('kids','0')).toLowerCase();
      const K = (kids==='1'||kids==='true'||kids==='yes');
      const label =
        (view==='cvr' ? 'โหมด cVR: ยิงจากกลางจอ' :
         view==='vr'  ? 'โหมด VR: กด ENTER VR แล้วเริ่ม' :
         view==='mobile' ? 'โหมด Mobile: แตะเป้าเพื่อยิง' : 'โหมด PC: คลิกเป้าเพื่อยิง');
      ovSub.textContent = label + (K ? ' • Kids=ON' : '');
    }

    function hideOverlayAndStart(){
      if(!ov) return;
      ov.classList.add('hide');
      ov.style.display = 'none';

      // Cardboard: try fullscreen/landscape before start (best-effort)
      if(DOC.body.classList.contains('cardboard')) tryFullscreenLandscape();

      // start
      try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    }

    // overlay tap anywhere
    if(ov){
      ov.addEventListener('pointerdown', (e)=>{
        // avoid double if clicking a button
        const t = e.target;
        if(t && (t.closest && t.closest('button'))) return;
        hideOverlayAndStart();
      }, { passive:true });
    }
    btn?.addEventListener('click', hideOverlayAndStart);

    // safety: if overlay already hidden, auto-start
    setTimeout(()=>{
      const hidden = !ov || getComputedStyle(ov).display==='none' || ov.classList.contains('hide');
      if(hidden) hideOverlayAndStart();
    }, 650);
  }

  // --- apply ---
  setBodyView(view);

  // Cardboard logic:
  // - if ?cardboard=1 => cardboard ON (even if view=cvr)
  // - else if view=vr => keep non-split unless explicitly cardboard=1
  mountCardboard(!!CARDBOARD);

  bindBackHub();
  bindStart();

  // expose view early for other modules
  WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, {
    view,
    hub,
    ts: Number(qs('ts', Date.now())) || Date.now()
  });

})();