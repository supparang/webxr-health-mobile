// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (LATEST)
// ✅ Auto-detect view but DO NOT override if ?view= exists
// ✅ Sets body classes: view-pc/view-mobile/view-cvr + cardboard
// ✅ Sets window.HHA_VIEW.layers for engine (hydration.safe.js) to mount targets
// ✅ Start overlay: tap/button -> dispatch hha:start
// ✅ Back HUB buttons
// ✅ Safe on slow loads

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // -------------------- detect view (only if no ?view=) --------------------
  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;

    if (isTouch){
      // ถ้าจอใหญ่และแนวนอน -> cVR (ยิงกลางจอ) จะเหมาะกว่า
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  // -------------------- apply body classes --------------------
  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if(view === 'cvr') b.classList.add('view-cvr');
    else if(view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function setCardboard(on){
    DOC.body.classList.toggle('cardboard', !!on);
    const cbWrap = DOC.getElementById('cbWrap');
    if (cbWrap) cbWrap.hidden = !on;
  }

  // -------------------- layers mapping for engine --------------------
  function setLayersForEngine(cardboard){
    // hydration.safe.js reads window.HHA_VIEW.layers
    // For cardboard => [hydration-layerL, hydration-layerR]
    // Otherwise => [hydration-layer]
    const layers = [];
    if (cardboard){
      const L = DOC.getElementById('hydration-layerL');
      const R = DOC.getElementById('hydration-layerR');
      if (L) layers.push('hydration-layerL');
      if (R) layers.push('hydration-layerR');
    } else {
      const M = DOC.getElementById('hydration-layer');
      if (M) layers.push('hydration-layer');
    }
    WIN.HHA_VIEW = Object.assign({}, WIN.HHA_VIEW || {}, { layers });
  }

  // -------------------- start overlay helpers --------------------
  function hideOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if(!ov) return;
    ov.classList.add('hide');
    ov.style.display = 'none';
  }

  function showOverlay(){
    const ov = DOC.getElementById('startOverlay');
    if(!ov) return;
    ov.classList.remove('hide');
    ov.style.display = '';
  }

  function dispatchStart(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindOverlay(){
    const ov = DOC.getElementById('startOverlay');
    const btnStart = DOC.getElementById('btnStart');
    const ovSub = DOC.getElementById('ovSub');

    // Set subtitle to match mode
    const view = currentView();
    const cardboard = isCardboardParam();
    const kids = isKids();
    const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();

    if (ovSub){
      let t = '';
      if (cardboard) t = 'โหมด Cardboard: ใส่แว่น แล้วเล็งกลางจอ';
      else if (view === 'cvr') t = 'โหมด cVR: ยิงจากกลางจอ (crosshair)';
      else if (view === 'mobile') t = 'โหมด Mobile: แตะเป้าเพื่อยิง';
      else t = 'โหมด PC: คลิกเป้าเพื่อยิง';

      if (kids) t += ' • Kids friendly';
      if (run === 'research') t += ' • Research (deterministic)';
      ovSub.textContent = t;
    }

    // Click anywhere to start (kids-friendly)
    ov?.addEventListener('pointerdown', (ev)=>{
      // ป้องกันเริ่มโดยไม่ตั้งใจถ้าคลิกปุ่มอื่น
      const tag = String(ev.target?.tagName||'').toLowerCase();
      if (tag === 'button') return;
      hideOverlay();
      dispatchStart();
    }, {passive:true});

    btnStart?.addEventListener('click', ()=>{
      hideOverlay();
      dispatchStart();
    });

    // back hub buttons
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });
  }

  // -------------------- param logic --------------------
  function currentView(){
    const v = String(qs('view','')||'').toLowerCase();
    if (v === 'pc' || v === 'mobile' || v === 'cvr') return v;
    return ''; // means "unspecified"
  }
  function isCardboardParam(){
    const c = String(qs('cardboard','0')||'0').toLowerCase();
    return (c === '1' || c === 'true' || c === 'yes');
  }
  function isKids(){
    const k = String(qs('kids','0')||'0').toLowerCase();
    return (k === '1' || k === 'true' || k === 'yes');
  }

  // -------------------- init sequence --------------------
  function init(){
    // Decide view:
    // - if ?view exists => respect it (NO override)
    // - else detect
    let view = currentView();
    if (!view) view = detectView();

    const cardboard = isCardboardParam();
    setBodyView(view);
    setCardboard(cardboard);
    setLayersForEngine(cardboard);

    // Make sure overlay visible at first
    showOverlay();
    bindOverlay();

    // Safety: if overlay hidden by CSS/DOM changes, auto start once
    const ov = DOC.getElementById('startOverlay');
    setTimeout(()=>{
      const hidden = !ov || getComputedStyle(ov).display === 'none' || ov.classList.contains('hide');
      if (hidden){
        // if user already started or overlay gone, just ensure game can start
        dispatchStart();
      }
    }, 900);

    // Minor: if view=cvr -> tell VRUI to use slightly tighter cooldown maybe
    if (view === 'cvr'){
      WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
    }
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})();