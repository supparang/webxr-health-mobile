// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR RUN Loader — PRODUCTION (AUTO / NO OVERRIDE)
// ✅ Sets body classes: view-pc / view-mobile / view-cvr + cardboard
// ✅ DO NOT override if ?view= exists
// ✅ If ?cardboard=1 and view missing => force cvr
// ✅ Creates HHA_VIEW.layers for hydration.safe.js (cardboard L/R)
// ✅ Start Overlay -> dispatch hha:start (tap/click safe)
// ✅ Fullscreen/orientation best-effort for Cardboard (user gesture only)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function normView(v){
    v = String(v||'').toLowerCase().trim();
    if (v==='pc' || v==='desktop') return 'pc';
    if (v==='mobile' || v==='m') return 'mobile';
    if (v==='cvr' || v==='vr' || v==='cardboard') return 'cvr';
    return '';
  }

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
    const w = Math.max(1, innerWidth||1);
    const h = Math.max(1, innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    b.classList.add(view==='pc'?'view-pc':view==='cvr'?'view-cvr':'view-mobile');
  }

  function setCardboard(on){
    DOC.body.classList.toggle('cardboard', !!on);
    const cb = DOC.getElementById('cbWrap');
    const mainLayer = DOC.getElementById('hydration-layer');
    if (cb) cb.hidden = !on;
    // show/hide main layer by CSS (your CSS already has: body.cardboard #hydration-layer{display:none})
    if (mainLayer) mainLayer.style.display = on ? 'none' : '';
  }

  function setupHHAView(view, cardboard){
    // Used by hydration.safe.js -> getLayers()
    const cfg = {
      view,
      cardboard: !!cardboard,
      layers: []
    };
    if (cardboard){
      cfg.layers = ['hydration-layerL','hydration-layerR'];
    }else{
      cfg.layers = ['hydration-layer'];
    }
    WIN.HHA_VIEW = cfg;
  }

  async function requestFullscreenAndLandscapeBestEffort(){
    // Must be called from user gesture
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen && !DOC.fullscreenElement){
        await el.requestFullscreen({ navigationUI:'hide' }).catch(()=>el.requestFullscreen().catch(()=>{}));
      }
    }catch(_){}
    try{
      const o = screen.orientation;
      if (o && o.lock){
        await o.lock('landscape').catch(()=>{});
      }
    }catch(_){}
  }

  function startGame(){
    // ensure overlay hidden
    const ov = DOC.getElementById('startOverlay');
    if (ov) ov.classList.add('hide'); // ok even if no CSS; fallback:
    if (ov) ov.style.display = 'none';

    // wake audio context (some browsers)
    try{
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if (AC){
        const ac = new AC();
        if (ac && ac.state === 'suspended') ac.resume().catch(()=>{});
        // close quickly to avoid creating extra contexts
        setTimeout(()=>{ try{ ac.close(); }catch(_){ } }, 120);
      }
    }catch(_){}

    // fire start
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindOverlay(view, cardboard){
    const ov = DOC.getElementById('startOverlay');
    const btn = DOC.getElementById('btnStart');
    const sub = DOC.getElementById('ovSub');

    if (sub){
      const kid = String(qs('kids','0')).toLowerCase();
      const isKids = (kid==='1'||kid==='true'||kid==='yes');
      sub.textContent =
        (isKids ? 'โหมดเด็ก: สบาย ๆ' : 'แตะเพื่อเริ่ม') +
        ` • ${view.toUpperCase()}` +
        (cardboard ? ' • CARDBOARD' : '');
    }

    // back to hub buttons
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(b=>{
      b.addEventListener('click', ()=>{ location.href = hub; });
    });

    // click start
    const startHandler = async (ev)=>{
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(_){}
      if (cardboard){
        await requestFullscreenAndLandscapeBestEffort();
      }
      startGame();
    };

    if (btn) btn.addEventListener('click', startHandler, { passive:false });

    // allow tap overlay anywhere (kid-friendly)
    if (ov){
      ov.addEventListener('pointerdown', (ev)=>{
        // ignore clicking inside card buttons; btn already handles
        const t = ev.target;
        if (t && (t.closest && t.closest('button'))) return;
        startHandler(ev);
      }, { passive:false });
    }
  }

  function boot(){
    // Decide view (NO OVERRIDE)
    const viewProvided = normView(qs('view',''));
    const cardboardQ = String(qs('cardboard','0')).toLowerCase();
    const wantsCardboard = (cardboardQ==='1'||cardboardQ==='true'||cardboardQ==='yes');

    let view = viewProvided || '';
    if (!view){
      view = detectView();
      if (wantsCardboard) view = 'cvr';
    }

    setBodyView(view);
    setCardboard(!!wantsCardboard);
    setupHHAView(view, !!wantsCardboard);

    // bind overlay + start
    bindOverlay(view, !!wantsCardboard);

    // If something else already hid overlay, auto-start (failsafe)
    setTimeout(()=>{
      const ov = DOC.getElementById('startOverlay');
      const hidden = !ov || getComputedStyle(ov).display==='none' || ov.classList.contains('hide');
      if (hidden) startGame();
    }, 700);
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

})();