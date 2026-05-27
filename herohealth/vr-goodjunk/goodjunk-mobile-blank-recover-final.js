/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-blank-recover-final.js
   PATCH v20260527b-GOODJUNK-MOBILE-START-BRIDGE-FINAL

   FIX:
   - หน้า mobile เข้า start overlay ได้แล้ว แต่กด "เริ่มสู้บอส" แล้วไม่เริ่ม
   - ไม่บังคับโชว์ overlay ซ้ำถ้าเกม started แล้ว
   - เรียก GoodJunkSoloBossMain.startGame() โดยตรง
   - ไม่แตะ score / target / powerups / cooldown
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260527b-GOODJUNK-MOBILE-START-BRIDGE-FINAL';
  window.__GJ_MOBILE_START_BRIDGE_FINAL__ = VERSION;

  function $(sel){
    try{ return document.querySelector(sel); }catch(e){ return null; }
  }

  function $all(sel){
    try{ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    catch(e){ return []; }
  }

  function getApi(){
    return window.GoodJunkSoloBossMain || window.GJSBM || null;
  }

  function getState(){
    const api = getApi();
    try{
      if (api && typeof api.getState === 'function') return api.getState();
    }catch(e){}
    return null;
  }

  function hideOnlyLoading(){
    [
      '#shellLoading',
      '.shell-loading',
      '.shell-loading-card',
      '#goodjunkMobileLoading',
      '.gj-mobile-loading',
      '.gj-mobile-loading-card',
      '.loading-screen',
      '[data-loading]',
      '[data-gj-loading]'
    ].forEach(function(sel){
      $all(sel).forEach(function(el){
        try{
          el.style.setProperty('display','none','important');
          el.style.setProperty('visibility','hidden','important');
          el.style.setProperty('opacity','0','important');
          el.style.setProperty('pointer-events','none','important');
          el.style.setProperty('z-index','-999999','important');
        }catch(e){}
      });
    });
  }

  function showMainLayers(){
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
          el.style.setProperty('transform','none','important');
        }catch(e){}
      });
    });
  }

  function hideStartOverlay(){
    const overlay = $('#gjmStartOverlay');
    if (overlay){
      try{
        overlay.style.setProperty('display','none','important');
        overlay.style.setProperty('visibility','hidden','important');
        overlay.style.setProperty('opacity','0','important');
        overlay.style.setProperty('pointer-events','none','important');
        overlay.style.setProperty('z-index','-1','important');
      }catch(e){}
    }

    const recover = $('#gjRecoverStartBtn');
    if (recover){
      try{ recover.style.display = 'none'; }catch(e){}
    }
  }

  function showStartOverlayOnlyIfNotStarted(){
    const st = getState();

    if (st && st.started && !st.ended){
      hideStartOverlay();
      return;
    }

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

  function forceStartGame(source){
    hideOnlyLoading();
    showMainLayers();

    const api = getApi();

    if (!api || typeof api.startGame !== 'function'){
      console.warn('[GoodJunk Mobile Start Bridge] startGame API not ready yet', VERSION);
      return false;
    }

    const before = getState();

    if (before && before.started && !before.ended){
      hideStartOverlay();
      return true;
    }

    try{
      api.startGame({
        manual:true,
        source:source || 'mobile-start-bridge',
        patch:VERSION
      });

      setTimeout(function(){
        const after = getState();
        if (after && after.started && !after.ended){
          hideStartOverlay();
        }
      }, 40);

      setTimeout(function(){
        const after = getState();
        if (after && after.started && !after.ended){
          hideStartOverlay();
        }
      }, 250);

      console.info('[GoodJunk Mobile Start Bridge] startGame called', VERSION);
      return true;
    }catch(e){
      console.error('[GoodJunk Mobile Start Bridge] startGame failed', e);
      return false;
    }
  }

  function bindStartButton(){
    const btn = $('#gjmStartBtn');
    if (!btn) return;

    if (btn.dataset.gjMobileStartBridge === VERSION) return;
    btn.dataset.gjMobileStartBridge = VERSION;

    function handler(ev){
      try{
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}

      forceStartGame('real-start-button');
    }

    btn.addEventListener('click', handler, true);
    btn.addEventListener('pointerup', handler, true);
    btn.addEventListener('touchend', handler, true);
  }

  function makeRecoverButton(){
    if ($('#gjRecoverStartBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'gjRecoverStartBtn';
    btn.type = 'button';
    btn.textContent = '▶ เริ่มเล่น GoodJunk';
    btn.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:calc(88px + env(safe-area-inset-bottom,0px))',
      'transform:translateX(-50%)',
      'z-index:999999',
      'border:0',
      'border-radius:999px',
      'padding:14px 22px',
      'background:linear-gradient(135deg,#22c55e,#2563eb)',
      'color:#fff',
      'font-weight:1000',
      'font-size:17px',
      'box-shadow:0 18px 42px rgba(15,23,42,.28)'
    ].join(';');

    btn.addEventListener('click', function(ev){
      try{
        ev.preventDefault();
        ev.stopPropagation();
      }catch(e){}

      forceStartGame('recover-button');
    }, true);

    try{ document.body.appendChild(btn); }catch(e){}
  }

  function recover(){
    hideOnlyLoading();
    showMainLayers();

    const st = getState();

    if (st && st.started && !st.ended){
      hideStartOverlay();
      return;
    }

    showStartOverlayOnlyIfNotStarted();
    bindStartButton();

    if (!$('#gjmStartBtn')){
      makeRecoverButton();
    }
  }

  function boot(){
    recover();

    [150,350,700,1000,1500,2200,3000,4500,6500].forEach(function(ms){
      setTimeout(recover, ms);
    });

    document.addEventListener('click', function(ev){
      const target = ev.target && ev.target.closest
        ? ev.target.closest('#gjmStartBtn,.gjm-start-btn,#gjRecoverStartBtn')
        : null;

      if (!target) return;

      try{
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}

      forceStartGame('document-click-capture');
    }, true);

    console.info('[GoodJunk Mobile Start Bridge]', VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
