/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-loading-unlock-final.js
   PATCH v20260527d-GOODJUNK-MOBILE-LOADING-KILL-SWITCH-FINAL

   FIX:
   - หน้า mobile ค้างที่ GoodJunk Solo Boss loading card
   - ถอดเฉพาะ loading overlay ที่บังหน้าเกม
   - ไม่แตะ start / score / target / powerups / cooldown
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527d-GOODJUNK-MOBILE-LOADING-KILL-SWITCH-FINAL';

  window.__GJ_MOBILE_LOADING_KILL_SWITCH_FINAL__ = VERSION;

  function $(sel){
    try{ return document.querySelector(sel); }catch(e){ return null; }
  }

  function $all(sel){
    try{ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function hideAndRemove(el){
    if (!el) return;

    try{
      el.style.setProperty('opacity','0','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('pointer-events','none','important');
      el.style.setProperty('display','none','important');
      el.style.setProperty('z-index','-1','important');
    }catch(e){}

    try{
      if (el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }

  function looksLikeLoading(el){
    if (!el) return false;
    const txt = (el.textContent || '').trim();
    return (
      txt.includes('GoodJunk Solo Boss') &&
      (
        txt.includes('กำลังเตรียมบอส') ||
        txt.includes('กำลังเตรียม') ||
        txt.includes('อาหารดี') ||
        txt.includes('อาหารขยะ')
      )
    );
  }

  function removeLoadingByText(){
    const nodes = $all('div,section,main,article');
    nodes.forEach(function(el){
      if (!looksLikeLoading(el)) return;

      let cur = el;
      let best = el;

      for (let i = 0; i < 6 && cur; i++){
        const cs = window.getComputedStyle ? getComputedStyle(cur) : null;
        if (
          cur.id === 'shellLoading' ||
          (cur.className && String(cur.className).includes('shell-loading')) ||
          (cs && (cs.position === 'fixed' || cs.position === 'absolute'))
        ){
          best = cur;
        }
        cur = cur.parentElement;
      }

      hideAndRemove(best);
    });
  }

  function unlockGameLayer(){
    [
      '#gjSoloBossMain',
      '#gjSoloBossArea',
      '.gjm-root',
      '.gjm-area'
    ].forEach(function(sel){
      $all(sel).forEach(function(el){
        try{
          el.style.setProperty('opacity','1','important');
          el.style.setProperty('visibility','visible','important');
        }catch(e){}
      });
    });

    const start = $('#gjmStartOverlay');
    const btn = $('#gjmStartBtn');

    if (start){
      try{
        start.style.setProperty('visibility','visible','important');
        start.style.setProperty('pointer-events','auto','important');
      }catch(e){}
    }

    if (btn){
      try{
        btn.style.setProperty('visibility','visible','important');
        btn.style.setProperty('opacity','1','important');
        btn.style.setProperty('pointer-events','auto','important');
      }catch(e){}
    }
  }

  function killLoading(){
    [
      '#shellLoading',
      '#gjLoading',
      '#gjmLoading',
      '#gjSoloBossLoading',
      '.shell-loading',
      '.gj-loading',
      '.gjm-loading',
      '.loading-screen',
      '.loading',
      '[data-loading]',
      '[data-gj-loading]'
    ].forEach(function(sel){
      $all(sel).forEach(hideAndRemove);
    });

    removeLoadingByText();
    unlockGameLayer();
  }

  function boot(){
    killLoading();

    const times = [80,150,300,600,900,1300,1800,2500,3500,5000,7000,10000];
    times.forEach(function(t){
      setTimeout(killLoading, t);
    });

    let n = 0;
    const timer = setInterval(function(){
      n++;
      killLoading();
      if (n >= 80) clearInterval(timer);
    }, 250);

    window.addEventListener('pageshow', killLoading, true);
    window.addEventListener('focus', killLoading, true);
    document.addEventListener('visibilitychange', killLoading, true);
    document.addEventListener('pointerdown', killLoading, true);
    document.addEventListener('touchstart', killLoading, true);

    console.info('[GoodJunk Mobile Loading Kill Switch]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
