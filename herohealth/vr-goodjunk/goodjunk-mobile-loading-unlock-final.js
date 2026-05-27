/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-loading-unlock-final.js
   PATCH v20260527-GOODJUNK-MOBILE-LOADING-UNLOCK-FINAL

   แก้:
   - หน้า mobile ค้างที่ loading overlay
   - shellLoading บังเกม/บัง start overlay
   - ไม่แตะ scoring / boss / powerup / summary / cooldown
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527-GOODJUNK-MOBILE-LOADING-UNLOCK-FINAL';

  if (window.__GJ_MOBILE_LOADING_UNLOCK_FINAL__) return;
  window.__GJ_MOBILE_LOADING_UNLOCK_FINAL__ = true;

  function hideLoading(){
    const loading = document.getElementById('shellLoading');
    if (!loading) return;

    loading.style.pointerEvents = 'none';
    loading.style.opacity = '0';
    loading.style.transition = 'opacity .22s ease';

    setTimeout(function(){
      if (loading && loading.parentNode) {
        loading.parentNode.removeChild(loading);
      }
    }, 260);
  }

  function unlockStartOverlay(){
    const start = document.getElementById('gjmStartOverlay');
    const main = document.getElementById('gjSoloBossMain');

    if (main) {
      main.style.display = '';
      main.style.visibility = 'visible';
      main.style.opacity = '1';
      main.style.pointerEvents = 'auto';
    }

    if (start) {
      start.style.display = '';
      start.style.visibility = 'visible';
      start.style.opacity = '1';
      start.style.pointerEvents = 'auto';
    }
  }

  function bindStartButtonAgain(){
    const btn = document.getElementById('gjmStartBtn');
    const start = document.getElementById('gjmStartOverlay');

    if (!btn || btn.dataset.gjLoadingUnlockBound === '1') return;
    btn.dataset.gjLoadingUnlockBound = '1';

    btn.addEventListener('click', function(){
      hideLoading();

      try {
        if (typeof window.startGame === 'function') {
          window.startGame();
          return;
        }

        if (typeof window.start === 'function') {
          window.start();
          return;
        }

        if (typeof window.GJ_START_GAME === 'function') {
          window.GJ_START_GAME();
          return;
        }

        window.dispatchEvent(new CustomEvent('gj:start-request', {
          detail:{ from:VERSION }
        }));

        document.dispatchEvent(new CustomEvent('gj:start-request', {
          detail:{ from:VERSION }
        }));
      } catch(e) {
        console.warn('[GoodJunk Loading Unlock] start call skipped', e);
      }

      if (start) {
        start.style.opacity = '0';
        start.style.pointerEvents = 'none';
        setTimeout(function(){
          if (start && start.parentNode) start.remove();
        }, 220);
      }
    }, true);
  }

  function boot(){
    setTimeout(hideLoading, 900);
    setTimeout(unlockStartOverlay, 950);
    setTimeout(bindStartButtonAgain, 1000);

    setTimeout(hideLoading, 1800);
    setTimeout(unlockStartOverlay, 1850);
    setTimeout(bindStartButtonAgain, 1900);

    console.info('[GoodJunk Mobile Loading Unlock Final]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
