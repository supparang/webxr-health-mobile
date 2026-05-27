/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-loading-unlock-final.js
   PATCH v20260527-GOODJUNK-MOBILE-LOADING-UNLOCK-FINAL

   PURPOSE:
   - แก้หน้าโหลด GoodJunk Solo Boss ค้างบน Mobile/PC
   - ถ้า shellLoading / loading card / blocker overlay ไม่หาย ให้ปลดออก
   - เปิด start overlay ให้กดเริ่มเล่นได้
   - ไม่แตะ score / boss HP / powerups / cooldown / summary
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527-GOODJUNK-MOBILE-LOADING-UNLOCK-FINAL';

  if (window.__GJ_MOBILE_LOADING_UNLOCK_FINAL__) return;
  window.__GJ_MOBILE_LOADING_UNLOCK_FINAL__ = true;

  function $(id){
    return document.getElementById(id);
  }

  function qsa(sel){
    try {
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    } catch(e) {
      return [];
    }
  }

  function setStyle(el, styles){
    if (!el || !el.style) return;
    Object.keys(styles).forEach(function(k){
      try {
        el.style.setProperty(k, styles[k], 'important');
      } catch(e) {
        try { el.style[k] = styles[k]; } catch(_){}
      }
    });
  }

  function removeHardLoading(){
    const loadingIds = [
      'shellLoading',
      'loading',
      'gjLoading',
      'gjmLoading',
      'gjSoloBossLoading'
    ];

    loadingIds.forEach(function(id){
      const el = $(id);
      if (!el) return;

      setStyle(el, {
        'opacity': '0',
        'visibility': 'hidden',
        'pointer-events': 'none',
        'display': 'none'
      });

      try { el.remove(); } catch(e){}
    });

    qsa('.shell-loading,.gj-loading,.gjm-loading,.loading,.loader,.loading-screen').forEach(function(el){
      setStyle(el, {
        'opacity': '0',
        'visibility': 'hidden',
        'pointer-events': 'none',
        'display': 'none'
      });

      try { el.remove(); } catch(e){}
    });
  }

  function unlockMainGame(){
    const main = $('gjSoloBossMain');
    const area = $('gjSoloBossArea');
    const hud = $('gjmHud');

    [main, area, hud].forEach(function(el){
      if (!el) return;

      setStyle(el, {
        'opacity': '1',
        'visibility': 'visible',
        'pointer-events': 'auto'
      });
    });

    qsa('.gjm-root,.gjm-area,.gjm-hud').forEach(function(el){
      setStyle(el, {
        'opacity': '1',
        'visibility': 'visible',
        'pointer-events': 'auto'
      });
    });
  }

  function ensureStartOverlayUsable(){
    const start = $('gjmStartOverlay');
    const btn = $('gjmStartBtn');

    if (start) {
      setStyle(start, {
        'opacity': '1',
        'visibility': 'visible',
        'pointer-events': 'auto',
        'display': 'grid',
        'z-index': '80'
      });
    }

    if (btn) {
      setStyle(btn, {
        'pointer-events': 'auto',
        'visibility': 'visible',
        'opacity': '1'
      });

      if (!btn.dataset.gjLoadingUnlockBound) {
        btn.dataset.gjLoadingUnlockBound = '1';

        btn.addEventListener('click', function(){
          removeHardLoading();

          if (start) {
            setStyle(start, {
              'opacity': '0',
              'visibility': 'hidden',
              'pointer-events': 'none',
              'display': 'none'
            });
          }

          try {
            if (typeof window.startWarmup === 'function') {
              window.startWarmup();
              return;
            }

            if (typeof window.startGame === 'function') {
              window.startGame();
              return;
            }

            if (typeof window.GJ_START_GAME === 'function') {
              window.GJ_START_GAME();
              return;
            }

            window.dispatchEvent(new CustomEvent('gj:start-request', {
              detail: {
                from: VERSION,
                mode: 'mobile'
              }
            }));
          } catch(e) {
            console.warn('[GoodJunk Mobile Loading Unlock] start fallback failed', e);
          }
        }, true);
      }
    }
  }

  function unlockBlockingOverlays(){
    qsa('[data-loading],[data-loader],[data-blocker],.blocker,.modal-backdrop,.overlay-blocker').forEach(function(el){
      const id = String(el.id || '').toLowerCase();
      const cls = String(el.className || '').toLowerCase();

      const shouldSkip =
        id.includes('summary') ||
        cls.includes('summary') ||
        id.includes('reward') ||
        cls.includes('reward') ||
        id.includes('start') ||
        cls.includes('start');

      if (shouldSkip) return;

      setStyle(el, {
        'pointer-events': 'none'
      });
    });
  }

  function apply(){
    unlockMainGame();
    removeHardLoading();
    unlockBlockingOverlays();
    ensureStartOverlayUsable();
  }

  function boot(){
    apply();

    setTimeout(apply, 100);
    setTimeout(apply, 350);
    setTimeout(apply, 800);
    setTimeout(apply, 1500);
    setTimeout(apply, 2500);

    if (window.MutationObserver) {
      let pending = false;

      const mo = new MutationObserver(function(){
        if (pending) return;

        pending = true;
        requestAnimationFrame(function(){
          pending = false;
          apply();
        });
      });

      try {
        mo.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style','class','hidden']
        });
      } catch(e){}
    }

    console.info('[GoodJunk Mobile Loading Unlock Final]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
