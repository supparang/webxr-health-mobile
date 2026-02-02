// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — PRODUCTION (DOM90)
// ✅ Reads query: view/run/diff/time/seed/hub/studyId/phase/conditionGroup
// ✅ Sets body data-view
// ✅ Tap-to-start for mobile/cvr
// ✅ Calls BrushVR.boot(ctx)
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function getCtx(){
    const view = String(qs('view','pc')).toLowerCase();
    const run = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(qs('time','90'), 30, 180);
    const seed = Number(qs('seed', String(Date.now()))) || Date.now();

    const hub = String(qs('hub',''));
    const studyId = String(qs('studyId',''));
    const phase = String(qs('phase',''));
    const conditionGroup = String(qs('conditionGroup',''));

    return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup };
  }

  function needsTapOverlay(view){
    // Mobile + cVR/VR tends to need a user gesture before reliable interactions/audio
    return (view === 'mobile' || view === 'cvr' || view === 'vr');
  }

  function start(){
    const ctx = getCtx();
    DOC.body.setAttribute('data-view', ctx.view);

    // Apply time to engine (simple hook): override query time by patching global if needed
    // brush.safe.js uses internal CFG.timeSec=90 by default; we pass ctx.time and let engine read it.
    // (Engine already stores ctx in summary & start event; if you later want to fully bind time,
    // you can set window.__BRUSH_TIMESEC__ and read it in safe.js)
    if(!WIN.BrushVR || typeof WIN.BrushVR.boot !== 'function'){
      console.warn('[BrushVR] missing BrushVR.boot()');
      return;
    }
    WIN.BrushVR.boot(ctx);
  }

  function wireTapStart(){
    const wrap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    if(!wrap || !btn) return false;

    wrap.setAttribute('aria-hidden','false');
    wrap.classList.add('on');

    const go = ()=>{
      wrap.setAttribute('aria-hidden','true');
      wrap.classList.remove('on');
      try{ start(); }catch(_){}
    };

    btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
    wrap.addEventListener('click', (e)=>{
      // click outside card = start too
      const card = wrap.querySelector('.tapCard');
      if(card && card.contains(e.target)) return;
      e.preventDefault();
      go();
    }, {passive:false});

    return true;
  }

  (function init(){
    const ctx = getCtx();
    DOC.body.setAttribute('data-view', ctx.view);

    if(needsTapOverlay(ctx.view)){
      const ok = wireTapStart();
      if(!ok) start();
      return;
    }
    start();
  })();
})();