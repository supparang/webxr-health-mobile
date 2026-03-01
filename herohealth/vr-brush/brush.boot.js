// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (tap-to-start + optional AI HUD)
// ✅ ai=0 => ไม่โชว์/ไม่ฟัง brush:ai
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

  function boot(){
    // (engine autoload in brush.safe.js)
    // แต่เราทำ “anti-scroll” ช่วงเล่นแบบ global ที่นี่ให้ด้วย (ปลอดภัย)
    const wrap = DOC.getElementById('br-wrap');
    if(wrap){
      wrap.dataset.state = wrap.dataset.state || 'menu';
    }
  }

  function init(){
    const view = String(qs('view','')||DOC.body.getAttribute('data-view')||'pc').toLowerCase();
    DOC.body.setAttribute('data-view', view);

    if(isTapNeeded(view)) setupTapStart(boot);
    else boot();
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();