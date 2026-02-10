// === /fitness/js/jump-duck.boot.js ===
// Jump-Duck BOOT — HHA Standard (view detect + safe defaults + log/boss passthrough)
// Loads: ./jump-duck.js
'use strict';

(function(){
  const WIN = window;
  const DOC = document;

  function qsGet(k, d=''){
    try{
      const v = new URL(location.href).searchParams.get(k);
      return (v==null || String(v).trim()==='') ? d : String(v);
    }catch{ return d; }
  }
  function hasQS(k){
    try{ return new URL(location.href).searchParams.has(k); }
    catch{ return false; }
  }
  function setQS(k, v){
    try{
      const u = new URL(location.href);
      u.searchParams.set(k, v);
      history.replaceState(null,'',u.toString());
    }catch{}
  }

  // ---------- view detect (NO override if ?view exists) ----------
  function detectView(){
    const forced = (qsGet('view','')||'').toLowerCase();
    if (forced) return forced;

    const ua = navigator.userAgent || '';
    const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    const w = Math.min(WIN.innerWidth||0, DOC.documentElement.clientWidth||0, screen.width||9999);
    const h = Math.min(WIN.innerHeight||0, DOC.documentElement.clientHeight||0, screen.height||9999);
    const small = Math.min(w,h) <= 520;
    const isMobileUA = /Android|iPhone|iPad|iPod/i.test(ua);

    if ((touch || isMobileUA) && small) return 'cvr';
    if (touch || isMobileUA) return 'mobile';
    return 'pc';
  }
  function applyViewClass(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
    if (view === 'vr') b.classList.add('view-vr');
    else if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'mobile') b.classList.add('view-mobile');
    else b.classList.add('view-pc');
  }

  // ---------- safe defaults (ONLY if missing) ----------
  function ensureDefault(k, v){
    if (!hasQS(k)) setQS(k, v);
  }
  ensureDefault('mode', 'training');
  ensureDefault('diff', 'normal');
  ensureDefault('duration', '60');
  ensureDefault('boss', 'mixed');      // ✅ boss profile default

  // ---------- normalize log URL: encode if needed (only when present) ----------
  // (ปล่อยให้เกมอ่าน qsGet('log') ต่อได้ตามเดิม)
  // ไม่แก้ค่า เพราะบางทีผู้ใช้ encode มาแล้ว

  // ---------- mount classes ----------
  const view = detectView();
  applyViewClass(view);

  // ---------- load engine ----------
  const s = DOC.createElement('script');
  s.src = 'js/jump-duck.js';
  s.defer = true;
  s.onload = ()=>{};
  s.onerror = ()=>{ console.warn('Failed to load jump-duck.js'); };
  DOC.head.appendChild(s);
})();