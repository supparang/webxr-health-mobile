/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-start-button-bridge-final.js
   PATCH v20260527a-GOODJUNK-MOBILE-START-BUTTON-BRIDGE-FINAL

   PURPOSE:
   - ใช้เฉพาะ goodjunk-solo-boss-mobile.html
   - แก้ปุ่ม "เริ่มสู้บอส" กดแล้วไม่เข้าเกม
   - ไม่แตะ target / score / cooldown / powerups
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527a-GOODJUNK-MOBILE-START-BUTTON-BRIDGE-FINAL';
  window.__GJ_MOBILE_START_BUTTON_BRIDGE_FINAL__ = VERSION;

  function $(sel){
    try{ return document.querySelector(sel); }catch(e){ return null; }
  }

  function $all(sel){
    try{ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function show(el, display){
    if (!el) return;
    try{
      el.style.setProperty('display', display || 'block', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('transform', 'none', 'important');
    }catch(e){}
  }

  function hide(el){
    if (!el) return;
    try{
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    }catch(e){}
  }

  function unlockBase(){
    [
      '#shellLoading',
      '.shell-loading',
      '.shell-loading-card',
      '.loading-screen',
      '[data-loading]',
      '[data-gj-loading]'
    ].forEach(function(sel){
      $all(sel).forEach(hide);
    });

    show($('#gjSoloBossMain'), 'block');
    show($('#gjSoloBossArea'), 'block');
    $all('.gjm-root').forEach(function(el){ show(el, 'block'); });
    $all('.gjm-area').forEach(function(el){ show(el, 'block'); });

    const overlay = $('#gjmStartOverlay');
    const btn = $('#gjmStartBtn');

    if (overlay){
      show(overlay, 'grid');
      try{ overlay.style.setProperty('z-index','1000','important'); }catch(e){}
    }

    if (btn){
      show(btn, 'inline-block');
      try{ btn.disabled = false; }catch(e){}
    }
  }

  function hideStartOverlay(){
    hide($('#gjmStartOverlay'));
  }

  function getApi(){
    return window.GoodJunkSoloBossMain ||
           window.GJSBM ||
           window.GJ_SOLO_BOSS_MAIN ||
           window.GoodJunkSoloBoss ||
           null;
  }

  function callPossibleStartFunctions(){
    const candidates = [
      ['GoodJunkSoloBossMain.startGame', function(){
        return window.GoodJunkSoloBossMain &&
               typeof window.GoodJunkSoloBossMain.startGame === 'function' &&
               window.GoodJunkSoloBossMain.startGame({
                 manual:true,
                 source:'mobile-start-button-bridge',
                 patch:VERSION
               });
      }],
      ['GJSBM.startGame', function(){
        return window.GJSBM &&
               typeof window.GJSBM.startGame === 'function' &&
               window.GJSBM.startGame({
                 manual:true,
                 source:'mobile-start-button-bridge',
                 patch:VERSION
               });
      }],
      ['GJ_SOLO_BOSS_MAIN.startGame', function(){
        return window.GJ_SOLO_BOSS_MAIN &&
               typeof window.GJ_SOLO_BOSS_MAIN.startGame === 'function' &&
               window.GJ_SOLO_BOSS_MAIN.startGame({
                 manual:true,
                 source:'mobile-start-button-bridge',
                 patch:VERSION
               });
      }],
      ['startGoodJunkSoloBoss', function(){
        return typeof window.startGoodJunkSoloBoss === 'function' &&
               window.startGoodJunkSoloBoss();
      }],
      ['startGame', function(){
        return typeof window.startGame === 'function' &&
               window.startGame();
      }]
    ];

    for (const item of candidates){
      try{
        const ok = item[1]();
        console.info('[GoodJunk Mobile Start Bridge] tried', item[0], ok);
        if (ok !== false) return true;
      }catch(e){
        console.warn('[GoodJunk Mobile Start Bridge] failed', item[0], e);
      }
    }

    return false;
  }

  function dispatchStartEvents(){
    const detail = {
      manual:true,
      source:'mobile-start-button-bridge',
      patch:VERSION
    };

    [
      'gj:start',
      'goodjunk:start',
      'gjm:start',
      'gj:game:start',
      'goodjunk:game:start'
    ].forEach(function(name){
      try{
        window.dispatchEvent(new CustomEvent(name, { detail }));
        document.dispatchEvent(new CustomEvent(name, { detail }));
      }catch(e){}
    });
  }

  function forceStart(){
    unlockBase();

    const started = callPossibleStartFunctions();
    dispatchStartEvents();

    hideStartOverlay();

    setTimeout(function(){
      hideStartOverlay();
      show($('#gjSoloBossMain'), 'block');
      show($('#gjSoloBossArea'), 'block');
    }, 120);

    setTimeout(function(){
      hideStartOverlay();
      show($('#gjSoloBossMain'), 'block');
      show($('#gjSoloBossArea'), 'block');
    }, 450);

    console.info('[GoodJunk Mobile Start Bridge]', VERSION, 'forceStart started=', started);
  }

  function bindStart(){
    const btn = $('#gjmStartBtn');
    if (!btn) return;

    if (btn.dataset.gjMobileStartButtonBridge === VERSION) return;
    btn.dataset.gjMobileStartButtonBridge = VERSION;

    function onStart(ev){
      try{
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}

      forceStart();
    }

    btn.addEventListener('click', onStart, true);
    btn.addEventListener('pointerup', onStart, true);
    btn.addEventListener('touchend', onStart, true);
  }

  function boot(){
    unlockBase();
    bindStart();

    [200,500,900,1500,2500,4000].forEach(function(ms){
      setTimeout(function(){
        unlockBase();
        bindStart();
      }, ms);
    });

    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest('#gjmStartBtn,.gjm-start-btn')
        : null;

      if (!target) return;

      try{
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}

      forceStart();
    }, true);

    console.info('[GoodJunk Mobile Start Button Bridge]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
