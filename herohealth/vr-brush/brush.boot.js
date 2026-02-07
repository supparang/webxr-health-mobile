// === /herohealth/brush-vr/brush.boot.js ===
// BrushVR Boot — PRODUCTION (HHA Standard)
// ✅ Auto-detect view ONLY when missing (never override)
// ✅ Reads query: view/run/diff/time/seed/hub/pid/log/studyId/phase/conditionGroup
// ✅ Sets body data-view
// ✅ Tap-to-start for mobile/cvr/vr
// ✅ Calls BrushVR.boot(ctx)
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function detectView(){
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (Math.min(screen.width, screen.height) <= 480);
    return isMobile ? 'mobile' : 'pc';
  }

  function getCtx(){
    // view: NEVER override if provided
    const view = String(has('view') ? qs('view','') : detectView()).toLowerCase() || 'pc';

    const run  = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(qs('time','90'), 30, 180);

    // seed: if missing, generate once per page load (still deterministic enough)
    const seed = Number(qs('seed','')) || Date.now();

    const hub = String(qs('hub',''));

    // research/session
    const pid = String(qs('pid',''));
    const log = String(qs('log',''));

    const studyId = String(qs('studyId',''));
    const phase = String(qs('phase',''));
    const conditionGroup = String(qs('conditionGroup',''));

    return { view, run, diff, time, seed, hub, pid, log, studyId, phase, conditionGroup };
  }

  function needsTapOverlay(view){
    return (view === 'mobile' || view === 'cvr' || view === 'vr');
  }

  function start(){
    const ctx = getCtx();
    DOC.body.setAttribute('data-view', ctx.view);

    if(!WIN.BrushVR || typeof WIN.BrushVR.boot !== 'function'){
      console.warn('[BrushVR] missing BrushVR.boot()');
      return;
    }
    WIN.BrushVR.boot(ctx);
  }

  function wireTapStart(){
    const wrap = DOC.getElementById('tapStart');
    const btn  = DOC.getElementById('tapBtn');
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