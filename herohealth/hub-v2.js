/* =========================================================
 * HeroHealth Hub v2
 * ZONE-FIRST PATCH
 * append to bottom of /herohealth/hub-v2.js
 * ========================================================= */
(function () {
  'use strict';

  const W = window;
  const D = document;

  const PREVIEW_IDS = ['hygPreview', 'nutriPreview', 'fitPreview'];
  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
  const NEXT_ZONE_KEY = 'HHA_NEXT_ZONE';
  const RECOMMENDED_ZONE_KEY = 'HHA_RECOMMENDED_ZONE';

  W.HH_DISABLE_HUB_ZONE_PREVIEW = true;

  const ZONE_PATHS = {
    hygiene: './hygiene-zone.html',
    nutrition: './nutrition-zone.html',
    fitness: './fitness-zone.html'
  };

  const PASSTHROUGH_KEYS = [
    'pid', 'name', 'nickName', 'studyId', 'run', 'diff', 'view', 'time',
    'seed', 'debug', 'api', 'log', 'studentKey', 'schoolCode', 'classRoom',
    'studentNo', 'conditionGroup', 'phase', 'gameId', 'game', 'zone'
  ];

  function qsGet(key, fallback = '') {
    try {
      const v = new URL(W.location.href).searchParams.get(key);
      return v == null || v === '' ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function setStore(key, val) {
    try { localStorage.setItem(key, String(val || '')); } catch (_) {}
  }

  function getStore(key, fallback = '') {
    try {
      const v = localStorage.getItem(key);
      return v == null || v === '' ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function isZoneKey(v) {
    return v === 'hygiene' || v === 'nutrition' || v === 'fitness';
  }

  function setLastZone(zone) {
    if (isZoneKey(zone)) setStore(LAST_ZONE_KEY, zone);
  }

  function getLastZone() {
    const z = getStore(LAST_ZONE_KEY, '');
    return isZoneKey(z) ? z : '';
  }

  function getNextZone() {
    const z = getStore(NEXT_ZONE_KEY, '');
    return isZoneKey(z) ? z : '';
  }

  function getRecommendedZone() {
    const z = getStore(RECOMMENDED_ZONE_KEY, '');
    return isZoneKey(z) ? z : '';
  }

  function buildZoneUrl(zone) {
    const path = ZONE_PATHS[zone] || './hub-v2.html';
    const u = new URL(path, W.location.href);

    PASSTHROUGH_KEYS.forEach((k) => {
      const v = qsGet(k, '');
      if (v) u.searchParams.set(k, v);
    });

    const pid = qsGet('pid', 'anon');
    const name = qsGet('name', qsGet('nickName', 'Hero'));
    const run = qsGet('run', 'play');
    const diff = qsGet('diff', 'normal');
    const view = qsGet('view', 'mobile');
    const time = qsGet('time', '90');

    u.searchParams.set('pid', pid);
    u.searchParams.set('name', name);
    u.searchParams.set('run', run);
    u.searchParams.set('diff', diff);
    u.searchParams.set('view', view);
    u.searchParams.set('time', time);
    u.searchParams.set('zone', zone);
    u.searchParams.set('hub', W.location.href);

    return u.toString();
  }

  function goZone(zone) {
    if (!isZoneKey(zone)) zone = 'nutrition';
    setLastZone(zone);
    W.location.href = buildZoneUrl(zone);
  }

  function hidePreviewElement(el) {
    if (!el) return;
    el.innerHTML = '';
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.style.display = 'none';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    el.style.height = '0';
    el.style.minHeight = '0';
    el.style.margin = '0';
    el.style.padding = '0';
    el.style.overflow = 'hidden';
  }

  function stripZonePreview() {
    PREVIEW_IDS.forEach((id) => hidePreviewElement(D.getElementById(id)));
  }

  function installPreviewMutationGuards() {
    PREVIEW_IDS.forEach((id) => {
      const el = D.getElementById(id);
      if (!el || el.__hhPreviewGuardInstalled) return;
      el.__hhPreviewGuardInstalled = true;

      hidePreviewElement(el);

      const mo = new MutationObserver(() => {
        if (W.HH_DISABLE_HUB_ZONE_PREVIEW) hidePreviewElement(el);
      });

      try {
        mo.observe(el, { childList: true, subtree: true, attributes: true });
      } catch (_) {}
    });
  }

  function patchPreviewRenderFunctions() {
    const names = [
      'renderZonePreview',
      'renderZonePreviews',
      'renderHygienePreview',
      'renderNutritionPreview',
      'renderFitnessPreview',
      'mountZonePreview',
      'mountZonePreviews',
      'updateZonePreview'
    ];

    names.forEach((name) => {
      if (typeof W[name] === 'function' && !W[name].__hhNoopPreview) {
        const noop = function () {
          stripZonePreview();
          return null;
        };
        noop.__hhNoopPreview = true;
        W[name] = noop;
      }
    });
  }

  function bindLinkToZone(id, zone) {
    const el = D.getElementById(id);
    if (!el) return;

    const href = buildZoneUrl(zone);

    if (el.tagName === 'A') {
      el.href = href;
      if (!el.__hhAnchorBound) {
        el.__hhAnchorBound = true;
        el.addEventListener('click', function () {
          setLastZone(zone);
        });
      }
      return;
    }

    if (!el.__hhButtonBound) {
      el.__hhButtonBound = true;
      el.addEventListener('click', function () {
        goZone(zone);
      });
    }
  }

  function bindZoneButtons() {
    bindLinkToZone('btnPlayHygiene', 'hygiene');
    bindLinkToZone('btnPlayNutrition', 'nutrition');
    bindLinkToZone('btnPlayFitness', 'fitness');

    bindLinkToZone('btnZoneHygiene', 'hygiene');
    bindLinkToZone('btnZoneNutrition', 'nutrition');
    bindLinkToZone('btnZoneFitness', 'fitness');
  }

  function bindQuickButtons() {
    const btnResumeNow = D.getElementById('btnResumeNow');
    if (btnResumeNow && !btnResumeNow.__hhBound) {
      btnResumeNow.__hhBound = true;
      btnResumeNow.addEventListener('click', function () {
        goZone(getLastZone() || 'nutrition');
      });
    }

    const btnNextInZone = D.getElementById('btnNextInZone');
    if (btnNextInZone && !btnNextInZone.__hhBound) {
      btnNextInZone.__hhBound = true;
      btnNextInZone.addEventListener('click', function () {
        goZone(getNextZone() || getRecommendedZone() || 'nutrition');
      });
    }

    const btnQuickRecommended = D.getElementById('btnQuickRecommended');
    if (btnQuickRecommended && !btnQuickRecommended.__hhBound) {
      btnQuickRecommended.__hhBound = true;
      btnQuickRecommended.addEventListener('click', function () {
        goZone(getRecommendedZone() || 'nutrition');
      });
    }

    const btnQuickRecent = D.getElementById('btnQuickRecent');
    if (btnQuickRecent && !btnQuickRecent.__hhBound) {
      btnQuickRecent.__hhBound = true;
      btnQuickRecent.addEventListener('click', function () {
        goZone(getLastZone() || 'nutrition');
      });
    }

    const btnQuickAllGames = D.getElementById('btnQuickAllGames');
    if (btnQuickAllGames && !btnQuickAllGames.__hhBound) {
      btnQuickAllGames.__hhBound = true;
      btnQuickAllGames.addEventListener('click', function () {
        goZone(getRecommendedZone() || 'nutrition');
      });
    }
  }

  function patchGoodJunkHallCard() {
    const nutritionUrl = buildZoneUrl('nutrition');

    const a1 = D.getElementById('gjQuickRematchBtn');
    if (a1) {
      a1.href = nutritionUrl;
      if (!a1.__hhBound) {
        a1.__hhBound = true;
        a1.addEventListener('click', function () {
          setLastZone('nutrition');
        });
      }
    }

    const a2 = D.getElementById('gjOpenLauncherBtn');
    if (a2) {
      a2.href = nutritionUrl;
      if (!a2.__hhBound) {
        a2.__hhBound = true;
        a2.addEventListener('click', function () {
          setLastZone('nutrition');
        });
      }
    }
  }

  function refreshTodayHints() {
    const lastZone = getLastZone();
    const nextZone = getNextZone() || getRecommendedZone();

    const todayZoneCount = D.getElementById('todayZoneCount');
    const todayLastGame = D.getElementById('todayLastGame');
    const todayNextGame = D.getElementById('todayNextGame');

    if (todayZoneCount && lastZone) {
      todayZoneCount.textContent = '1';
    }

    if (todayLastGame && lastZone) {
      todayLastGame.textContent =
        lastZone === 'hygiene' ? 'Hygiene Zone' :
        lastZone === 'nutrition' ? 'Nutrition Zone' :
        lastZone === 'fitness' ? 'Fitness Zone' :
        'ยังไม่มี';
    }

    if (todayNextGame && nextZone) {
      todayNextGame.textContent =
        nextZone === 'hygiene' ? 'ไป Hygiene Zone' :
        nextZone === 'nutrition' ? 'ไป Nutrition Zone' :
        nextZone === 'fitness' ? 'ไป Fitness Zone' :
        todayNextGame.textContent;
    }
  }

  function bootZoneFirstPatch() {
    patchPreviewRenderFunctions();
    stripZonePreview();
    installPreviewMutationGuards();

    bindZoneButtons();
    bindQuickButtons();
    patchGoodJunkHallCard();
    refreshTodayHints();
  }

  if (!W.__HH_ZONE_FIRST_PATCH__) {
    W.__HH_ZONE_FIRST_PATCH__ = true;

    D.addEventListener('DOMContentLoaded', bootZoneFirstPatch);
    W.addEventListener('load', bootZoneFirstPatch);
    W.addEventListener('focus', bootZoneFirstPatch);

    D.addEventListener('visibilitychange', function () {
      if (!D.hidden) bootZoneFirstPatch();
    });

    safeBootSoon();
  }

  function safeBootSoon() {
    setTimeout(bootZoneFirstPatch, 0);
    setTimeout(bootZoneFirstPatch, 120);
    setTimeout(bootZoneFirstPatch, 500);
  }
})();