// === /herohealth/vr-brush/brush.boot.js ===
// FULL v20260303c-BRUSH-BOOT-BRIDGE
(function(){
  'use strict';
  const WIN = window, DOC = document;
  const qs = (k,d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function isTapNeeded(view){
    view = String(view||'').toLowerCase();
    return (view === 'mobile' || view === 'cvr' || view === 'vr');
  }

  function setupTapStart(start){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    if(!tap || !btn){ start(); return; }
    tap.style.display = 'grid';
    const go = ()=>{
      try{ tap.style.display='none'; }catch(_){}
      start();
    };
    btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
    tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
  }

  async function boot(){
    const wrap = DOC.getElementById('br-wrap');
    if(wrap){ wrap.dataset.state = 'play'; }

    const ai = String(qs('ai','1')).toLowerCase();
    if (ai === '0') WIN.__BRUSH_AI_OFF__ = true;

    // ✅ Prefer bridge-loaded bootGame
    let bootGame = WIN.__BRUSH_BOOTGAME__;
    if (!bootGame){
      // fallback dynamic import
      try{
        const mod = await import('./brush.safe.js?v=20260303c');
        bootGame = mod && mod.bootGame ? mod.bootGame : null;
      }catch(e){
        console.error('[BrushBOOT] cannot load safe', e);
        return;
      }
    }

    const api = bootGame ? bootGame() : null;
    WIN.HHBrush_BOOT = api;

    // autostart
    if (api && typeof api.start === 'function') await api.start();
  }

  function init(){
    const view = String(qs('view','')||DOC.body.getAttribute('data-view')||'pc').toLowerCase();
    DOC.body.setAttribute('data-view', view);

    if(isTapNeeded(view)) setupTapStart(()=>boot());
    else boot();
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();