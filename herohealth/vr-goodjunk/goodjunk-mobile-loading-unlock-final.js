/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-loading-unlock-final.js
   PATCH v20260527e-GOODJUNK-MOBILE-LOADING-HARD-UNLOCK-FINAL

   PURPOSE:
   - แก้ค้างหน้า Loading Card บน Mobile
   - ใช้หลังสุดของ goodjunk-solo-boss.html
   - ไม่แตะ scoring / target / powerups / cooldown
   - ลบ overlay/card ที่มีข้อความ GoodJunk Solo Boss + กำลังเตรียม
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527e-GOODJUNK-MOBILE-LOADING-HARD-UNLOCK-FINAL';
  window.__GJ_MOBILE_LOADING_HARD_UNLOCK_FINAL__ = VERSION;

  function q(sel, root){
    try{ return (root || document).querySelector(sel); }catch(e){ return null; }
  }

  function qa(sel, root){
    try{ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function isVisible(el){
    if (!el) return false;
    try{
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return (
        r.width > 40 &&
        r.height > 30 &&
        cs.display !== 'none' &&
        cs.visibility !== 'hidden' &&
        Number(cs.opacity || 1) > 0
      );
    }catch(e){
      return true;
    }
  }

  function kill(el){
    if (!el) return;

    try{
      el.setAttribute('data-gj-killed-loading', VERSION);
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('opacity','0','important');
      el.style.setProperty('pointer-events','none','important');
      el.style.setProperty('z-index','-999999','important');
      el.style.setProperty('transform','translateY(-9999px)','important');
    }catch(e){}

    try{
      if (el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }

  function textOf(el){
    try{ return (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim(); }
    catch(e){ return ''; }
  }

  function findLoadingRootFromText(){
    const all = qa('body *');
    const hits = [];

    all.forEach(function(el){
      if (!isVisible(el)) return;

      const txt = textOf(el);
      if (!txt) return;

      const isGoodJunkLoading =
        txt.includes('GoodJunk Solo Boss') &&
        (
          txt.includes('กำลังเตรียม') ||
          txt.includes('อาหารดี') ||
          txt.includes('อาหารขยะ') ||
          txt.includes('ภารกิจโภชนาการ')
        );

      if (!isGoodJunkLoading) return;

      let cur = el;
      let best = el;

      for (let i = 0; i < 8 && cur && cur !== document.body; i++){
        try{
          const cs = getComputedStyle(cur);
          const r = cur.getBoundingClientRect();

          if (
            cs.position === 'fixed' ||
            cs.position === 'absolute' ||
            r.width >= window.innerWidth * 0.45 ||
            r.height >= window.innerHeight * 0.18 ||
            String(cur.className || '').includes('loading') ||
            String(cur.id || '').toLowerCase().includes('loading')
          ){
            best = cur;
          }
        }catch(e){}

        cur = cur.parentElement;
      }

      hits.push(best);
    });

    return hits;
  }

  function killKnownLoading(){
    [
      '#shellLoading',
      '#gjLoading',
      '#gjmLoading',
      '#gjSoloBossLoading',
      '#goodjunkLoading',
      '#goodjunkMobileLoading',
      '.shell-loading',
      '.shell-loading-card',
      '.gj-loading',
      '.gj-loading-card',
      '.gjm-loading',
      '.gjm-loading-card',
      '.loading',
      '.loading-card',
      '.loading-screen',
      '.gj-mobile-loading',
      '.gj-mobile-loading-card',
      '[data-loading]',
      '[data-gj-loading]',
      '[data-role="loading"]'
    ].forEach(function(sel){
      qa(sel).forEach(kill);
    });
  }

  function killFullScreenBlockers(){
    qa('body > div, body > section, body > main, body > article').forEach(function(el){
      if (!isVisible(el)) return;

      const txt = textOf(el);
      const idc = String(el.id || '') + ' ' + String(el.className || '');

      if (
        idc.toLowerCase().includes('loading') ||
        (
          txt.includes('GoodJunk Solo Boss') &&
          txt.includes('กำลังเตรียม')
        )
      ){
        kill(el);
      }
    });
  }

  function forceGameVisible(){
    [
      '#gjSoloBossMain',
      '#gjSoloBossArea',
      '.gjm-root',
      '.gjm-area'
    ].forEach(function(sel){
      qa(sel).forEach(function(el){
        try{
          el.style.setProperty('display','block','important');
          el.style.setProperty('visibility','visible','important');
          el.style.setProperty('opacity','1','important');
          el.style.setProperty('pointer-events','auto','important');
          el.style.setProperty('transform','none','important');
        }catch(e){}
      });
    });

    const area = q('#gjSoloBossArea');
    if (area){
      try{
        area.style.setProperty('pointer-events','auto','important');
      }catch(e){}
    }

    const startOverlay = q('#gjmStartOverlay');
    const startBtn = q('#gjmStartBtn');

    if (startOverlay){
      try{
        startOverlay.style.setProperty('display','grid','important');
        startOverlay.style.setProperty('visibility','visible','important');
        startOverlay.style.setProperty('opacity','1','important');
        startOverlay.style.setProperty('pointer-events','auto','important');
        startOverlay.style.setProperty('z-index','80','important');
        startOverlay.style.setProperty('transform','none','important');
      }catch(e){}
    }

    if (startBtn){
      try{
        startBtn.style.setProperty('display','inline-block','important');
        startBtn.style.setProperty('visibility','visible','important');
        startBtn.style.setProperty('opacity','1','important');
        startBtn.style.setProperty('pointer-events','auto','important');
      }catch(e){}
    }
  }

  function hardUnlock(){
    killKnownLoading();

    findLoadingRootFromText().forEach(kill);

    killFullScreenBlockers();

    forceGameVisible();

    try{
      document.documentElement.style.setProperty('overflow','hidden','important');
      document.body.style.setProperty('overflow','hidden','important');
    }catch(e){}
  }

  function boot(){
    hardUnlock();

    [
      60,120,200,320,500,750,1000,1300,1600,2000,
      2500,3000,4000,5000,6500,8000,10000,12000
    ].forEach(function(ms){
      setTimeout(hardUnlock, ms);
    });

    let n = 0;
    const timer = setInterval(function(){
      n++;
      hardUnlock();
      if (n >= 100) clearInterval(timer);
    }, 250);

    try{
      const mo = new MutationObserver(function(){
        hardUnlock();
      });

      mo.observe(document.documentElement || document.body, {
        childList:true,
        subtree:true,
        attributes:true,
        attributeFilter:['class','style','id']
      });

      setTimeout(function(){
        try{ mo.disconnect(); }catch(e){}
      }, 20000);
    }catch(e){}

    window.addEventListener('pageshow', hardUnlock, true);
    window.addEventListener('focus', hardUnlock, true);
    document.addEventListener('visibilitychange', hardUnlock, true);
    document.addEventListener('pointerdown', hardUnlock, true);
    document.addEventListener('touchstart', hardUnlock, true);

    console.info('[GoodJunk Mobile Loading Hard Unlock]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
