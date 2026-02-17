// === /herohealth/vr-maskcough/maskcough.boot.js ===
// MaskCough BOOT — PRODUCTION SAFE — v20260216a
// - Sets view/run dataset
// - Ensures hub/back links are ok
// - Loads engine (maskcough.safe.js) safely
(function(){
  'use strict';

  const DOC = document;
  const WIN = window;

  function qs(k, d=''){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  }
  function getViewAuto(){
    const v = String(qs('view','')).toLowerCase().trim();
    if(v) return v;
    const ua = navigator.userAgent||'';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }

  const mode = String(qs('mode', qs('run','play'))).toLowerCase().trim() || 'play';
  const view = getViewAuto();

  const wrap = DOC.getElementById('mc-wrap');
  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.run = mode;
  }

  // ensure end-back uses hub param when present
  const hub = String(qs('hub','../hub.html')).trim();
  const btnEndBack = DOC.getElementById('btnEndBack');
  if(btnEndBack){
    try{ btnEndBack.href = new URL(hub, location.href).toString(); }
    catch{ btnEndBack.href = hub || '../hub.html'; }
  }

  // Load engine safely (idempotent)
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s = DOC.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = ()=>resolve(true);
      s.onerror = ()=>reject(new Error('load fail: '+src));
      DOC.body.appendChild(s);
    });
  }

  // If engine already present, do nothing
  if(WIN.__HHA_MASKCOUGH_BOOTED__) return;
  WIN.__HHA_MASKCOUGH_BOOTED__ = true;

  loadScript('./maskcough.safe.js?v=20260216a')
    .catch(()=> {
      // show minimal error without killing page
      const el = DOC.getElementById('mc-prompt');
      if(el){
        el.textContent = 'โหลด maskcough.safe.js ไม่ได้ (เช็ก path/ชื่อไฟล์)';
        el.classList.add('show');
      }
      console.warn('[MaskCough] engine load failed');
    });
})();