/* =========================================================
   HeroHealth Hub v2 Zone-First Bootstrap
   PATCH v20260411a-hub-clean
   ========================================================= */
(function (W, D) {
  'use strict';

  function byId(id) {
    return D.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = String(value ?? '');
  }

  function show(id) {
    const el = byId(id);
    if (el) el.hidden = false;
  }

  function hide(id) {
    const el = byId(id);
    if (el) el.hidden = true;
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  function readStorage(key, fallback = '') {
    try {
      const v = W.localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function readStorageJson(key, fallback = null) {
    try {
      const raw = W.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function getRoutes() {
    return W.HHHubRoutes || null;
  }

  function zoneLabel(zone) {
    const z = String(zone || '').trim().toLowerCase();
    if (z === 'hygiene') return 'Hygiene Zone';
    if (z === 'nutrition') return 'Nutrition Zone';
    if (z === 'fitness') return 'Fitness Zone';
    return 'ยังไม่มี';
  }

  function zoneThaiLabel(zone) {
    const z = String(zone || '').trim().toLowerCase();
    if (z === 'hygiene') return 'Hygiene';
    if (z === 'nutrition') return 'Nutrition';
    if (z === 'fitness') return 'Fitness';
    return 'ยังไม่มี';
  }

  function validZone(zone, fallback = 'nutrition') {
    const routes = getRoutes();
    if (routes && typeof routes.normalizeZone === 'function') {
      return routes.normalizeZone(zone, fallback);
    }
    const z = String(zone || '').trim().toLowerCase();
    if (z === 'hygiene' || z === 'nutrition' || z === 'fitness') return z;
    return fallback;
  }

  function stripZonePreview() {
    ['hygPreview', 'nutriPreview', 'fitPreview'].forEach(function (id) {
      const el = byId(id);
      if (!el) return;
      el.innerHTML = '';
      el.hidden = true;
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    });
  }

  function patchZonePlayLinks() {
    const routes = getRoutes();
    if (!routes) return;

    routes.patchAnchorHref('btnPlayHygiene', routes.buildZoneUrl('hygiene'));
    routes.patchAnchorHref('btnPlayNutrition', routes.buildZoneUrl('nutrition'));
    routes.patchAnchorHref('btnPlayFitness', routes.buildZoneUrl('fitness'));
  }

  function goZone(zone) {
    const routes = getRoutes();
    const safeZone = validZone(zone, 'nutrition');

    if (routes && typeof routes.goToZone === 'function') {
      routes.goToZone(safeZone);
      return;
    }

    W.location.href = './hub-v2.html';
  }

  function bindZoneButton(id, zone) {
    const el = byId(id);
    if (!el || el.__hhZoneBound) return;

    el.__hhZoneBound = true;
    el.addEventListener('click', function () {
      goZone(zone);
    });
  }

  function bindPlayAnchor(id, zone) {
    const el = byId(id);
    if (!el || el.__hhPlayBound) return;

    el.__hhPlayBound = true;
    el.addEventListener('click', function () {
      const routes = getRoutes();
      if (routes) routes.setLastZone(validZone(zone));
    });
  }

  function bindQuickButtons() {
    const routes = getRoutes();
    if (!routes) return;

    const btnRecommended = byId('btnQuickRecommended');
    if (btnRecommended && !btnRecommended.__hhBound) {
      btnRecommended.__hhBound = true;
      btnRecommended.addEventListener('click', function () {
        const zone = validZone(routes.getRecommendedZone(), 'nutrition');
        goZone(zone);
      });
    }

    const btnRecent = byId('btnQuickRecent');
    if (btnRecent && !btnRecent.__hhBound) {
      btnRecent.__hhBound = true;
      btnRecent.addEventListener('click', function () {
        const zone = validZone(routes.getLastZone(), 'nutrition');
        goZone(zone);
      });
    }

    const btnAll = byId('btnQuickAllGames');
    if (btnAll && !btnAll.__hhBound) {
      btnAll.__hhBound = true;
      btnAll.addEventListener('click', function () {
        const zone = validZone(routes.getRecommendedZone() || routes.getLastZone(), 'nutrition');
        goZone(zone);
      });
    }
  }

  function bindResumeButtons() {
    const routes = getRoutes();
    if (!routes) return;

    const btnResume = byId('btnResumeNow');
    if (btnResume && !btnResume.__hhBound) {
      btnResume.__hhBound = true;
      btnResume.addEventListener('click', function () {
        const zone = validZone(routes.getLastZone(), 'nutrition');
        goZone(zone);
      });
    }

    const btnNext = byId('btnNextInZone');
    if (btnNext && !btnNext.__hhBound) {
      btnNext.__hhBound = true;
      btnNext.addEventListener('click', function () {
        const zone = validZone(routes.getNextZone() || routes.getRecommendedZone(), 'nutrition');
        goZone(zone);
      });
    }
  }

  function bindZoneButtons() {
    bindZoneButton('btnZoneHygiene', 'hygiene');
    bindZoneButton('btnZoneNutrition', 'nutrition');
    bindZoneButton('btnZoneFitness', 'fitness');

    bindPlayAnchor('btnPlayHygiene', 'hygiene');
    bindPlayAnchor('btnPlayNutrition', 'nutrition');
    bindPlayAnchor('btnPlayFitness', 'fitness');
  }

  function refreshTodayHints() {
    const routes = getRoutes();
    if (!routes) return;

    const lastZone = validZone(routes.getLastZone(), '');
    const nextZone = validZone(routes.getNextZone() || routes.getRecommendedZone(), '');

    setText('todayPlayedCount', lastZone ? '1' : '0');
    setText('todayZoneCount', lastZone ? '1' : '0');
    setText('todayLastGame', lastZone ? zoneLabel(lastZone) : 'ยังไม่มี');

    const nextText = nextZone
      ? ('ไป ' + zoneThaiLabel(nextZone) + ' Zone')
      : 'ระบบกำลังเลือกให้';

    setText('todayNextGame', nextText);
  }

  function refreshHeroQuickline() {
    const routes = getRoutes();
    if (!routes) return;

    const recommended = validZone(routes.getRecommendedZone(), '');
    const lastZone = validZone(routes.getLastZone(), '');

    let text = 'วันนี้ลองเล่นให้ครบ 3 โซนกันนะ';

    if (recommended) {
      text = `วันนี้แนะนำให้เริ่มที่ ${zoneThaiLabel(recommended)} Zone`;
    } else if (lastZone) {
      text = `ล่าสุดเล่น ${zoneThaiLabel(lastZone)} Zone แล้ว ลองไปต่ออีกโซนกัน`;
    }

    setText('heroQuickline', text);
  }

  function patchZoneLinksAndWidgets() {
    patchZonePlayLinks();

    if (W.HHHubFitnessHall && typeof W.HHHubFitnessHall.render === 'function') {
      W.HHHubFitnessHall.render();
    }

    if (W.HHHubGoodJunk && typeof W.HHHubGoodJunk.render === 'function') {
      W.HHHubGoodJunk.render();
    }
  }

  function bindWidgets() {
    if (W.HHHubFitnessHall && typeof W.HHHubFitnessHall.bind === 'function') {
      W.HHHubFitnessHall.bind();
    }

    if (W.HHHubGoodJunk && typeof W.HHHubGoodJunk.bind === 'function') {
      W.HHHubGoodJunk.bind();
    }
  }

  function collectLastSummaryState() {
    const result = {};
    try {
      for (let i = 0; i < W.localStorage.length; i += 1) {
        const key = W.localStorage.key(i);
        if (!key) continue;
        if (!/LAST_SUMMARY|LAST_RESULT|LAST_LOG/i.test(key)) continue;

        const raw = readStorage(key, '');
        let value = raw;
        try {
          value = JSON.parse(raw);
        } catch (_) {}
        result[key] = value;
      }
    } catch (_) {}
    return result;
  }

  function collectWarmupState() {
    const result = {};
    try {
      for (let i = 0; i < W.localStorage.length; i += 1) {
        const key = W.localStorage.key(i);
        if (!key) continue;
        if (!/WARMUP|COOLDOWN|GATE|BUFF/i.test(key)) continue;

        const raw = readStorage(key, '');
        let value = raw;
        try {
          value = JSON.parse(raw);
        } catch (_) {}
        result[key] = value;
      }
    } catch (_) {}
    return result;
  }

  function buildRecentByZoneState() {
    const routes = getRoutes();

    return {
      lastZone: routes ? routes.getLastZone() : '',
      nextZone: routes ? routes.getNextZone() : '',
      recommendedZone: routes ? routes.getRecommendedZone() : '',
      nutritionRecent: readStorageJson('HHA_GJ_HUB_SNAPSHOT', null)?.archive?.recent || []
    };
  }

  function renderQuickLinks(links) {
    const wrap = byId('diagQuickLinks');
    if (!wrap) return;

    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);

    const entries = Object.entries(links || {});
    if (!entries.length) {
      const empty = D.createElement('div');
      empty.textContent = 'No quick links';
      wrap.appendChild(empty);
      return;
    }

    entries.forEach(function ([label, href]) {
      if (!href) return;

      const a = D.createElement('a');
      a.href = href;
      a.textContent = label;
      a.target = '_self';
      a.rel = 'noopener';
      a.className = 'diag-link';
      wrap.appendChild(a);
    });
  }

  function refreshDiagnostics() {
    const routes = getRoutes();
    if (!routes) return;

    const debug = routes.getDebugSnapshot ? routes.getDebugSnapshot() : {};
    const gj = W.HHHubGoodJunk && W.HHHubGoodJunk.getDebugState
      ? W.HHHubGoodJunk.getDebugState()
      : null;
    const fit = W.HHHubFitnessHall && W.HHHubFitnessHall.getDebugState
      ? W.HHHubFitnessHall.getDebugState()
      : null;

    const contextBox = byId('diagContext');
    if (contextBox) {
      contextBox.textContent = safeStringify(debug.ctx || {});
    }

    const warmupBox = byId('diagWarmup');
    if (warmupBox) {
      warmupBox.textContent = safeStringify({
        queryPhase: routes.qsGet ? routes.qsGet('phase', '') : '',
        warmupState: collectWarmupState()
      });
    }

    const summaryBox = byId('diagLastSummary');
    if (summaryBox) {
      summaryBox.textContent = safeStringify({
        snapshots: collectLastSummaryState(),
        goodJunk: gj
      });
    }

    const recentBox = byId('diagRecentByZone');
    if (recentBox) {
      recentBox.textContent = safeStringify(buildRecentByZoneState());
    }

    const resolvedBox = byId('diagResolvedRoutes');
    if (resolvedBox) {
      resolvedBox.textContent = safeStringify({
        routes: debug.resolved || {},
        fitnessHall: fit ? fit.resolved : {}
      });
    }

    renderQuickLinks({
      'Hygiene Zone': debug?.resolved?.hygieneZone || '',
      'Nutrition Zone': debug?.resolved?.nutritionZone || '',
      'Fitness Zone': debug?.resolved?.fitnessZone || '',
      'Fitness Planner': debug?.resolved?.plannerLauncher || '',
      'Planner Quick': debug?.resolved?.plannerQuick || '',
      'Planner Class': debug?.resolved?.plannerClass || '',
      'Planner Weekly': debug?.resolved?.plannerWeekly || ''
    });
  }

  function buildFullDebugSnapshot() {
    const routes = getRoutes();
    return {
      href: W.location.href,
      routeSnapshot: routes && routes.getDebugSnapshot ? routes.getDebugSnapshot() : null,
      goodJunk: W.HHHubGoodJunk && W.HHHubGoodJunk.getDebugState
        ? W.HHHubGoodJunk.getDebugState()
        : null,
      fitnessHall: W.HHHubFitnessHall && W.HHHubFitnessHall.getDebugState
        ? W.HHHubFitnessHall.getDebugState()
        : null,
      warmup: collectWarmupState(),
      lastSummary: collectLastSummaryState(),
      recentByZone: buildRecentByZoneState()
    };
  }

  function copyText(text) {
    if (W.navigator && W.navigator.clipboard && W.navigator.clipboard.writeText) {
      return W.navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      try {
        const ta = D.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        D.body.appendChild(ta);
        ta.select();
        D.execCommand('copy');
        D.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function openDiagnostics() {
    refreshDiagnostics();
    show('diagnosticsPanel');
  }

  function closeDiagnostics() {
    hide('diagnosticsPanel');
  }

  function showToast(message) {
    const toast = byId('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (toast.__hideTimer) {
      W.clearTimeout(toast.__hideTimer);
    }

    toast.__hideTimer = W.setTimeout(function () {
      toast.classList.remove('show');
    }, 1800);
  }

  function bindDiagnostics() {
    const btnOpen = byId('btnDiagnostics');
    if (btnOpen && !btnOpen.__hhBound) {
      btnOpen.__hhBound = true;
      btnOpen.addEventListener('click', openDiagnostics);
    }

    const btnClose = byId('btnCloseDiagnostics');
    if (btnClose && !btnClose.__hhBound) {
      btnClose.__hhBound = true;
      btnClose.addEventListener('click', closeDiagnostics);
    }

    const btnCopy = byId('btnCopyDebugSnapshot');
    if (btnCopy && !btnCopy.__hhBound) {
      btnCopy.__hhBound = true;
      btnCopy.addEventListener('click', function () {
        copyText(safeStringify(buildFullDebugSnapshot()))
          .then(function () {
            showToast('คัดลอก snapshot แล้ว');
          })
          .catch(function () {
            showToast('คัดลอก snapshot ไม่สำเร็จ');
          });
      });
    }
  }

  function initOnce() {
    stripZonePreview();
    bindZoneButtons();
    bindQuickButtons();
    bindResumeButtons();
    bindWidgets();
    bindDiagnostics();
  }

  function refreshView() {
    patchZoneLinksAndWidgets();
    refreshTodayHints();
    refreshHeroQuickline();
    refreshDiagnostics();
  }

  function boot() {
    initOnce();
    refreshView();
  }

  D.addEventListener('DOMContentLoaded', boot);

  W.addEventListener('focus', refreshView);
  W.addEventListener('pageshow', refreshView);

  D.addEventListener('visibilitychange', function () {
    if (!D.hidden) refreshView();
  });

  W.HHHubZoneFirst = {
    boot,
    initOnce,
    refreshView,
    refreshDiagnostics
  };
})(window, document);