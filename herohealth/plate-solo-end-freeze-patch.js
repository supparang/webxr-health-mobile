/* =========================================================
   HeroHealth • Plate Solo End Freeze Patch
   File: /herohealth/plate-solo-end-freeze-patch.js
   PATCH v20260512-PLATE-SOLO-END-FREEZE-RC1

   ใช้เป็น script ตัวสุดท้ายของ Plate Solo

   แก้อาการ:
   ✅ หลังขึ้น Summary แล้วยังมีเป้า/อาหารแว็บ
   ✅ spawn loop ยังยิงต่อ 1-2 tick หลังจบ
   ✅ floating score / particle / target เกิดหลัง summary
   ✅ timeout / interval / RAF ที่ถูกสร้างก่อนจบยังทำงานต่อ
   ✅ DOM ใหม่ที่ถูก append หลังจบจะถูกลบทันที
   ========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260512-PLATE-SOLO-END-FREEZE-RC1';
  const WIN = window;
  const DOC = document;

  let hardEnded = false;
  let booted = false;

  const FOOD_SELECTORS = [
    '.food',
    '.food-item',
    '.falling-food',
    '.target',
    '.food-target',
    '.spawn-item',
    '.draggable-food',
    '.plate-food',
    '.plate-target',
    '.catch-item',
    '.falling-item',
    '[data-food]',
    '[data-target]',
    '[data-spawn]',
    '[data-plate-food]'
  ].join(',');

  const FX_SELECTORS = [
    '.float-score',
    '.score-pop',
    '.combo-pop',
    '.particle',
    '.spark',
    '.burst',
    '.fx',
    '.hit-fx',
    '.miss-fx',
    '.plate-fx',
    '.confetti-piece',
    '[data-fx]'
  ].join(',');

  const SUMMARY_SELECTORS = [
    '#summaryModal',
    '#resultModal',
    '.summary-modal',
    '.result-modal',
    '.modal.show',
    '.summary.show',
    '.result.show',
    '[data-summary="1"]'
  ].join(',');

  const STAGE_SELECTORS = [
    '#gameStage',
    '#stage',
    '#playStage',
    '.game-stage',
    '.plate-stage',
    '.stage',
    '.play-field',
    '.plate-field',
    '.food-field'
  ].join(',');

  const qs = (s, root = DOC) => root.querySelector(s);
  const qsa = (s, root = DOC) => Array.from(root.querySelectorAll(s));

  const native = {
    setTimeout: WIN.setTimeout.bind(WIN),
    clearTimeout: WIN.clearTimeout.bind(WIN),
    setInterval: WIN.setInterval.bind(WIN),
    clearInterval: WIN.clearInterval.bind(WIN),
    requestAnimationFrame: WIN.requestAnimationFrame
      ? WIN.requestAnimationFrame.bind(WIN)
      : null,
    cancelAnimationFrame: WIN.cancelAnimationFrame
      ? WIN.cancelAnimationFrame.bind(WIN)
      : null
  };

  const trackedTimeouts = new Set();
  const trackedIntervals = new Set();
  const trackedRafs = new Set();

  function debug(){
    const p = new URLSearchParams(location.search);
    return p.get('debug') === '1' || p.get('plateDebug') === '1';
  }

  function log(){
    if (!debug()) return;
    console.log.apply(console, ['[PlateSoloEndFreezePatch]'].concat(Array.from(arguments)));
  }

  function isVisible(el){
    if (!el) return false;

    const st = WIN.getComputedStyle(el);

    return (
      el.classList.contains('show') ||
      el.classList.contains('open') ||
      el.getAttribute('aria-hidden') === 'false' ||
      st.display === 'flex' ||
      st.display === 'grid' ||
      (st.visibility === 'visible' && st.opacity !== '0' && st.display !== 'none')
    );
  }

  function summaryIsVisible(){
    return qsa(SUMMARY_SELECTORS).some(isVisible);
  }

  function isGameNode(node){
    if (!node || node.nodeType !== 1) return false;

    try {
      if (node.matches && (node.matches(FOOD_SELECTORS) || node.matches(FX_SELECTORS))) {
        return true;
      }

      if (node.querySelector && (
        node.querySelector(FOOD_SELECTORS) ||
        node.querySelector(FX_SELECTORS)
      )) {
        return true;
      }
    } catch (_) {}

    return false;
  }

  function removeNodeSafe(node){
    if (!node || node.nodeType !== 1) return;

    try {
      if (node.matches && (node.matches(FOOD_SELECTORS) || node.matches(FX_SELECTORS))) {
        node.style.animation = 'none';
        node.style.transition = 'none';
        node.style.opacity = '0';
        node.style.visibility = 'hidden';
        node.style.display = 'none';
        node.style.pointerEvents = 'none';
        node.setAttribute('aria-hidden', 'true');

        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }

        return;
      }

      if (node.querySelectorAll) {
        qsa(FOOD_SELECTORS + ',' + FX_SELECTORS, node).forEach(child => {
          try {
            child.style.animation = 'none';
            child.style.transition = 'none';
            child.style.opacity = '0';
            child.style.visibility = 'hidden';
            child.style.display = 'none';
            child.style.pointerEvents = 'none';
            child.setAttribute('aria-hidden', 'true');

            if (child.parentNode) {
              child.parentNode.removeChild(child);
            }
          } catch (_) {}
        });
      }
    } catch (_) {}
  }

  function cleanupStageNow(){
    qsa(FOOD_SELECTORS + ',' + FX_SELECTORS).forEach(removeNodeSafe);
  }

  function stopTrackedLoops(){
    trackedTimeouts.forEach(id => {
      try { native.clearTimeout(id); } catch (_) {}
    });

    trackedIntervals.forEach(id => {
      try { native.clearInterval(id); } catch (_) {}
    });

    trackedRafs.forEach(id => {
      try {
        if (native.cancelAnimationFrame) native.cancelAnimationFrame(id);
      } catch (_) {}
    });

    trackedTimeouts.clear();
    trackedIntervals.clear();
    trackedRafs.clear();
  }

  function clearKnownGameTimers(){
    const possibleTimerNames = [
      'spawnTimer',
      'spawnInterval',
      'foodTimer',
      'foodInterval',
      'targetTimer',
      'targetInterval',
      'gameTimer',
      'gameInterval',
      'loopTimer',
      'loopInterval',
      'plateTimer',
      'plateInterval',
      'fallTimer',
      'fallInterval',
      'rushTimer',
      'rushInterval',
      'feverTimer',
      'feverInterval',
      'animationTimer',
      'animationInterval',
      'rafId',
      'loopRaf',
      'gameRaf',
      'plateRaf'
    ];

    possibleTimerNames.forEach(name => {
      const value = WIN[name];

      if (typeof value === 'number') {
        try { native.clearTimeout(value); } catch (_) {}
        try { native.clearInterval(value); } catch (_) {}
        try {
          if (native.cancelAnimationFrame) native.cancelAnimationFrame(value);
        } catch (_) {}
      }
    });
  }

  function patchTimers(){
    if (WIN.__PLATE_SOLO_END_FREEZE_TIMER_PATCHED__) return;
    WIN.__PLATE_SOLO_END_FREEZE_TIMER_PATCHED__ = true;

    WIN.setTimeout = function(fn, delay){
      const args = Array.prototype.slice.call(arguments, 2);

      const id = native.setTimeout(function(){
        trackedTimeouts.delete(id);
        return fn && fn.apply(this, args);
      }, delay);

      /*
        เก็บเฉพาะ timeout ที่ถูกสร้าง "ก่อน hard end"
        หลังจบแล้ว ปุ่ม navigation ยังต้องใช้ setTimeout ได้ตามปกติ
      */
      if (!hardEnded) {
        trackedTimeouts.add(id);
      }

      return id;
    };

    WIN.setInterval = function(fn, delay){
      const args = Array.prototype.slice.call(arguments, 2);

      const id = native.setInterval(function(){
        if (hardEnded) {
          try { native.clearInterval(id); } catch (_) {}
          trackedIntervals.delete(id);
          return;
        }

        return fn && fn.apply(this, args);
      }, delay);

      if (!hardEnded) {
        trackedIntervals.add(id);
      }

      return id;
    };

    if (native.requestAnimationFrame && native.cancelAnimationFrame) {
      WIN.requestAnimationFrame = function(cb){
        const id = native.requestAnimationFrame(function(ts){
          trackedRafs.delete(id);

          if (hardEnded) {
            return;
          }

          return cb && cb(ts);
        });

        if (!hardEnded) {
          trackedRafs.add(id);
        }

        return id;
      };
    }
  }

  function patchSpawnFunctions(){
    if (WIN.__PLATE_SOLO_END_FREEZE_SPAWN_PATCHED__) return;
    WIN.__PLATE_SOLO_END_FREEZE_SPAWN_PATCHED__ = true;

    const names = [
      'spawnFood',
      'spawnTarget',
      'spawnItem',
      'createFood',
      'createTarget',
      'createItem',
      'addFood',
      'addTarget',
      'dropFood',
      'launchFood',
      'makeFood',
      'makeTarget',
      'renderFood',
      'renderTarget',
      'nextFood',
      'nextTarget'
    ];

    names.forEach(name => {
      const fn = WIN[name];

      if (typeof fn !== 'function') return;
      if (fn.__plateEndFreezePatched) return;

      const patched = function(){
        if (hardEnded || WIN.__PLATE_SOLO_HARD_ENDED__) {
          return null;
        }

        return fn.apply(this, arguments);
      };

      patched.__plateEndFreezePatched = true;
      WIN[name] = patched;
    });
  }

  function patchEndFunctions(){
    if (WIN.__PLATE_SOLO_END_FREEZE_END_PATCHED__) return;
    WIN.__PLATE_SOLO_END_FREEZE_END_PATCHED__ = true;

    const names = [
      'endGame',
      'finishGame',
      'showSummary',
      'openSummary',
      'renderSummary',
      'gameOver',
      'completeGame',
      'finishSession'
    ];

    names.forEach(name => {
      const fn = WIN[name];

      if (typeof fn !== 'function') return;
      if (fn.__plateHardEndPatched) return;

      const patched = function(){
        const result = fn.apply(this, arguments);

        native.setTimeout(function(){
          hardFreeze('hook:' + name);
        }, 0);

        native.setTimeout(function(){
          hardFreeze('hook-late:' + name);
        }, 120);

        return result;
      };

      patched.__plateHardEndPatched = true;
      WIN[name] = patched;
    });
  }

  function addStyle(){
    if (qs('#plateSoloEndFreezePatchStyle')) return;

    const style = DOC.createElement('style');
    style.id = 'plateSoloEndFreezePatchStyle';

    style.textContent = `
      body.plate-hard-ended .food,
      body.plate-hard-ended .food-item,
      body.plate-hard-ended .falling-food,
      body.plate-hard-ended .target,
      body.plate-hard-ended .food-target,
      body.plate-hard-ended .spawn-item,
      body.plate-hard-ended .draggable-food,
      body.plate-hard-ended .plate-food,
      body.plate-hard-ended .plate-target,
      body.plate-hard-ended .catch-item,
      body.plate-hard-ended .falling-item,
      body.plate-hard-ended [data-food],
      body.plate-hard-ended [data-target],
      body.plate-hard-ended [data-spawn],
      body.plate-hard-ended [data-plate-food],
      body.plate-hard-ended .float-score,
      body.plate-hard-ended .score-pop,
      body.plate-hard-ended .combo-pop,
      body.plate-hard-ended .particle,
      body.plate-hard-ended .spark,
      body.plate-hard-ended .burst,
      body.plate-hard-ended .fx,
      body.plate-hard-ended .hit-fx,
      body.plate-hard-ended .miss-fx,
      body.plate-hard-ended .plate-fx,
      body.plate-hard-ended .confetti-piece,
      body.plate-hard-ended [data-fx]{
        display:none !important;
        visibility:hidden !important;
        opacity:0 !important;
        pointer-events:none !important;
        animation:none !important;
        transition:none !important;
        transform:none !important;
      }

      body.plate-hard-ended .stage *,
      body.plate-hard-ended .plate-stage *,
      body.plate-hard-ended .game-stage *,
      body.plate-hard-ended #stage *,
      body.plate-hard-ended #gameStage *{
        animation-play-state:paused;
      }

      body.plate-hard-ended .summary-modal,
      body.plate-hard-ended .result-modal,
      body.plate-hard-ended #summaryModal,
      body.plate-hard-ended #resultModal,
      body.plate-hard-ended .modal.show{
        z-index:9999 !important;
      }
    `;

    DOC.head.appendChild(style);
  }

  function hardFreeze(reason){
    if (hardEnded) {
      cleanupStageNow();
      return;
    }

    hardEnded = true;
    WIN.__PLATE_SOLO_HARD_ENDED__ = true;

    DOC.body.classList.add(
      'plate-hard-ended',
      'plate-ended',
      'is-ended'
    );

    const app =
      qs('.plate-app') ||
      qs('#plateApp') ||
      qs('#app') ||
      qs('.game-app') ||
      qs('.hh-game');

    if (app) {
      app.classList.add(
        'plate-hard-ended',
        'plate-ended',
        'is-ended'
      );
    }

    stopTrackedLoops();
    clearKnownGameTimers();
    cleanupStageNow();

    /*
      เก็บกวาดซ้ำหลายจังหวะ เพราะบาง browser/render loop
      อาจ append node หลัง Summary ขึ้นมาอีก 1-2 frame
    */
    [0, 16, 32, 80, 160, 320, 640, 1200, 2200].forEach(ms => {
      native.setTimeout(cleanupStageNow, ms);
    });

    log('hard freeze', reason || 'unknown', VERSION);
  }

  function observeDom(){
    if (WIN.__PLATE_SOLO_END_FREEZE_OBSERVER__) return;

    const mo = new MutationObserver(mutations => {
      if (!hardEnded && summaryIsVisible()) {
        hardFreeze('summary-visible');
      }

      if (!hardEnded) return;

      mutations.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(node => {
          if (!node || node.nodeType !== 1) return;

          if (isGameNode(node)) {
            removeNodeSafe(node);
          }
        });
      });
    });

    mo.observe(DOC.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class', 'style', 'aria-hidden']
    });

    WIN.__PLATE_SOLO_END_FREEZE_OBSERVER__ = mo;
  }

  function patchAppendMethods(){
    if (WIN.__PLATE_SOLO_END_FREEZE_APPEND_PATCHED__) return;
    WIN.__PLATE_SOLO_END_FREEZE_APPEND_PATCHED__ = true;

    const nativeAppendChild = Element.prototype.appendChild;
    const nativeInsertBefore = Element.prototype.insertBefore;
    const nativeAppend = Element.prototype.append;

    Element.prototype.appendChild = function(node){
      const result = nativeAppendChild.call(this, node);

      if (hardEnded || WIN.__PLATE_SOLO_HARD_ENDED__) {
        if (isGameNode(node)) {
          removeNodeSafe(node);
        }
      }

      return result;
    };

    Element.prototype.insertBefore = function(node, ref){
      const result = nativeInsertBefore.call(this, node, ref);

      if (hardEnded || WIN.__PLATE_SOLO_HARD_ENDED__) {
        if (isGameNode(node)) {
          removeNodeSafe(node);
        }
      }

      return result;
    };

    if (nativeAppend) {
      Element.prototype.append = function(){
        const result = nativeAppend.apply(this, arguments);

        if (hardEnded || WIN.__PLATE_SOLO_HARD_ENDED__) {
          Array.from(arguments).forEach(node => {
            if (node && node.nodeType === 1 && isGameNode(node)) {
              removeNodeSafe(node);
            }
          });
        }

        return result;
      };
    }
  }

  function listenEvents(){
    [
      'hha:game-end',
      'hha:summary',
      'hha:plate:end',
      'plate:end',
      'game:end',
      'game:summary'
    ].forEach(eventName => {
      WIN.addEventListener(eventName, () => {
        hardFreeze('event:' + eventName);
      }, true);
    });
  }

  function exposeApi(){
    WIN.PlateSoloEndFreezePatch = {
      version: VERSION,
      freeze: hardFreeze,
      cleanup: cleanupStageNow,
      isHardEnded(){
        return hardEnded;
      }
    };
  }

  function boot(){
    if (booted) return;
    booted = true;

    addStyle();
    patchTimers();
    patchSpawnFunctions();
    patchEndFunctions();
    patchAppendMethods();
    observeDom();
    listenEvents();
    exposeApi();

    native.setTimeout(() => {
      patchSpawnFunctions();
      patchEndFunctions();

      if (summaryIsVisible()) {
        hardFreeze('boot-summary-visible');
      }
    }, 120);

    native.setTimeout(() => {
      patchSpawnFunctions();
      patchEndFunctions();

      if (summaryIsVisible()) {
        hardFreeze('boot-late-summary-visible');
      }
    }, 600);

    log('ready', VERSION);
  }

  WIN.addEventListener('DOMContentLoaded', boot);

  if (DOC.readyState === 'interactive' || DOC.readyState === 'complete') {
    boot();
  }

})();
