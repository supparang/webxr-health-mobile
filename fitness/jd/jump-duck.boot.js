// === /fitness/jd/jump-duck.boot.js ===
// Jump-Duck Boot (WebXR mapping) — PRODUCTION
// ✅ Detect view: pc/mobile/vr/cvr (NEVER override ?view=)
// ✅ Map hha:shoot => Jump/Duck based on y position within play-area
// ✅ In view=cvr strict => use screen center (ignore x/y jitter) for stability
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
  }

  function getView(){
    const v = (qs('view','') || '').toLowerCase();
    if (v) return v;
    // fallback
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (Math.min(screen.width, screen.height) <= 820);
    return isMobile ? 'mobile' : 'pc';
  }

  function applyViewClasses(view){
    DOC.documentElement.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    const v = (view||'pc').toLowerCase();
    if (v === 'cvr') DOC.documentElement.classList.add('view-vr','view-cvr');
    else if (v === 'vr') DOC.documentElement.classList.add('view-vr');
    else if (v === 'mobile') DOC.documentElement.classList.add('view-mobile');
    else DOC.documentElement.classList.add('view-pc');
  }

  function waitForActionApi(cb){
    const t0 = performance.now();
    const tick = ()=>{
      if (typeof WIN.JD_ACTION === 'function') return cb(WIN.JD_ACTION);
      if (performance.now() - t0 > 4000) return; // give up silently
      requestAnimationFrame(tick);
    };
    tick();
  }

  function mapShootToAction(ev, actionFn){
    // ev.detail = {x,y,lockPx,source}
    const play = DOC.getElementById('jd-play-area');
    if (!play) return;

    const view = getView();
    const rect = play.getBoundingClientRect();

    let y = null;

    // Strict cVR: use center of play-area
    if (view === 'cvr'){
      y = rect.top + rect.height * 0.5; // stable midline
    }else{
      // Prefer provided y
      const dy = ev?.detail?.y;
      if (typeof dy === 'number') y = dy;
      else y = rect.top + rect.height * 0.5;
    }

    const mid = rect.top + rect.height/2;
    const type = (y < mid) ? 'jump' : 'duck';
    actionFn(type);
  }

  function applyUrlDefaults(){
    // If user came with ?diff/?time/?mode => set selects later (jump-duck.js uses its own)
    // This just stores them for jump-duck.js to read if you patch it later.
    WIN.__JD_QS = {
      mode: qs('mode','training'),
      diff: qs('diff','normal'),
      time: qs('time','60'),
      pid:  qs('pid','')
    };
  }

  function init(){
    const view = getView();
    applyViewClasses(view);
    applyUrlDefaults();

    // Map WebXR shoot to Jump/Duck
    DOC.addEventListener('hha:shoot', (ev)=>{
      waitForActionApi((actionFn)=>{
        mapShootToAction(ev, actionFn);
      });
    }, {passive:true});
  }

  WIN.addEventListener('DOMContentLoaded', init);
})();