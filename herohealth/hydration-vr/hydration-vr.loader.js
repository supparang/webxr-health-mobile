// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (AUTO VIEW + AUTO KIDS)
// ✅ Auto view: pc/mobile/cvr/cardboard (ตามของเดิมที่คุณมีอยู่)
// ✅ Auto kids=1 ONLY for mobile/cvr/cardboard, NOT in research, NOT if user already set kids
// ✅ Does NOT override explicit query params

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  function isResearch(){
    const r = String(qs('run', qs('runMode','play'))).toLowerCase();
    return r === 'research' || r === 'study';
  }

  function hasParam(k){
    try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; }
  }

  function isMobileUA(){
    const ua = (navigator.userAgent||'').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/.test(ua);
  }

  function inferView(){
    const v = String(qs('view','')).toLowerCase();
    if (v) return v;

    // simple: if cardboard flag in url
    const cb = String(qs('cardboard','')).toLowerCase();
    if (cb === '1' || cb === 'true') return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function applyBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
    if (view === 'cvr' || view === 'cardboard'){
      b.classList.add('view-cvr','cardboard');
    } else if (view === 'mobile'){
      b.classList.add('view-mobile');
    } else {
      b.classList.add('view-pc');
    }
  }

  function autoKids(){
    if (isResearch()) return;
    if (hasParam('kids')) return;

    const view = inferView();
    const isVRish = (view === 'cvr' || view === 'cardboard' || view === 'vr');
    const isMobile = (view === 'mobile') || isMobileUA();

    if (!isVRish && !isMobile) return;

    // choose kidspreset from diff if present
    const diff = String(qs('diff','normal')).toLowerCase();
    let preset = 'normal';
    if (diff === 'easy') preset = 'easy';
    else if (diff === 'hard') preset = 'hard';

    const u = new URL(location.href);
    u.searchParams.set('kids','1');
    if (!u.searchParams.has('kidspreset')) u.searchParams.set('kidspreset', preset);

    // replace without history spam
    history.replaceState(null, '', u.toString());
  }

  // main
  try{
    const view = inferView();
    applyBodyView(view);

    // optional: provide layers for hydration.safe.js (cardboard split)
    // ถ้าคุณมี L/R layer ids ให้ใส่ที่นี่
    WIN.HHA_VIEW = WIN.HHA_VIEW || {};
    // ตัวอย่าง (ถ้าคุณใช้จริง):
    // WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];

    autoKids();
  }catch(_){}
})();