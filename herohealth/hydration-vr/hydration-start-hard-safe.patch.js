/* =========================================================
   HeroHealth Hydration Start Hard-Safe Patch
   File: /herohealth/hydration-vr/hydration-start-hard-safe.patch.js
   Version: v20260518-pack28-start-hard-safe-no-block-fallback

   Purpose:
   - แก้หน้า Start Overlay ค้าง
   - บังคับให้ปุ่ม "เริ่มภารกิจ 💧" รับ click / pointer / touch
   - กัน layer / summary-open / pointer-events ไปบังปุ่ม
   - ถ้า window.beginHydrationFromOverlay พร้อม จะเรียกผ่าน global function
   - ถ้า window.beginHydrationFromOverlay ยังไม่พร้อม จะไม่ stop event
     เพื่อปล่อยให้ listener เดิมใน hydration-vr.js ทำงานต่อ
   - ไม่ยุ่งกับ gameplay ถ้าเกมเริ่มแล้ว

   PACK28 FIX:
   - แก้ปัญหา Pack24 ดักปุ่มแล้ว safeStop ก่อน
     ทำให้ปุ่มเดิมของ hydration-vr.js ไม่มีโอกาสเริ่มเกม
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260518-pack28-start-hard-safe-no-block-fallback';

  if(window.HHA_HYDRATION_START_HARD_SAFE_PACK28_LOADED){
    return;
  }

  window.HHA_HYDRATION_START_HARD_SAFE_PACK28_LOADED = true;

  var lastStartAt = 0;
  var observer = null;

  function q(sel, root){
    try{
      return (root || document).querySelector(sel);
    }catch(e){
      return null;
    }
  }

  function qa(sel, root){
    try{
      return Array.from((root || document).querySelectorAll(sel));
    }catch(e){
      return [];
    }
  }

  function now(){
    return Date.now ? Date.now() : new Date().getTime();
  }

  function isHydrationRunPage(){
    return !!(
      q('#hha-hydration-app') ||
      q('#hha-hydration-stage') ||
      q('#hha-hydration-playfield') ||
      document.body.classList.contains('hha-hydration-page')
    );
  }

  function isStartOpen(){
    var overlay = q('.hha-hydration-start');
    var startBtn = q('[data-hha-hydration-start-btn], .hha-start-btn');

    if(!overlay && !startBtn){
      return false;
    }

    if(overlay){
      var r = overlay.getBoundingClientRect();
      var style = window.getComputedStyle(overlay);

      if(
        r.width <= 0 ||
        r.height <= 0 ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity || 1) === 0
      ){
        return false;
      }
    }

    return true;
  }

  function isGameReallyRunning(){
    try{
      return !!(
        window.HHA &&
        window.HHA.Hydration &&
        window.HHA.Hydration.started &&
        !window.HHA.Hydration.destroyed &&
        !isStartOpen()
      );
    }catch(e){
      return false;
    }
  }

  function safeStop(ev){
    if(!ev) return;

    try{ ev.preventDefault(); }catch(e){}
    try{ ev.stopPropagation(); }catch(e){}
    try{
      if(ev.stopImmediatePropagation){
        ev.stopImmediatePropagation();
      }
    }catch(e){}
  }

  function injectCssSafety(){
    if(document.getElementById('hha-hydration-start-hard-safe-css')){
      return;
    }

    var style = document.createElement('style');
    style.id = 'hha-hydration-start-hard-safe-css';
    style.textContent = `
      body .hha-hydration-start{
        pointer-events:auto !important;
        z-index:999980 !important;
      }

      body .hha-hydration-start .hha-start-card{
        pointer-events:auto !important;
        z-index:999981 !important;
      }

      body .hha-hydration-start .hha-start-btn,
      body .hha-hydration-start [data-hha-hydration-start-btn]{
        pointer-events:auto !important;
        position:relative !important;
        z-index:999982 !important;
        touch-action:manipulation !important;
        cursor:pointer !important;
      }

      body .hha-hydration-start .hha-start-back,
      body .hha-hydration-start [data-hha-hydration-back-btn]{
        pointer-events:auto !important;
        position:relative !important;
        z-index:999982 !important;
        touch-action:manipulation !important;
        cursor:pointer !important;
      }
    `;

    document.head.appendChild(style);
  }

  function clearSummaryMode(){
    try{
      document.body.classList.remove('hha-hydration-summary-open');
      document.documentElement.classList.remove('hha-hydration-summary-open-html');

      document.documentElement.style.overflowY = '';
      document.documentElement.style.overflowX = '';
      document.documentElement.style.height = '';
      document.documentElement.style.minHeight = '';

      document.body.style.overflowY = '';
      document.body.style.overflowX = '';
      document.body.style.height = '';
      document.body.style.minHeight = '';
      document.body.style.touchAction = '';

      [
        q('#hha-hydration-app'),
        q('#hha-hydration-stage'),
        q('#hha-hydration-playfield')
      ].forEach(function(el){
        if(!el) return;

        el.style.overflow = '';
        el.style.height = '';
        el.style.minHeight = '';
        el.style.maxHeight = '';
        el.style.position = '';
      });
    }catch(e){}
  }

  function unlockStartOverlay(){
    if(!isHydrationRunPage()) return;

    injectCssSafety();

    var overlay = q('.hha-hydration-start');
    if(overlay){
      overlay.style.pointerEvents = 'auto';
      overlay.style.zIndex = '999980';
    }

    var card = q('.hha-hydration-start .hha-start-card');
    if(card){
      card.style.pointerEvents = 'auto';
      card.style.zIndex = '999981';
      card.style.position = card.style.position || 'relative';
    }

    qa('[data-hha-hydration-start-btn], .hha-start-btn').forEach(function(btn){
      btn.style.pointerEvents = 'auto';
      btn.style.zIndex = '999982';
      btn.style.position = btn.style.position || 'relative';
      btn.style.touchAction = 'manipulation';
      btn.dataset.hhaStartHardSafe = PATCH;
    });

    qa('[data-hha-hydration-back-btn], .hha-start-back').forEach(function(btn){
      btn.style.pointerEvents = 'auto';
      btn.style.zIndex = '999982';
      btn.style.position = btn.style.position || 'relative';
      btn.style.touchAction = 'manipulation';
    });
  }

  function showStartPatchToast(text){
    var id = 'hha-hydration-start-hard-safe-toast';
    var old = document.getElementById(id);
    if(old){
      try{ old.remove(); }catch(e){}
    }

    var box = document.createElement('div');
    box.id = id;
    box.textContent = text || '';
    box.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'z-index:999999',
      'transform:translateX(-50%)',
      'max-width:90vw',
      'padding:10px 14px',
      'border-radius:999px',
      'background:rgba(255,255,255,.96)',
      'color:#24607f',
      'box-shadow:0 12px 30px rgba(30,75,115,.20)',
      'font:900 13px system-ui,-apple-system,Segoe UI,sans-serif',
      'pointer-events:none',
      'text-align:center'
    ].join(';');

    document.body.appendChild(box);

    setTimeout(function(){
      try{ box.remove(); }catch(e){}
    }, 1800);
  }

  function resetHydrationStartFlags(){
    try{
      window.HHA = window.HHA || {};
      window.HHA.Hydration = window.HHA.Hydration || {};

      /*
        สำคัญ:
        ถ้า state ค้างว่า started=true ทั้งที่ยังอยู่หน้า Start Overlay
        beginHydrationFromOverlay() จะ return ทันที
      */
      if(isStartOpen()){
        window.HHA.Hydration.started = false;
        window.HHA.Hydration.destroyed = false;
      }
    }catch(e){}
  }

  function callStartFunction(){
    if(typeof window.beginHydrationFromOverlay !== 'function'){
      /*
        PACK28:
        ไม่ throw / ไม่ block event ตรงนี้
        เพราะ hydration-vr.js มี listener เดิมแบบ closure-safe อยู่แล้ว
      */
      try{
        console.warn('[Hydration Pack28] window.beginHydrationFromOverlay is not available; allow original button listener to continue.');
      }catch(e){}
      return false;
    }

    clearSummaryMode();
    resetHydrationStartFlags();

    try{
      window.beginHydrationFromOverlay();
      return true;
    }catch(err){
      console.error('[Hydration Pack28] beginHydrationFromOverlay failed:', err);
      showStartPatchToast('เริ่มเกมไม่สำเร็จ ดู error ใน Console');
      return false;
    }
  }

  function hardStart(ev){
    if(!isHydrationRunPage()){
      return false;
    }

    if(isGameReallyRunning()){
      return false;
    }

    if(!isStartOpen()){
      return false;
    }

    /*
      PACK28 FIX:
      ถ้า hydration-vr.js ยังไม่ได้ export window.beginHydrationFromOverlay
      ห้าม stop event เพราะปุ่มเดิมใน hydration-vr.js มี listener แบบ closure อยู่แล้ว
      ต้องปล่อยให้ listener เดิมทำงานต่อ
    */
    if(typeof window.beginHydrationFromOverlay !== 'function'){
      clearSummaryMode();
      unlockStartOverlay();
      return false;
    }

    /*
      กัน event ซ้ำจาก touchend + click + pointerup
    */
    var t = now();
    if(t - lastStartAt < 450){
      safeStop(ev);
      return true;
    }

    lastStartAt = t;
    safeStop(ev);

    return callStartFunction();
  }

  function isStartTrigger(target){
    if(!target || !target.closest) return false;

    return !!target.closest(
      '[data-hha-hydration-start-btn], .hha-start-btn'
    );
  }

  function isBackTrigger(target){
    if(!target || !target.closest) return false;

    return !!target.closest(
      '[data-hha-hydration-back-btn], .hha-start-back'
    );
  }

  function hardBack(ev){
    if(!isHydrationRunPage()) return false;
    if(!isStartOpen()) return false;

    /*
      ถ้า goHydrationBackHub ยังไม่ถูก export
      ไม่ควร block listener เดิมของปุ่มกลับ
    */
    if(typeof window.goHydrationBackHub !== 'function'){
      clearSummaryMode();
      unlockStartOverlay();
      return false;
    }

    safeStop(ev);

    try{
      window.goHydrationBackHub();
      return true;
    }catch(err){
      console.error('[Hydration Pack28] goHydrationBackHub failed:', err);
    }

    try{
      var rawHub = new URL(location.href).searchParams.get('hub') || '';
      if(rawHub){
        location.href = decodeURIComponent(rawHub);
        return true;
      }
    }catch(e){}

    location.href = '../nutrition-zone.html';
    return true;
  }

  function bindStartButton(btn){
    if(!btn || btn.dataset.hhaStartHardSafeBound === PATCH){
      return;
    }

    btn.dataset.hhaStartHardSafeBound = PATCH;

    /*
      PACK28:
      ไม่ตั้ง btn.onclick ทับแบบบังคับ
      เพราะถ้า global function ยังไม่พร้อม จะทำให้ on-event เดิมเสียโอกาส
      ใช้ addEventListener แบบ fallback แทน
    */
    btn.addEventListener('click', hardStart, true);
    btn.addEventListener('pointerup', hardStart, true);
    btn.addEventListener('mouseup', hardStart, true);
    btn.addEventListener('touchend', hardStart, { passive:false, capture:true });

    btn.addEventListener('pointerdown', function(){
      clearSummaryMode();
      unlockStartOverlay();
    }, true);

    btn.addEventListener('touchstart', function(){
      clearSummaryMode();
      unlockStartOverlay();
    }, { passive:true, capture:true });
  }

  function bindBackButton(btn){
    if(!btn || btn.dataset.hhaBackHardSafeBound === PATCH){
      return;
    }

    btn.dataset.hhaBackHardSafeBound = PATCH;

    /*
      PACK28:
      ไม่ตั้ง btn.onclick ทับ เพื่อปล่อย listener เดิมทำงานได้ด้วย
    */
    btn.addEventListener('click', hardBack, true);
    btn.addEventListener('pointerup', hardBack, true);
    btn.addEventListener('mouseup', hardBack, true);
    btn.addEventListener('touchend', hardBack, { passive:false, capture:true });
  }

  function bindVisibleButtons(){
    if(!isHydrationRunPage()){
      return;
    }

    unlockStartOverlay();

    qa('[data-hha-hydration-start-btn], .hha-start-btn').forEach(bindStartButton);
    qa('[data-hha-hydration-back-btn], .hha-start-back').forEach(bindBackButton);
  }

  function bindGlobalCapture(){
    if(window.HHA_HYDRATION_START_HARD_SAFE_GLOBAL_BOUND_PACK28){
      return;
    }

    window.HHA_HYDRATION_START_HARD_SAFE_GLOBAL_BOUND_PACK28 = true;

    function onAnyStartEvent(ev){
      if(!isHydrationRunPage()) return;

      var target = ev.target;

      if(isStartTrigger(target)){
        hardStart(ev);
        return;
      }

      if(isBackTrigger(target)){
        hardBack(ev);
      }
    }

    /*
      ใช้ทั้ง window และ document แบบ capture
      แต่ Pack28 จะไม่ block event ถ้า global function ยังไม่พร้อม
    */
    window.addEventListener('click', onAnyStartEvent, true);
    window.addEventListener('pointerup', onAnyStartEvent, true);
    window.addEventListener('mouseup', onAnyStartEvent, true);
    window.addEventListener('touchend', onAnyStartEvent, { passive:false, capture:true });

    document.addEventListener('click', onAnyStartEvent, true);
    document.addEventListener('pointerup', onAnyStartEvent, true);
    document.addEventListener('mouseup', onAnyStartEvent, true);
    document.addEventListener('touchend', onAnyStartEvent, { passive:false, capture:true });
  }

  function boot(){
    if(!isHydrationRunPage()){
      return;
    }

    injectCssSafety();
    clearSummaryMode();
    bindGlobalCapture();
    bindVisibleButtons();

    if(observer){
      try{ observer.disconnect(); }catch(e){}
      observer = null;
    }

    observer = new MutationObserver(function(){
      if(!isHydrationRunPage()) return;

      bindVisibleButtons();

      if(isStartOpen()){
        clearSummaryMode();
        unlockStartOverlay();
      }
    });

    observer.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style']
    });

    setInterval(function(){
      if(!isHydrationRunPage()) return;

      bindVisibleButtons();

      if(isStartOpen()){
        unlockStartOverlay();
      }
    }, 600);

    window.HHA = window.HHA || {};
    window.HHA.HydrationStartHardSafe = {
      version: PATCH,
      start: function(){
        if(typeof window.beginHydrationFromOverlay === 'function'){
          return callStartFunction();
        }

        showStartPatchToast('ยังไม่มี global start แต่ปุ่มเดิมจะทำงานเมื่อกดจากหน้าเกม');
        return false;
      },
      back: function(){
        if(typeof window.goHydrationBackHub === 'function'){
          return hardBack();
        }

        location.href = '../nutrition-zone.html';
        return true;
      },
      unlock: unlockStartOverlay,
      clearSummaryMode: clearSummaryMode,
      isStartOpen: isStartOpen
    };

    console.info('[Hydration Pack28] Start hard-safe no-block fallback loaded');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
