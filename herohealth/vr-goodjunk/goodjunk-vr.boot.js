// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Respect ?view= (do NOT override)
// ✅ Auto-detect view only when ?view is missing
// ✅ Apply body class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Emit initial quest:update (avoid "—")
// ✅ Boot engine: ./goodjunk.safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const qs = (k, d=null) => {
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  };

  function isMobileUA(){
    const ua = (navigator.userAgent || '').toLowerCase();
    return /android|iphone|ipad|ipod|mobile/.test(ua);
  }

  function hasXR(){
    return !!(navigator.xr && navigator.xr.isSessionSupported);
  }

  async function detectViewAuto(){
    // If XR is available, default to 'vr' only when user is likely in headset mode.
    // We keep conservative: mobile => 'mobile', desktop => 'pc' unless user explicitly sets view.
    // cVR should be explicitly passed as ?view=cvr in your launcher for strict crosshair mode.
    try{
      if(isMobileUA()) return 'mobile';
      return 'pc';
    }catch{
      return 'mobile';
    }
  }

  function applyViewClass(view){
    const b = DOC.body;
    if(!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

    const v = String(view||'mobile').toLowerCase();
    if(v === 'pc') b.classList.add('view-pc');
    else if(v === 'vr') b.classList.add('view-vr');
    else if(v === 'cvr') b.classList.add('view-cvr');
    else b.classList.add('view-mobile');
  }

  function emitQuestInit(){
    // กัน HUD เป็น "—" ก่อน engine ส่ง quest:update จริง
    try{
      WIN.dispatchEvent(new CustomEvent('quest:update', { detail:{
        goal:{ name:'แยกของดี/ของเสีย', sub:'แตะ/ยิง “ของดี” ให้มาก และหลบ “ของเสีย”', cur:0, target:10 },
        mini:{ name:'ครบ 3 หมู่ใน 12 วิ', sub:'ทำให้ไว ได้โบนัส', cur:0, target:3, leftSec:12, done:false },
        allDone:false
      }}));
    }catch(_){}
  }

  function onReady(fn){
    if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
    else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }

  onReady(async ()=>{
    // 1) Resolve view (respect explicit param)
    let view = qs('view', null);
    if(view){
      view = String(view).toLowerCase();
    }else{
      view = await detectViewAuto(); // conservative
    }

    // 2) Apply class for CSS
    applyViewClass(view);

    // 3) Emit initial quests so HUD never blank
    emitQuestInit();

    // 4) Collect run params
    const run  = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = Number(qs('time','80')) || 80;
    const seed = String(qs('seed', Date.now()));

    // 5) Boot engine
    try{
      engineBoot({ view, run, diff, time, seed });
    }catch(err){
      console.error('[GoodJunkVR] boot failed:', err);
      try{
        alert('GoodJunkVR: boot failed (ดู console)');
      }catch(_){}
    }

    // 6) Optional: if you want to mark page started
    try{ DOC.body?.classList.add('gj-started'); }catch(_){}
  });

})();