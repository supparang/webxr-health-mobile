// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR Boot — SAFE PATCH (v20260223-bootguard)
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__BRUSH_BOOT_DONE__) return;
  WIN.__BRUSH_BOOT_DONE__ = true;

  function showFatal(err){
    try{
      const el = DOC.getElementById('fatal');
      if (!el) return;
      el.classList.remove('br-hidden');
      const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
      el.textContent = 'BOOT ERROR:\n' + msg;
    }catch(_){}
  }

  function ready(fn){
    if (DOC.readyState === 'loading'){
      DOC.addEventListener('DOMContentLoaded', fn, { once:true });
    }else{
      fn();
    }
  }

  ready(function(){
    try{
      // เรียก init จาก safe engine (รองรับหลายชื่อ)
      if (typeof WIN.initBrushGame === 'function') {
        WIN.initBrushGame();
      } else if (typeof WIN.BrushBoot === 'function') {
        WIN.BrushBoot();
      } else if (typeof WIN.__brushInit === 'function') {
        WIN.__brushInit();
      } else {
        console.warn('[BrushBoot] No init function found (initBrushGame / BrushBoot / __brushInit)');
      }
      // ❌ ห้าม auto-start ที่นี่ — ให้ผู้เล่นกดเริ่มเอง
    }catch(err){
      console.error('[BrushBoot] init error', err);
      showFatal(err);
    }
  });
})();