// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — PRODUCTION (HHA Standard)
// ✅ Auto detect view (no override if ?view= exists)
// ✅ Tap-to-start on mobile/cvr (required for audio/vibrate + stable input)
// ✅ Pass-through ctx: pid/run/diff/time/seed/studyId/phase/conditionGroup/log/hub
// ✅ Show "how to score" 10s once per device
(function(){
  'use strict';
  const WIN = window, DOC = document;

  function getQS(){
    try { return new URL(location.href).searchParams; }
    catch { return new URLSearchParams(); }
  }
  const QS = getQS();
  const q = (k, def='') => (QS.get(k) ?? def);

  function detectView(){
    const v = String(q('view','')||'').toLowerCase();
    if (v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (Math.min(screen.width, screen.height) <= 480);
    return isMobile ? 'mobile' : 'pc';
  }

  function clamp(n,a,b){ n = Number(n)||0; return Math.max(a, Math.min(b,n)); }

  function buildCtx(){
    const ctx = {
      game: 'brush',
      view: detectView(),
      pid: q('pid',''),
      run: (q('run','play')||'play').toLowerCase(),            // play | research
      diff: (q('diff','normal')||'normal').toLowerCase(),
      time: clamp(q('time', 90), 30, 180),
      seed: q('seed','') || String(Date.now()),
      studyId: q('studyId',''),
      phase: q('phase',''),
      conditionGroup: q('conditionGroup',''),
      log: q('log',''),
      hub: q('hub','')
    };
    return ctx;
  }

  function setBodyView(view){
    try{
      DOC.body.setAttribute('data-view', view);
      // optional: class hooks
      DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
      DOC.body.classList.add('view-' + view);
    }catch(_){}
  }

  function isMobileLike(view){
    return (view==='mobile' || view==='cvr' || view==='vr');
  }

  function showHowtoOnce(){
    const key = 'HHA_BRUSH_HOWTO_SEEN_V1';
    let seen = false;
    try{ seen = localStorage.getItem(key) === '1'; }catch(_){}
    if(seen) return;

    const el = DOC.getElementById('howto');
    if(!el) return;

    el.style.display = 'grid';
    const close = ()=>{
      el.style.display = 'none';
      try{ localStorage.setItem(key, '1'); }catch(_){}
      DOC.removeEventListener('pointerdown', onAny, true);
    };
    const onAny = (ev)=>{ ev.preventDefault(); close(); };
    DOC.addEventListener('pointerdown', onAny, true);

    // auto close 10s
    setTimeout(()=>{ if(el.style.display!=='none') close(); }, 10000);
  }

  function startGame(){
    const ctx = buildCtx();
    setBodyView(ctx.view);

    if(!WIN.BrushVR || typeof WIN.BrushVR.boot !== 'function'){
      console.warn('[BrushVR] missing BrushVR.boot');
      return;
    }
    try{ WIN.BrushVR.boot(ctx); }catch(err){ console.error(err); }

    showHowtoOnce();
  }

  // Tap-to-start gating for mobile
  function init(){
    const view = detectView();
    setBodyView(view);

    const tapStart = DOC.getElementById('tapStart');
    const tapBtn = DOC.getElementById('tapBtn');

    // if mobile-like => require user gesture
    if(isMobileLike(view)){
      if(tapStart) tapStart.setAttribute('aria-hidden','false');
      if(tapStart) tapStart.style.display = 'grid';

      const go = ()=>{
        try{ tapStart.style.display='none'; tapStart.setAttribute('aria-hidden','true'); }catch(_){}
        // small vibration = confirm input (safe)
        try{ if(navigator.vibrate) navigator.vibrate(15); }catch(_){}
        startGame();
      };

      // button + overlay tap
      if(tapBtn) tapBtn.addEventListener('click', (ev)=>{ ev.preventDefault(); go(); }, {passive:false});
      if(tapStart) tapStart.addEventListener('click', (ev)=>{ ev.preventDefault(); go(); }, {passive:false});
    }else{
      if(tapStart) { tapStart.style.display='none'; tapStart.setAttribute('aria-hidden','true'); }
      startGame();
    }
  }

  // Boot after DOM ready
  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init);
  else init();
})();