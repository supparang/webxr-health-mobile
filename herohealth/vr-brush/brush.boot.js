// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — SAFE (tap-to-start for mobile/cvr/vr)
// PATCH v20260303-BRUSH-BOOT-SAFE
(function(){
  'use strict';
  const WIN = window, DOC = document;
  if(WIN.__BRUSH_BOOTED__) return;
  WIN.__BRUSH_BOOTED__ = true;

  function qs(k,d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } }

  function detectTapNeeded(){
    const v = String(qs('view', DOC.body.getAttribute('data-view')||'')||'').toLowerCase();
    return (v==='mobile' || v==='cvr' || v==='vr');
  }

  function boot(){
    // safe.js is IIFE and already initialized; nothing required.
    try{ WIN.dispatchEvent(new CustomEvent('brush:boot', { detail:{ ts:Date.now() } })); }catch(_){}
  }

  function setup(){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    if(!detectTapNeeded() || !tap || !btn){ boot(); return; }
    tap.style.display='grid';
    const go=()=>{
      try{ tap.style.display='none'; }catch(_){}
      boot();
    };
    btn.addEventListener('click',(e)=>{ e.preventDefault(); go(); },{passive:false});
    tap.addEventListener('click',(e)=>{ if(e.target===tap){ e.preventDefault(); go(); } },{passive:false});
  }

  if(DOC.readyState==='loading') DOC.addEventListener('DOMContentLoaded', setup);
  else setup();
})();