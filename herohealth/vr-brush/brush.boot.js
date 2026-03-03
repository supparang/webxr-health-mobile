// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — SAFE
// PATCH v20260303-BRUSH-BOOT-SAFE
(function(){
  'use strict';
  const WIN = window, DOC = document;

  if(WIN.__BRUSH_BOOTED__) return;
  WIN.__BRUSH_BOOTED__ = true;

  function qs(k,d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } }
  function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }

  function buildCtx(){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    const hub  = String(qs('hub','')||'');
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = num(qs('time', 80), 80);
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const ai   = String(qs('ai','1')) !== '0';

    return { view, hub, seed, time, diff, ai };
  }

  function needsTap(view){
    view = String(view||'').toLowerCase();
    return (view === 'mobile' || view === 'cvr' || view === 'vr');
  }

  function boot(){
    const ctx = buildCtx();
    DOC.body.setAttribute('data-view', ctx.view);

    // engine loads itself (IIFE) — nothing else required here
    // but we can emit a soft hint:
    try{ WIN.dispatchEvent(new CustomEvent('brush:boot', { detail:ctx })); }catch(_){}
  }

  function setupTapStart(){
    const ctx = buildCtx();
    if(!needsTap(ctx.view)){ boot(); return; }

    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    if(!tap || !btn){ boot(); return; }

    tap.style.display = 'grid';
    const go = ()=>{
      try{ tap.style.display='none'; }catch(_){}
      boot();
    };
    btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
    tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', setupTapStart);
  else setupTapStart();
})();