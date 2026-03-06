// === /herohealth/vr-brush/brush.boot.js ===
// Brush BOOT — BLOOM 1–6 PRO (boot only; start via quiz)
// FULL v20260305b-BRUSH-BOOT
(function(){
  'use strict';
  const WIN = window, DOC = document;
  const qs = (k,d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function isTapRecommended(view){
    view = String(view||'').toLowerCase();
    return (view === 'mobile' || view === 'cvr' || view === 'vr');
  }

  function showTapOverlay(){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    if(!tap || !btn) return;
    tap.style.display = 'grid';
    const go = ()=>{ try{ tap.style.display='none'; }catch(_){ } };
    btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
    tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
  }

  async function loadSafe(){
    let bootGame = WIN.__BRUSH_BOOTGAME__;
    if (!bootGame){
      const mod = await import('./brush.safe.js?v=20260305b');
      bootGame = mod && mod.bootGame ? mod.bootGame : null;
    }
    return bootGame;
  }

  async function init(){
    const wrap = DOC.getElementById('br-wrap');
    if(wrap){ wrap.dataset.state = 'play'; }

    const view = String(qs('view','')||DOC.body.getAttribute('data-view')||'pc').toLowerCase();
    DOC.body.setAttribute('data-view', view);

    const bootGame = await loadSafe();
    if (!bootGame){
      console.error('[BrushBOOT] bootGame not found');
      return;
    }

    const api = bootGame();
    WIN.HHBrush_BOOT = api;

    if (isTapRecommended(view)) showTapOverlay();
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();