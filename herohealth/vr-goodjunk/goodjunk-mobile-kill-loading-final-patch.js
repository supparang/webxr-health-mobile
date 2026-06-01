/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-kill-loading-final-patch.js
   PATCH v20260528a-GOODJUNK-MOBILE-KILL-LOADING-FINAL

   PURPOSE:
   - ใช้เฉพาะ goodjunk-solo-boss-mobile.html
   - แก้ค้างหน้า "GoodJunk Solo Boss กำลังเตรียมบอส..."
   - ฆ่า shellLoading ให้หมด
   - เปิด start overlay / ปุ่มเริ่มสู้บอส ให้กดได้
   - ไม่แตะ gameplay / score / target / cooldown / powerups
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260528a-GOODJUNK-MOBILE-KILL-LOADING-FINAL';

  window.__GJ_MOBILE_KILL_LOADING_FINAL__ = VERSION;

  function $(sel){
    try{
      return document.querySelector(sel);
    }catch(e){
      return null;
    }
  }

  function $all(sel){
    try{
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function setImportant(el, prop, value){
    if(!el) return;
    try{
      el.style.setProperty(prop, value, 'important');
    }catch(e){}
  }

  function showBlock(el){
    if(!el) return;

    setImportant(el, 'display', 'block');
    setImportant(el, 'visibility', 'visible');
    setImportant(el, 'opacity', '1');
    setImportant(el, 'pointer-events', 'auto');
  }

  function showGrid(el){
    if(!el) return;

    setImportant(el, 'display', 'grid');
    setImportant(el, 'visibility', 'visible');
    setImportant(el, 'opacity', '1');
    setImportant(el, 'pointer-events', 'auto');
  }

  function hideAndRemove(el){
    if(!el) return;

    try{
      setImportant(el, 'display', 'none');
      setImportant(el, 'visibility', 'hidden');
      setImportant(el, 'opacity', '0');
      setImportant(el, 'pointer-events', 'none');
      setImportant(el, 'z-index', '-1');
      el.remove();
    }catch(e){}
  }

  function killLoading(){
    [
      '#shellLoading',
      '.shell-loading',
      '.shell-loading-card',
      '.loading',
      '.loading-screen',
      '[data-loading]',
      '[data-gj-loading]'
    ].forEach(function(sel){
      $all(sel).forEach(hideAndRemove);
    });
  }

  function unlockMobileStartScreen(){
    const main = $('#gjSoloBossMain');
    const area = $('#gjSoloBossArea');
    const hud = $('#gjmHud');
    const message = $('#gjmMessage');
    const start = $('#gjmStartOverlay');
    const card = $('.gjm-start-card');
    const btn = $('#gjmStartBtn');
    const backBtn = $('#shellBackBtn');

    showBlock(main);
    showBlock(area);
    showBlock(hud);

    if(message){
      setImportant(message, 'pointer-events', 'none');
    }

    showGrid(start);
    showBlock(card);

    if(btn){
      try{ btn.disabled = false; }catch(e){}
      showBlock(btn);
      setImportant(btn, 'cursor', 'pointer');
      setImportant(btn, 'touch-action', 'manipulation');
    }

    if(backBtn){
      showBlock(backBtn);
      setImportant(backBtn, 'z-index', '100030');
    }
  }

  function repairStartButtonIfNeeded(){
    const btn = $('#gjmStartBtn');
    if(!btn) return;

    if(btn.dataset.gjMobileKillLoadingBound === VERSION) return;
    btn.dataset.gjMobileKillLoadingBound = VERSION;

    btn.addEventListener('pointerdown', function(){
      killLoading();
      unlockMobileStartScreen();
    }, true);

    btn.addEventListener('touchstart', function(){
      killLoading();
      unlockMobileStartScreen();
    }, true);

    btn.addEventListener('click', function(){
      killLoading();
      unlockMobileStartScreen();
    }, true);
  }

  function run(){
    killLoading();
    unlockMobileStartScreen();
    repairStartButtonIfNeeded();
  }

  function boot(){
    run();

    [
      80,
      150,
      300,
      600,
      1000,
      1500,
      2200,
      3000,
      4500
    ].forEach(function(ms){
      setTimeout(run, ms);
    });

    try{
      const observer = new MutationObserver(function(){
        run();
      });

      observer.observe(document.documentElement, {
        childList:true,
        subtree:true
      });

      setTimeout(function(){
        try{ observer.disconnect(); }catch(e){}
      }, 8000);
    }catch(e){}

    window.addEventListener('load', run, { once:true });
    window.addEventListener('pageshow', run);

    console.info('[GoodJunk Mobile Kill Loading Final]', VERSION, 'loaded');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();