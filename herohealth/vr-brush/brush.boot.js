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

  function antiScrollWhilePlaying(){
    // ปลอดภัยสำหรับ mobile/cVR: กัน scroll จอ
    const wrap = DOC.getElementById('br-wrap');
    if(!wrap) return;
    const onWheel = (e)=>{
      if (wrap.dataset.state === 'play') { e.preventDefault(); }
    };
    DOC.addEventListener('wheel', onWheel, { passive:false });
    DOC.addEventListener('touchmove', (e)=>{
      if (wrap.dataset.state === 'play') { e.preventDefault(); }
    }, { passive:false });
  }

  async function startEngine(){
    // import safe game module
    const mod = await import('./brush.safe.js?v=20260301');
    if (!mod || typeof mod.bootGame !== 'function') {
      console.error('[BrushBOOT] missing bootGame() in brush.safe.js');
      return;
    }
    const api = mod.bootGame();
    // บันทึกไว้ให้ debug
    WIN.HHBrush_BOOT = api;

    // เริ่มเล่นทันทีในโหมด tap-needed
    if (api && typeof api.start === 'function') {
      await api.start();
    }
  }

  function boot(){
    const wrap = DOC.getElementById('br-wrap');
    if(wrap){
      wrap.dataset.state = wrap.dataset.state || 'menu';
    }
    antiScrollWhilePlaying();

    // AI HUD optional (ai=0 ปิด)
    const ai = String(qs('ai','1')).toLowerCase();
    if (ai === '0') {
      // ปิด listener AI ถ้ามีในอนาคต
      WIN.__BRUSH_AI_OFF__ = true;
    }

    // เปลี่ยน state เป็น play ก่อนเริ่ม
    if (wrap) wrap.dataset.state = 'play';
    startEngine();
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