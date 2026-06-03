/* =========================================================
   /herohealth/vr-goodjunk/goodjunk-mobile-clean-start-final-patch.js
   PATCH v20260528b-GOODJUNK-MOBILE-CLEAN-START-FINAL

   PURPOSE:
   - ใช้เฉพาะ goodjunk-solo-boss-mobile.html
   - แก้ Mobile หน้าเริ่มขึ้นแล้วกด "เริ่มสู้บอส" ไม่เข้าเกม
   - ไม่ใช้ stopPropagation / stopImmediatePropagation กับปุ่มเริ่ม
   - ไม่บล็อก click handler เดิมของเกม
   - ฆ่า shellLoading ถ้ายังหลงเหลืออยู่
   - เปิด main / area / start overlay ให้พร้อม
   - เสริม fallback start เฉพาะกรณี handler เดิมไม่เริ่มเกม
   - ไม่แตะ scoring / target / summary / cooldown / powerups โดยตรง
========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260528b-GOODJUNK-MOBILE-CLEAN-START-FINAL';
  const LAUNCHER_URL = 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

  window.__GJ_MOBILE_CLEAN_START_FINAL__ = VERSION;

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function q(name, fallback){
    const v = qs().get(name);
    return v === null || v === '' ? fallback : v;
  }

  function playerName(){
    return q('name', q('nick', 'Hero'));
  }

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
  }

  function showGrid(el){
    if(!el) return;
    setImportant(el, 'display', 'grid');
    setImportant(el, 'visibility', 'visible');
    setImportant(el, 'opacity', '1');
  }

  function enablePointer(el){
    if(!el) return;
    setImportant(el, 'pointer-events', 'auto');
    setImportant(el, 'touch-action', 'manipulation');
    try{
      el.disabled = false;
    }catch(e){}
  }

  function hideRemove(el){
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

  function buildLauncherUrl(){
    const u = new URL(LAUNCHER_URL);

    u.searchParams.set('pid', q('pid', 'anon'));
    u.searchParams.set('name', playerName());
    u.searchParams.set('diff', q('diff', 'normal'));
    u.searchParams.set('time', q('time', '90'));
    u.searchParams.set('view', 'mobile');

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'mobile-solo-boss');
    u.searchParams.set('theme', 'goodjunk');

    return u.href;
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
      $all(sel).forEach(hideRemove);
    });
  }

  function unlockScreen(){
    const main = $('#gjSoloBossMain');
    const area = $('#gjSoloBossArea');
    const hud = $('#gjmHud');
    const start = $('#gjmStartOverlay');
    const card = $('.gjm-start-card');
    const btn = $('#gjmStartBtn');
    const back = $('#shellBackBtn');

    showBlock(main);
    showBlock(area);
    showBlock(hud);

    showGrid(start);
    enablePointer(start);

    showBlock(card);
    enablePointer(card);

    showBlock(btn);
    enablePointer(btn);

    if(back){
      showBlock(back);
      enablePointer(back);
      setImportant(back, 'z-index', '100030');

      if(!back.dataset.gjMobileCleanBackBound){
        back.dataset.gjMobileCleanBackBound = VERSION;
        back.addEventListener('click', function(){
          location.href = buildLauncherUrl();
        }, false);
      }
    }
  }

  function isStartOverlayVisible(){
    const start = $('#gjmStartOverlay');
    if(!start) return false;

    try{
      const cs = getComputedStyle(start);
      return cs.display !== 'none' &&
             cs.visibility !== 'hidden' &&
             Number(cs.opacity || '1') > 0.01;
    }catch(e){
      return true;
    }
  }

  function isGameplayLikelyStarted(){
    const start = $('#gjmStartOverlay');
    if(!start) return true;

    try{
      const cs = getComputedStyle(start);
      if(cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity || '1') < 0.05){
        return true;
      }
    }catch(e){}

    const stageText = (
      ($('#gjmStage') && $('#gjmStage').textContent) ||
      document.body.textContent ||
      ''
    );

    return /boss|warmup|ready|เล่น|ภารกิจ/i.test(stageText) && !/เริ่มสู้บอส/.test(stageText);
  }

  function getPath(root, path){
    try{
      return path.split('.').reduce(function(obj, key){
        return obj && obj[key];
      }, root);
    }catch(e){
      return null;
    }
  }

  function tryCallStartApis(){
    const detail = {
      manual:true,
      source:'goodjunk-mobile-clean-start-final',
      patch:VERSION
    };

    const methodPaths = [
      'GoodJunkSoloBossMain.startGame',
      'GoodJunkSoloBossMain.start',
      'GJ_SOLO_BOSS_MAIN.startGame',
      'GJ_SOLO_BOSS_MAIN.start',
      'GJSBM.startGame',
      'GJSBM.start',
      'GoodJunkSoloBoss.startGame',
      'GoodJunkSoloBoss.start',
      'GJ.startGame',
      'GJ.start'
    ];

    let called = false;

    methodPaths.forEach(function(path){
      const fn = getPath(window, path);
      if(typeof fn !== 'function') return;

      try{
        fn(detail);
        called = true;
        console.info('[GoodJunk Mobile Clean Start] called', path);
      }catch(e){
        console.warn('[GoodJunk Mobile Clean Start] failed', path, e);
      }
    });

    const directFns = [
      'startGoodJunkSoloBoss',
      'startGoodJunkSoloBossGame',
      'startGoodJunkGame',
      'startGame',
      'gjStart',
      'start'
    ];

    directFns.forEach(function(name){
      const fn = window[name];
      if(typeof fn !== 'function') return;

      try{
        fn(detail);
        called = true;
        console.info('[GoodJunk Mobile Clean Start] called window.' + name);
      }catch(e){
        console.warn('[GoodJunk Mobile Clean Start] failed window.' + name, e);
      }
    });

    return called;
  }

  function dispatchStartEvents(){
    const detail = {
      manual:true,
      source:'goodjunk-mobile-clean-start-final',
      patch:VERSION
    };

    [
      'gj:start',
      'goodjunk:start',
      'gjm:start',
      'gj:game:start',
      'goodjunk:game:start',
      'goodjunk:solo:start',
      'goodjunk:solo-boss:start'
    ].forEach(function(name){
      try{
        window.dispatchEvent(new CustomEvent(name, { detail:detail }));
      }catch(e){}

      try{
        document.dispatchEvent(new CustomEvent(name, { detail:detail }));
      }catch(e){}
    });
  }

  function fallbackStartAfterNativeClick(){
    /*
      สำคัญ:
      ไม่ preventDefault / ไม่ stopPropagation
      ให้ handler เดิมของ goodjunk-solo-boss-main.js ทำงานก่อน
      แล้วค่อย fallback ถ้ายังไม่เริ่ม
    */

    killLoading();
    unlockScreen();

    setTimeout(function(){
      if(!isStartOverlayVisible() || isGameplayLikelyStarted()){
        return;
      }

      dispatchStartEvents();
      const called = tryCallStartApis();

      console.info('[GoodJunk Mobile Clean Start]', VERSION, 'fallback called=', called);

      /*
        ถ้ามี API ถูกเรียกแล้ว ให้ซ่อน overlay ทีหลังเล็กน้อย
        เพื่อไม่บัง gameplay
      */
      if(called){
        setTimeout(function(){
          const start = $('#gjmStartOverlay');
          if(start){
            setImportant(start, 'display', 'none');
            setImportant(start, 'visibility', 'hidden');
            setImportant(start, 'opacity', '0');
            setImportant(start, 'pointer-events', 'none');
          }
        }, 180);
      }
    }, 180);
  }

  function bindStartButton(){
    const btn = $('#gjmStartBtn');
    if(!btn) return;

    showBlock(btn);
    enablePointer(btn);

    if(btn.dataset.gjMobileCleanStartBound === VERSION) return;
    btn.dataset.gjMobileCleanStartBound = VERSION;

    /*
      ใช้ bubble phase เท่านั้น และไม่ block event เดิม
    */
    btn.addEventListener('click', function(){
      fallbackStartAfterNativeClick();
    }, false);

    btn.addEventListener('pointerup', function(){
      fallbackStartAfterNativeClick();
    }, false);

    btn.addEventListener('touchend', function(){
      fallbackStartAfterNativeClick();
    }, false);
  }

  function bindSafeExtraStartButtonWhenOldBridgeExists(){
    /*
      กรณียังเผลอโหลด goodjunk-mobile-start-button-bridge-final.js ตัวเก่า
      ตัวเก่าอาจดัก #gjmStartBtn / .gjm-start-btn ด้วย stopImmediatePropagation
      จึงสร้างปุ่มสำรองคนละ class/id ไม่ให้ตัวเก่าดัก
    */
    if(!window.__GJ_MOBILE_START_BUTTON_BRIDGE_FINAL__) return;

    const card = $('.gjm-start-card');
    const oldBtn = $('#gjmStartBtn');
    if(!card || !oldBtn) return;

    if($('#gjmSafeStartBtn')) return;

    const safeBtn = document.createElement('button');
    safeBtn.id = 'gjmSafeStartBtn';
    safeBtn.type = 'button';
    safeBtn.textContent = 'เริ่มสู้บอส';
    safeBtn.setAttribute('aria-label', 'เริ่มสู้บอส');

    safeBtn.style.cssText = [
      'margin-top:14px',
      'border:0',
      'border-radius:22px',
      'padding:14px 22px',
      'background:linear-gradient(135deg,#22c55e,#2563eb)',
      'color:#fff',
      'font-size:18px',
      'font-weight:1000',
      'box-shadow:0 14px 28px rgba(37,99,235,.24)',
      'cursor:pointer',
      'touch-action:manipulation',
      'pointer-events:auto'
    ].join(';');

    oldBtn.style.display = 'none';
    oldBtn.style.pointerEvents = 'none';

    card.appendChild(safeBtn);

    safeBtn.addEventListener('click', function(){
      killLoading();
      unlockScreen();
      dispatchStartEvents();
      const called = tryCallStartApis();

      console.info('[GoodJunk Mobile Clean Start] safe extra button start called=', called);

      if(called){
        setTimeout(function(){
          const start = $('#gjmStartOverlay');
          if(start){
            setImportant(start, 'display', 'none');
            setImportant(start, 'visibility', 'hidden');
            setImportant(start, 'opacity', '0');
            setImportant(start, 'pointer-events', 'none');
          }
        }, 150);
      }
    }, false);

    console.warn('[GoodJunk Mobile Clean Start] old start bridge detected; safe button created.');
  }

  function bootOnce(){
    killLoading();
    unlockScreen();
    bindStartButton();
    bindSafeExtraStartButtonWhenOldBridgeExists();
  }

  function boot(){
    bootOnce();

    [
      80,
      160,
      320,
      600,
      1000,
      1600,
      2400,
      3600
    ].forEach(function(ms){
      setTimeout(bootOnce, ms);
    });

    try{
      const mo = new MutationObserver(function(){
        bootOnce();
      });

      mo.observe(document.documentElement, {
        childList:true,
        subtree:true
      });

      setTimeout(function(){
        try{ mo.disconnect(); }catch(e){}
      }, 7000);
    }catch(e){}

    window.addEventListener('load', bootOnce, { once:true });
    window.addEventListener('pageshow', bootOnce);

    console.info('[GoodJunk Mobile Clean Start Final]', VERSION, 'loaded');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();