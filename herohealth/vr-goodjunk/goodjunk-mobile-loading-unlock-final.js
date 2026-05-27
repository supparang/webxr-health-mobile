/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-loading-unlock-final.js
   PATCH v20260527c-GOODJUNK-MOBILE-LOADING-UNLOCK-SAFE-FINAL

   PURPOSE:
   - แก้หน้าโหลด GoodJunk Solo Boss ค้าง
   - ปลดเฉพาะ shell loading เท่านั้น
   - ไม่เรียก startWarmup / startGame เอง
   - ไม่แตะ powerups / hitbox / score / boss / summary / cooldown
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527c-GOODJUNK-MOBILE-LOADING-UNLOCK-SAFE-FINAL';

  if (window.__GJ_MOBILE_LOADING_UNLOCK_SAFE_FINAL__) return;
  window.__GJ_MOBILE_LOADING_UNLOCK_SAFE_FINAL__ = true;

  function byId(id){
    return document.getElementById(id);
  }

  function qsa(sel){
    try{
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function hardHide(el){
    if (!el || !el.style) return;

    try{
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
      el.style.setProperty('display', 'none', 'important');
    }catch(e){}

    try{
      if (el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }

  function unlockMainVisibilityOnly(){
    const main = byId('gjSoloBossMain');
    const area = byId('gjSoloBossArea');

    [main, area].forEach(function(el){
      if (!el || !el.style) return;

      try{
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
      }catch(e){}
    });
  }

  function removeShellLoadingOnly(){
    [
      byId('shellLoading'),
      byId('gjLoading'),
      byId('gjmLoading'),
      byId('gjSoloBossLoading')
    ].forEach(hardHide);

    qsa('.shell-loading,.gj-loading,.gjm-loading,.loading-screen').forEach(function(el){
      hardHide(el);
    });
  }

  function keepStartOverlayNormal(){
    const start = byId('gjmStartOverlay');
    const btn = byId('gjmStartBtn');

    /*
      สำคัญ:
      ถ้า start overlay ยังอยู่ ให้ปล่อยให้ผู้เล่นกดเอง
      ห้ามซ่อน ห้ามเรียก start เอง
    */
    if (start && start.style) {
      try{
        start.style.setProperty('pointer-events', 'auto', 'important');
        start.style.setProperty('visibility', 'visible', 'important');
      }catch(e){}
    }

    if (btn && btn.style) {
      try{
        btn.style.setProperty('pointer-events', 'auto', 'important');
        btn.style.setProperty('visibility', 'visible', 'important');
        btn.style.setProperty('opacity', '1', 'important');
      }catch(e){}
    }
  }

  function apply(){
    unlockMainVisibilityOnly();
    removeShellLoadingOnly();
    keepStartOverlayNormal();
  }

  function boot(){
    apply();

    setTimeout(apply, 150);
    setTimeout(apply, 450);
    setTimeout(apply, 900);
    setTimeout(apply, 1500);

    console.info('[GoodJunk Mobile Loading Unlock Safe Final]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();