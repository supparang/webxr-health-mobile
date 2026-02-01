// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — PRODUCTION (auto view, passthrough ctx, starts engine)
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const asLower = (v,d)=> String(v||d||'').toLowerCase();

  function getView(){
    const v = asLower(qs('view','pc'),'pc');
    if(v==='cardboard') return 'cvr';
    return v;
  }

  function buildCtx(){
    const run = asLower(qs('run','play'),'play');           // play|research
    const diff = asLower(qs('diff','normal'),'normal');     // easy|normal|hard
    const time = clamp(qs('time', '90'), 30, 600);
    const seed = qs('seed', null);

    // passthrough research fields
    const ctx = {
      run, diff, time,
      seed: seed!=null ? Number(seed) : (run==='research' ? 123456 : Date.now()),
      hub: qs('hub', ''),
      log: qs('log',''),
      pid: qs('pid',''),
      studyId: qs('studyId',''),
      phase: qs('phase',''),
      conditionGroup: qs('conditionGroup','')
    };
    return ctx;
  }

  function boot(){
    const view = getView();
    DOC.body.setAttribute('data-view', view);

    // tune vr-ui lockPx if needed (mobile/cvr tends to need larger lock)
    const lockPx = clamp(qs('lockPx', (view==='mobile'||view==='cvr') ? 34 : 28), 12, 60);
    WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG||{});

    const ctx = buildCtx();

    // start engine
    if(WIN.BrushVR && typeof WIN.BrushVR.boot === 'function'){
      WIN.BrushVR.boot(ctx);
    }else{
      console.warn('[BrushVR] safe.js not loaded yet');
      // best-effort retry once
      setTimeout(()=>{
        if(WIN.BrushVR && typeof WIN.BrushVR.boot === 'function') WIN.BrushVR.boot(ctx);
      }, 120);
    }
  }

  if(DOC.readyState==='loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();
})();