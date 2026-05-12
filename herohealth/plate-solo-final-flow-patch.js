/* =========================================================
   HeroHealth • Plate Solo Final Flow Patch
   File: /herohealth/plate-solo-final-flow-patch.js
   PATCH v20260512-PLATE-SOLO-FINAL-FLOW-RC1

   ใช้ต่อท้าย plate-solo.js

   ✅ แก้ mobile viewport สูงจริง
   ✅ บังคับ stage เห็นครบ
   ✅ กันอาหาร/เป้าเกิดทับ HUD และหลังจบเกมยังลอย
   ✅ ปิด target หลัง summary
   ✅ ปุ่มกลับ Nutrition Zone ถูกหน้า
   ✅ ปุ่ม cooldown ไป warmup-gate phase=cooldown ถูก
   ✅ preserve params: pid/name/diff/time/view/hub/log/api/studyId
   ========================================================= */

(function(){
  'use strict';

  const VERSION = 'v20260512-PLATE-SOLO-FINAL-FLOW-RC1';
  const WIN = window;
  const DOC = document;

  const FOOD_SELECTORS = [
    '.food',
    '.food-item',
    '.falling-food',
    '.target',
    '.food-target',
    '.spawn-item',
    '.draggable-food',
    '[data-food]',
    '[data-target]'
  ].join(',');

  const STAGE_SELECTORS = [
    '#gameStage',
    '#stage',
    '#playStage',
    '.game-stage',
    '.plate-stage',
    '.stage'
  ].join(',');

  const SUMMARY_SELECTORS = [
    '#summaryModal',
    '#resultModal',
    '.summary-modal',
    '.result-modal',
    '.modal'
  ].join(',');

  const ZONE_BUTTON_SELECTORS = [
    '#backZoneBtn',
    '#backToZone',
    '#zoneBtn',
    '#nutritionZoneBtn',
    '[data-action="zone"]',
    '[data-action="back-zone"]',
    '[data-go="zone"]',
    '.back-zone',
    '.zone-btn'
  ].join(',');

  const COOLDOWN_BUTTON_SELECTORS = [
    '#cooldownBtn',
    '#goCooldownBtn',
    '[data-action="cooldown"]',
    '[data-go="cooldown"]',
    '.cooldown-btn'
  ].join(',');

  const qs = (s, root = DOC) => root.querySelector(s);
  const qsa = (s, root = DOC) => Array.from(root.querySelectorAll(s));

  const log = (...args) => {
    if (new URLSearchParams(location.search).get('debug') === '1') {
      console.log('[PlateSoloFinalFlowPatch]', ...args);
    }
  };

  function params(){
    return new URLSearchParams(WIN.location.search || '');
  }

  function heroHealthBaseUrl(){
    const path = WIN.location.pathname;
    const marker = '/herohealth/';
    const i = path.indexOf(marker);

    if (i >= 0) {
      return WIN.location.origin + path.slice(0, i + marker.length);
    }

    return new URL('./', WIN.location.href).href;
  }

  function buildNutritionZoneUrl(){
    const p = params();
    const url = new URL('nutrition-zone.html', heroHealthBaseUrl());

    const keep = [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'run',
      'log',
      'api',
      'studyId',
      'seed',
      'conditionGroup'
    ];

    keep.forEach(k => {
      const v = p.get(k);
      if (v !== null && v !== '') url.searchParams.set(k, v);
    });

    url.searchParams.set('zone', 'nutrition');
    url.searchParams.set('from', 'plate-solo');

    const hub = p.get('hub');
    if (hub) {
      url.searchParams.set('hub', hub);
    } else {
      url.searchParams.set('hub', new URL('hub.html', heroHealthBaseUrl()).href);
    }

    return url.href;
  }

  function buildCooldownUrl(){
    const p = params();
    const url = new URL('warmup-gate.html', heroHealthBaseUrl());
    const next = buildNutritionZoneUrl();

    const keep = [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'log',
      'api',
      'studyId',
      'seed',
      'conditionGroup'
    ];

    keep.forEach(k => {
      const v = p.get(k);
      if (v !== null && v !== '') url.searchParams.set(k, v);
    });

    url.searchParams.set('phase', 'cooldown');
    url.searchParams.set('zone', 'nutrition');
    url.searchParams.set('game', 'plate');
    url.searchParams.set('mode', 'solo');
    url.searchParams.set('from', 'plate-solo');
    url.searchParams.set('next', next);

    const hub = p.get('hub');
    if (hub) {
      url.searchParams.set('hub', hub);
    } else {
      url.searchParams.set('hub', new URL('hub.html', heroHealthBaseUrl()).href);
    }

    return url.href;
  }

  function setRealViewportHeight(){
    const h = Math.max(420, WIN.innerHeight || DOC.documentElement.clientHeight || 720);
    DOC.documentElement.style.setProperty('--real-vh', `${h}px`);
    DOC.documentElement.style.setProperty('--app-height', `${h}px`);
    DOC.body.style.minHeight = `${h}px`;
  }

  function ensureAppClasses(){
    DOC.body.classList.add('plate-solo-page');

    const app =
      qs('.plate-app') ||
      qs('#plateApp') ||
      qs('#app') ||
      qs('.game-app') ||
      qs('.hh-game');

    if (app) {
      app.classList.add('plate-app');
    }
  }

  function forceStageFullView(){
    const stage = qs(STAGE_SELECTORS);
    if (!stage) return;

    const topbar =
      qs('.topbar') ||
      qs('.plate-topbar') ||
      qs('.game-topbar') ||
      qs('.header');

    const hud =
      qs('.hud') ||
      qs('.plate-hud') ||
      qs('.game-hud') ||
      qs('.scorebar');

    const controls =
      qs('.controls') ||
      qs('.plate-controls') ||
      qs('.bottom-bar') ||
      qs('.game-controls');

    const topH = topbar ? topbar.getBoundingClientRect().height : 64;
    const hudH = hud ? hud.getBoundingClientRect().height : 74;
    const ctrlH = controls ? controls.getBoundingClientRect().height : 68;

    const isMobile = WIN.matchMedia('(max-width: 860px)').matches;
    const gap = isMobile ? 44 : 74;

    const targetH = Math.max(
      isMobile ? 330 : 460,
      (WIN.innerHeight || 720) - topH - hudH - ctrlH - gap
    );

    stage.style.minHeight = `${targetH}px`;
    stage.style.height = `${targetH}px`;
    stage.style.maxHeight = 'none';
  }

  function clampFoodIntoStage(el){
    const stage = qs(STAGE_SELECTORS);
    if (!stage || !el || !el.getBoundingClientRect) return;

    const st = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();

    if (!st.width || !st.height || !r.width || !r.height) return;

    const safeTop = 58;
    const safeBottom = Math.min(150, Math.max(92, st.height * 0.25));
    const safeLeft = 8;
    const safeRight = 8;

    let left = r.left - st.left;
    let top = r.top - st.top;

    const maxLeft = st.width - r.width - safeRight;
    const maxTop = st.height - r.height - safeBottom;

    left = Math.max(safeLeft, Math.min(left, maxLeft));
    top = Math.max(safeTop, Math.min(top, Math.max(safeTop, maxTop)));

    if (Number.isFinite(left) && Number.isFinite(top)) {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    }
  }

  function clampAllFoods(){
    if (DOC.body.classList.contains('is-ended')) return;
    qsa(FOOD_SELECTORS).forEach(clampFoodIntoStage);
  }

  function cleanupFloatingFoods(){
    qsa(FOOD_SELECTORS).forEach(el => {
      if (!el || !el.parentNode) return;

      el.style.pointerEvents = 'none';
      el.classList.add('collected');
      el.setAttribute('aria-hidden', 'true');

      setTimeout(() => {
        try {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        } catch (_) {}
      }, 420);
    });
  }

  function markGameEnded(){
    DOC.body.classList.add('is-ended', 'plate-ended');

    const app =
      qs('.plate-app') ||
      qs('#plateApp') ||
      qs('#app') ||
      qs('.game-app');

    if (app) app.classList.add('is-ended', 'plate-ended');

    cleanupFloatingFoods();
  }

  function isSummaryVisible(){
    return qsa(SUMMARY_SELECTORS).some(el => {
      const style = WIN.getComputedStyle(el);
      return (
        el.classList.contains('show') ||
        el.classList.contains('open') ||
        el.getAttribute('aria-hidden') === 'false' ||
        style.display === 'flex' ||
        style.display === 'grid' ||
        style.visibility === 'visible' && style.opacity !== '0'
      );
    });
  }

  function bindReturnButtons(){
    const zoneUrl = buildNutritionZoneUrl();
    const cooldownUrl = buildCooldownUrl();

    qsa(ZONE_BUTTON_SELECTORS).forEach(btn => {
      if (!btn) return;

      if (btn.tagName === 'A') {
        btn.href = zoneUrl;
      }

      btn.dataset.href = zoneUrl;
      btn.dataset.zoneUrl = zoneUrl;

      if (btn.__plateZoneBound) return;
      btn.__plateZoneBound = true;

      btn.addEventListener('click', ev => {
        ev.preventDefault();
        safeLeave(zoneUrl);
      }, true);
    });

    qsa(COOLDOWN_BUTTON_SELECTORS).forEach(btn => {
      if (!btn) return;

      if (btn.tagName === 'A') {
        btn.href = cooldownUrl;
      }

      btn.dataset.href = cooldownUrl;
      btn.dataset.cooldownUrl = cooldownUrl;

      if (btn.__plateCooldownBound) return;
      btn.__plateCooldownBound = true;

      btn.addEventListener('click', ev => {
        ev.preventDefault();
        safeLeave(cooldownUrl);
      }, true);
    });
  }

  function safeLeave(url){
    try {
      WIN.dispatchEvent(new CustomEvent('hha:before-leave', {
        detail:{
          game:'plate',
          mode:'solo',
          reason:'navigation',
          to:url,
          version:VERSION
        }
      }));
    } catch (_) {}

    try {
      if (typeof WIN.HHA_FLUSH === 'function') {
        WIN.HHA_FLUSH('before-leave');
      }
    } catch (_) {}

    setTimeout(() => {
      WIN.location.assign(url);
    }, 60);
  }

  function installSummaryWatcher(){
    const mo = new MutationObserver(() => {
      bindReturnButtons();

      if (isSummaryVisible()) {
        markGameEnded();
      }
    });

    mo.observe(DOC.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class', 'style', 'aria-hidden']
    });

    WIN.__PLATE_SOLO_SUMMARY_WATCHER__ = mo;
  }

  function installFoodWatcher(){
    const mo = new MutationObserver(list => {
      if (DOC.body.classList.contains('is-ended')) {
        cleanupFloatingFoods();
        return;
      }

      for (const item of list) {
        item.addedNodes && item.addedNodes.forEach(node => {
          if (!node || node.nodeType !== 1) return;

          if (node.matches && node.matches(FOOD_SELECTORS)) {
            setTimeout(() => clampFoodIntoStage(node), 16);
          }

          if (node.querySelectorAll) {
            qsa(FOOD_SELECTORS, node).forEach(el => {
              setTimeout(() => clampFoodIntoStage(el), 16);
            });
          }
        });
      }
    });

    mo.observe(DOC.body, {
      childList:true,
      subtree:true
    });

    WIN.__PLATE_SOLO_FOOD_WATCHER__ = mo;
  }

  function patchGlobalEndHooks(){
    const oldEndGame = WIN.endGame;
    if (typeof oldEndGame === 'function' && !oldEndGame.__platePatched) {
      const patched = function(){
        const result = oldEndGame.apply(this, arguments);
        setTimeout(markGameEnded, 60);
        setTimeout(bindReturnButtons, 80);
        return result;
      };
      patched.__platePatched = true;
      WIN.endGame = patched;
    }

    const oldShowSummary = WIN.showSummary;
    if (typeof oldShowSummary === 'function' && !oldShowSummary.__platePatched) {
      const patched = function(){
        const result = oldShowSummary.apply(this, arguments);
        setTimeout(markGameEnded, 60);
        setTimeout(bindReturnButtons, 80);
        return result;
      };
      patched.__platePatched = true;
      WIN.showSummary = patched;
    }

    const oldFinishGame = WIN.finishGame;
    if (typeof oldFinishGame === 'function' && !oldFinishGame.__platePatched) {
      const patched = function(){
        const result = oldFinishGame.apply(this, arguments);
        setTimeout(markGameEnded, 60);
        setTimeout(bindReturnButtons, 80);
        return result;
      };
      patched.__platePatched = true;
      WIN.finishGame = patched;
    }
  }

  function addEmergencyStyles(){
    if (qs('#plateSoloFinalFlowPatchStyle')) return;

    const style = DOC.createElement('style');
    style.id = 'plateSoloFinalFlowPatchStyle';
    style.textContent = `
      html,
      body{
        min-height:var(--app-height, 100dvh);
      }

      body.plate-solo-page{
        overscroll-behavior:none;
      }

      body.plate-ended .food,
      body.plate-ended .food-item,
      body.plate-ended .falling-food,
      body.plate-ended .target,
      body.plate-ended .food-target,
      body.plate-ended .spawn-item,
      body.plate-ended .draggable-food,
      .plate-app.plate-ended .food,
      .plate-app.plate-ended .food-item,
      .plate-app.plate-ended .falling-food,
      .plate-app.plate-ended .target,
      .plate-app.plate-ended .food-target,
      .plate-app.plate-ended .spawn-item,
      .plate-app.plate-ended .draggable-food{
        pointer-events:none !important;
      }

      .plate-flow-safe-zone-btn{
        position:relative;
      }

      @media (max-width: 860px){
        .plate-solo-page .stage,
        .plate-solo-page .plate-stage,
        .plate-solo-page .game-stage,
        .plate-solo-page #stage,
        .plate-solo-page #gameStage{
          overflow:hidden !important;
        }

        .plate-solo-page .summary-modal,
        .plate-solo-page .result-modal,
        .plate-solo-page #summaryModal,
        .plate-solo-page #resultModal{
          padding:12px !important;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function exposeDebugApi(){
    WIN.PlateSoloFinalFlowPatch = {
      version: VERSION,
      nutritionZoneUrl: buildNutritionZoneUrl,
      cooldownUrl: buildCooldownUrl,
      refresh(){
        setRealViewportHeight();
        ensureAppClasses();
        forceStageFullView();
        bindReturnButtons();
        clampAllFoods();
      },
      end: markGameEnded,
      cleanupFoods: cleanupFloatingFoods
    };
  }

  function boot(){
    addEmergencyStyles();
    setRealViewportHeight();
    ensureAppClasses();
    forceStageFullView();
    bindReturnButtons();
    installSummaryWatcher();
    installFoodWatcher();
    patchGlobalEndHooks();
    exposeDebugApi();

    setTimeout(() => {
      forceStageFullView();
      bindReturnButtons();
      clampAllFoods();
    }, 120);

    setTimeout(() => {
      forceStageFullView();
      bindReturnButtons();
      clampAllFoods();
    }, 520);

    log('ready', VERSION, {
      zone: buildNutritionZoneUrl(),
      cooldown: buildCooldownUrl()
    });
  }

  WIN.addEventListener('resize', () => {
    setRealViewportHeight();
    forceStageFullView();
    setTimeout(clampAllFoods, 80);
  }, { passive:true });

  WIN.addEventListener('orientationchange', () => {
    setTimeout(() => {
      setRealViewportHeight();
      forceStageFullView();
      clampAllFoods();
    }, 240);
  }, { passive:true });

  WIN.addEventListener('hha:game-end', () => {
    markGameEnded();
    bindReturnButtons();
  });

  WIN.addEventListener('hha:summary', () => {
    markGameEnded();
    bindReturnButtons();
  });

  WIN.addEventListener('hha:plate:end', () => {
    markGameEnded();
    bindReturnButtons();
  });

  WIN.addEventListener('DOMContentLoaded', boot);

  if (DOC.readyState === 'interactive' || DOC.readyState === 'complete') {
    boot();
  }

})();
