/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-start-unblock-final.js
   PATCH v20260527a-GOODJUNK-MOBILE-START-UNBLOCK-FINAL

   PURPOSE:
   - แก้ Mobile ค้างหน้า loading
   - ไม่สร้าง loading ใหม่
   - ไม่แตะ score / powerups / target / cooldown
   - บังคับเอา loading ออก แล้วเปิดปุ่มเริ่มเกมจริง
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527a-GOODJUNK-MOBILE-START-UNBLOCK-FINAL';
  window.__GJ_MOBILE_START_UNBLOCK_FINAL__ = VERSION;

  function $(sel){
    try{ return document.querySelector(sel); }catch(e){ return null; }
  }

  function $all(sel){
    try{ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function kill(el){
    if (!el) return;
    try{
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('opacity','0','important');
      el.style.setProperty('pointer-events','none','important');
      el.style.setProperty('z-index','-999999','important');
      el.setAttribute('data-gj-mobile-killed', VERSION);
    }catch(e){}
    try{
      if (el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }

  function removeLoading(){
    [
      '#shellLoading',
      '.shell-loading',
      '.shell-loading-card',
      '#goodjunkMobileLoading',
      '.gj-mobile-loading',
      '.gj-mobile-loading-card',
      '.loading',
      '.loading-card',
      '.loading-screen',
      '[data-loading]',
      '[data-gj-loading]'
    ].forEach(function(sel){
      $all(sel).forEach(kill);
    });

    $all('body *').forEach(function(el){
      let t = '';
      try{
        t = (el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
      }catch(e){}

      if (
        t &&
        t.includes('GoodJunk Solo Boss') &&
        t.includes('กำลังเตรียม')
      ){
        let cur = el;
        let best = el;

        for (let i = 0; i < 8 && cur && cur !== document.body; i++){
          try{
            const r = cur.getBoundingClientRect();
            const cs = getComputedStyle(cur);

            if (
              r.width > 220 &&
              r.height > 80 &&
              (
                cs.position === 'fixed' ||
                cs.position === 'absolute' ||
                cs.position === 'relative'
              )
            ){
              best = cur;
            }
          }catch(e){}

          cur = cur.parentElement;
        }

        kill(best);
      }
    });
  }

  function showGame(){
    [
      '#gjSoloBossMain',
      '#gjSoloBossArea',
      '.gjm-root',
      '.gjm-area'
    ].forEach(function(sel){
      $all(sel).forEach(function(el){
        try{
          el.style.setProperty('display','block','important');
          el.style.setProperty('visibility','visible','important');
          el.style.setProperty('opacity','1','important');
          el.style.setProperty('pointer-events','auto','important');
          el.style.setProperty('z-index','20','important');
          el.style.setProperty('transform','none','important');
        }catch(e){}
      });
    });
  }

  function showStartOverlay(){
    const overlay = $('#gjmStartOverlay');
    const btn = $('#gjmStartBtn');

    if (overlay){
      try{
        overlay.style.setProperty('display','grid','important');
        overlay.style.setProperty('visibility','visible','important');
        overlay.style.setProperty('opacity','1','important');
        overlay.style.setProperty('pointer-events','auto','important');
        overlay.style.setProperty('z-index','1000','important');
        overlay.style.setProperty('transform','none','important');
      }catch(e){}
    }

    if (btn){
      try{
        btn.style.setProperty('display','inline-block','important');
        btn.style.setProperty('visibility','visible','important');
        btn.style.setProperty('opacity','1','important');
        btn.style.setProperty('pointer-events','auto','important');
        btn.disabled = false;
      }catch(e){}
    }
  }

  function makeEmergencyStartButton(){
    if ($('#gjEmergencyStartBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'gjEmergencyStartBtn';
    btn.type = 'button';
    btn.textContent = '▶ เริ่มเล่น';
    btn.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:calc(92px + env(safe-area-inset-bottom,0px))',
      'transform:translateX(-50%)',
      'z-index:999999',
      'border:0',
      'border-radius:999px',
      'padding:14px 24px',
      'background:linear-gradient(135deg,#22c55e,#2563eb)',
      'color:#fff',
      'font-weight:1000',
      'font-size:18px',
      'box-shadow:0 18px 36px rgba(15,23,42,.25)'
    ].join(';');

    btn.addEventListener('click', function(){
      removeLoading();
      showGame();

      const realBtn = $('#gjmStartBtn');
      if (realBtn){
        try{ realBtn.click(); }catch(e){}
      }

      try{
        window.dispatchEvent(new Event('gj:start'));
        window.dispatchEvent(new Event('goodjunk:start'));
        window.dispatchEvent(new Event('gjm:start'));
      }catch(e){}

      kill(btn);
    });

    try{ document.body.appendChild(btn); }catch(e){}
  }

  function unlock(){
    removeLoading();
    showGame();
    showStartOverlay();

    const overlay = $('#gjmStartOverlay');
    const startBtn = $('#gjmStartBtn');

    if (!overlay || !startBtn){
      makeEmergencyStartButton();
    }
  }

  function boot(){
    unlock();

    [
      100,250,500,800,1200,1600,2200,3000,4000,5500,7000,9000
    ].forEach(function(ms){
      setTimeout(unlock, ms);
    });

    let count = 0;
    const timer = setInterval(function(){
      count++;
      unlock();
      if (count >= 60) clearInterval(timer);
    }, 300);

    console.info('[GoodJunk Mobile Start Unblock]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
