// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (AUTO, no-override)
// ✅ Detect view ONLY if no ?view=
// ✅ body classes: view-pc/view-mobile/view-cvr + cardboard
// ✅ Setup Cardboard layers flag: window.HHA_VIEW.layers
// ✅ Start overlay: button/tap -> hide -> emit hha:start
// ✅ Hub back buttons

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_HYDRATION_LOADER__) return;
  WIN.__HHA_HYDRATION_LOADER__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function detectView(){
    const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    const landscape = w >= h;
    if (isTouch){
      if (landscape && w >= 740) return 'cvr';
      return 'mobile';
    }
    return 'pc';
  }

  function setBodyView(v){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr');
    if (v === 'cvr') b.classList.add('view-cvr');
    else if (v === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  function setupCardboard(){
    const cb = String(qs('cardboard','0')).toLowerCase();
    const on = (cb==='1' || cb==='true' || cb==='yes');
    DOC.body.classList.toggle('cardboard', on);

    // expose layers to engine
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    if (on){
      WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
      const cbWrap = DOC.getElementById('cbWrap');
      if (cbWrap) cbWrap.hidden = false;

      // hide single layer when cardboard
      const main = DOC.getElementById('hydration-layer');
      if (main) main.style.display = 'none';
    } else {
      WIN.HHA_VIEW.layers = ['hydration-layer'];
      const cbWrap = DOC.getElementById('cbWrap');
      if (cbWrap) cbWrap.hidden = true;

      const main = DOC.getElementById('hydration-layer');
      if (main) main.style.display = '';
    }
  }

  function bindHubBack(){
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub').forEach(btn=>{
      btn.addEventListener('click', ()=>{ location.href = hub; });
    });
  }

  function startGame(){
    const ov = DOC.getElementById('startOverlay');
    if (ov) ov.style.display = 'none';
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
  }

  function bindStartOverlay(){
    const btn = DOC.getElementById('btnStart');
    if (btn){
      btn.addEventListener('click', startGame);
    }
    const ov = DOC.getElementById('startOverlay');
    if (ov){
      ov.addEventListener('pointerdown', (e)=>{
        // allow tap anywhere
        if (e && e.target && e.target.closest && e.target.closest('button')) return;
        startGame();
      }, { passive:true });
    }
  }

  function configureVRUI(){
    // baseline config; engine will do aim-assist itself via hha:shoot
    WIN.HHA_VRUI_CONFIG = WIN.HHA_VRUI_CONFIG || {};
    // kids: slightly bigger lock feel
    const kids = String(qs('kids','0')).toLowerCase();
    const K = (kids==='1'||kids==='true'||kids==='yes');
    WIN.HHA_VRUI_CONFIG.lockPx = clamp(parseInt(qs('lockPx', K ? 36 : 28),10)||28, 18, 86);
    WIN.HHA_VRUI_CONFIG.cooldownMs = clamp(parseInt(qs('shootCd', 90),10)||90, 50, 250);
  }

  function boot(){
    const viewQ = String(qs('view','')).toLowerCase().trim();
    const view = viewQ ? viewQ : detectView(); // no-override
    setBodyView(view);
    setupCardboard();
    configureVRUI();
    bindHubBack();
    bindStartOverlay();

    // optional autostart
    const auto = String(qs('autostart','0')).toLowerCase();
    if (auto==='1' || auto==='true' || auto==='yes'){
      setTimeout(startGame, 250);
    }
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

})();