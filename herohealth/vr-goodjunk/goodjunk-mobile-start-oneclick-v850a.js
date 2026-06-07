/* === /herohealth/vr-goodjunk/goodjunk-mobile-start-oneclick-v850a.js === */
/* PATCH v20260607-GOODJUNK-MOBILE-START-ONECLICK-V850A
   Purpose:
   - เริ่มเกมด้วยการกดครั้งเดียว
   - ไม่เรียก click ซ้ำแบบ bridge เก่า
   - ไม่เปิด summary เอง
*/

(function(){
  'use strict';

  if (window.GJ_MOBILE_START_ONECLICK_V850A_LOADED) return;
  window.GJ_MOBILE_START_ONECLICK_V850A_LOADED = true;

  var PATCH = 'v20260607-GOODJUNK-MOBILE-START-ONECLICK-V850A';
  var started = false;
  var startAttemptedAt = 0;

  function $(id){
    return document.getElementById(id);
  }

  function safeCall(fn, label){
    try{
      if (typeof fn === 'function'){
        fn();
        console.log('[GoodJunk start oneclick v850a] called:', label);
        return true;
      }
    }catch(e){
      console.warn('[GoodJunk start oneclick v850a] call failed:', label, e);
    }

    return false;
  }

  function hideStartOverlay(){
    var overlay = $('gjmStartOverlay');
    if (!overlay) return;

    overlay.style.setProperty('display', 'none', 'important');
    overlay.style.setProperty('visibility', 'hidden', 'important');
    overlay.style.setProperty('opacity', '0', 'important');
    overlay.style.setProperty('pointer-events', 'none', 'important');
  }

  function unlockSafeAudio(){
    try{
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      if (!window.__GJ_V850A_AUDIO_CTX){
        window.__GJ_V850A_AUDIO_CTX = new AC();
      }

      var ctx = window.__GJ_V850A_AUDIO_CTX;
      if (ctx && ctx.state === 'suspended'){
        ctx.resume().catch(function(){});
      }
    }catch(_){}
  }

  function dispatchStartEvents(){
    try{
      window.dispatchEvent(new CustomEvent('gj:start', {
        detail:{
          patch: PATCH,
          source: 'oneclick-v850a',
          startedAt: Date.now()
        }
      }));
    }catch(_){}

    try{
      window.dispatchEvent(new CustomEvent('gj:real-play-start', {
        detail:{
          patch: PATCH,
          source: 'oneclick-v850a',
          startedAt: Date.now()
        }
      }));
    }catch(_){}
  }

  function callKnownStartFunctions(){
    var called = false;

    called = safeCall(window.GJ_START_GAME, 'window.GJ_START_GAME') || called;
    called = safeCall(window.startGame, 'window.startGame') || called;
    called = safeCall(window.startGoodJunk, 'window.startGoodJunk') || called;

    try{
      if (
        window.GoodJunkSoloBossMain &&
        typeof window.GoodJunkSoloBossMain.startGame === 'function'
      ){
        window.GoodJunkSoloBossMain.startGame();
        called = true;
        console.log('[GoodJunk start oneclick v850a] called: GoodJunkSoloBossMain.startGame');
      }
    }catch(e){
      console.warn('[GoodJunk start oneclick v850a] GoodJunkSoloBossMain failed', e);
    }

    try{
      if (
        window.GJ_SOLO_BOSS &&
        typeof window.GJ_SOLO_BOSS.start === 'function'
      ){
        window.GJ_SOLO_BOSS.start();
        called = true;
        console.log('[GoodJunk start oneclick v850a] called: GJ_SOLO_BOSS.start');
      }
    }catch(e){}

    return called;
  }

  function markStarted(reason){
    if (started) return;
    started = true;
    startAttemptedAt = Date.now();

    try{
      if (
        window.GJ_BOSS_BALANCE_V850A &&
        typeof window.GJ_BOSS_BALANCE_V850A.markStart === 'function'
      ){
        window.GJ_BOSS_BALANCE_V850A.markStart(reason || 'oneclick');
      }
    }catch(_){}

    unlockSafeAudio();
    dispatchStartEvents();

    /*
      ไม่ stop native click เดิม:
      ให้ core เดิมทำงานตามปกติ
      ตัวนี้แค่กันต้องกด 2 ครั้ง และ fallback ซ่อน overlay ให้
    */
    setTimeout(function(){
      hideStartOverlay();
      callKnownStartFunctions();
    }, 80);

    setTimeout(function(){
      hideStartOverlay();
    }, 350);

    setTimeout(function(){
      hideStartOverlay();
    }, 900);

    console.log('[GoodJunk start oneclick v850a] started:', reason);
  }

  function bindStartButton(){
    var btn = $('gjmStartBtn');
    if (!btn || btn.dataset.gjOneClickV850A === '1') return;

    btn.dataset.gjOneClickV850A = '1';
    btn.disabled = false;
    btn.style.setProperty('pointer-events', 'auto', 'important');

    btn.addEventListener('pointerdown', function(){
      markStarted('pointerdown');
    }, true);

    btn.addEventListener('touchstart', function(){
      markStarted('touchstart');
    }, { capture:true, passive:true });

    btn.addEventListener('click', function(){
      markStarted('click');
    }, true);

    console.log('[GoodJunk start oneclick v850a] bound start button');
  }

  function boot(){
    bindStartButton();

    var overlay = $('gjmStartOverlay');
    if (overlay){
      overlay.style.setProperty('pointer-events', 'auto', 'important');
    }
  }

  var mo = new MutationObserver(bindStartButton);

  try{
    mo.observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['style','class','disabled']
    });
  }catch(_){}

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

  setTimeout(boot, 300);
  setTimeout(boot, 900);
  setTimeout(boot, 1600);

  window.GJ_MOBILE_START_ONECLICK_V850A = {
    patch: PATCH,
    markStarted: markStarted,
    bindStartButton: bindStartButton,
    state: function(){
      return {
        patch: PATCH,
        started: started,
        startAttemptedAt: startAttemptedAt
      };
    }
  };

  console.log('[GoodJunk start oneclick v850a] installed');
})();