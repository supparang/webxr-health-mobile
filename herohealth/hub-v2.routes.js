/* =========================================================
   HeroHealth Hub v2 Routes
   PATCH v20260411a-hub-clean
   ========================================================= */
(function (W) {
  'use strict';

  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
  const NEXT_ZONE_KEY = 'HHA_NEXT_ZONE';
  const RECOMMENDED_ZONE_KEY = 'HHA_RECOMMENDED_ZONE';

  function qsGet(key, fallback = '') {
    try {
      const v = new URL(W.location.href).searchParams.get(key);
      return v == null || v === '' ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function safeSetStorage(key, value) {
    try {
      W.localStorage.setItem(key, String(value ?? ''));
    } catch (_) {}
  }

  function safeGetStorage(key, fallback = '') {
    try {
      const v = W.localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function setLastZone(zone) {
    safeSetStorage(LAST_ZONE_KEY, zone || '');
  }

  function getLastZone() {
    return safeGetStorage(LAST_ZONE_KEY, '');
  }

  function setNextZone(zone) {
    safeSetStorage(NEXT_ZONE_KEY, zone || '');
  }

  function getNextZone() {
    return safeGetStorage(NEXT_ZONE_KEY, '');
  }

  function setRecommendedZone(zone) {
    safeSetStorage(RECOMMENDED_ZONE_KEY, zone || '');
  }

  function getRecommendedZone() {
    return safeGetStorage(RECOMMENDED_ZONE_KEY, '');
  }

  function getPlayerName() {
    return qsGet('name', qsGet('nickName', 'Hero'));
  }

  function getCommonCtx() {
    return {
      pid: qsGet('pid', 'anon'),
      name: getPlayerName(),
      nickName: qsGet('nickName', ''),
      run: qsGet('run', 'play'),
      diff: qsGet('diff', 'normal'),
      view: qsGet('view', 'mobile'),
      time: qsGet('time', '90'),
      zone: qsGet('zone', ''),
      cat: qsGet('cat', ''),
      game: qsGet('game', ''),
      gameId: qsGet('gameId', ''),
      theme: qsGet('theme', ''),
      mode: qsGet('mode', ''),
      studyId: qsGet('studyId', ''),
      seed: qsGet('seed', ''),
      debug: qsGet('debug', ''),
      api: qsGet('api', ''),
      log: qsGet('log', ''),
      schoolCode: qsGet('schoolCode', ''),
      classRoom: qsGet('classRoom', ''),
      studentNo: qsGet('studentNo', ''),
      sessionNo: qsGet('sessionNo', ''),
      weekNo: qsGet('weekNo', ''),
      teacher: qsGet('teacher', ''),
      grade: qsGet('grade', ''),
      studentKey: qsGet('studentKey', ''),
      phase: qsGet('phase', ''),
      conditionGroup: qsGet('conditionGroup', '')
    };
  }

  function setParamIfValue(url, key, value) {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  }

  function applyCommonParams(url, ctx) {
    if (!(url instanceof URL)) return url;

    const safeCtx = ctx || getCommonCtx();

    url.searchParams.set('pid', safeCtx.pid || 'anon');
    url.searchParams.set('name', safeCtx.name || 'Hero');
    url.searchParams.set('run', safeCtx.run || 'play');
    url.searchParams.set('diff', safeCtx.diff || 'normal');
    url.searchParams.set('view', safeCtx.view || 'mobile');
    url.searchParams.set('time', safeCtx.time || '90');
    url.searchParams.set('hub', W.location.href);

    setParamIfValue(url, 'nickName', safeCtx.nickName);
    setParamIfValue(url, 'studyId', safeCtx.studyId);
    setParamIfValue(url, 'seed', safeCtx.seed);
    setParamIfValue(url, 'debug', safeCtx.debug);
    setParamIfValue(url, 'api', safeCtx.api);
    setParamIfValue(url, 'log', safeCtx.log);
    setParamIfValue(url, 'schoolCode', safeCtx.schoolCode);
    setParamIfValue(url, 'classRoom', safeCtx.classRoom);
    setParamIfValue(url, 'studentNo', safeCtx.studentNo);
    setParamIfValue(url, 'sessionNo', safeCtx.sessionNo);
    setParamIfValue(url, 'weekNo', safeCtx.weekNo);
    setParamIfValue(url, 'teacher', safeCtx.teacher);
    setParamIfValue(url, 'grade', safeCtx.grade);
    setParamIfValue(url, 'studentKey', safeCtx.studentKey);
    setParamIfValue(url, 'phase', safeCtx.phase);
    setParamIfValue(url, 'conditionGroup', safeCtx.conditionGroup);

    return url;
  }

  function buildUrl(basePath, extraParams) {
    const url = new URL(basePath, W.location.href);
    applyCommonParams(url, getCommonCtx());

    if (extraParams && typeof extraParams === 'object') {
      Object.keys(extraParams).forEach((key) => {
        const value = extraParams[key];
        if (value == null || value === '') return;
        url.searchParams.set(key, String(value));
      });
    }

    return url.toString();
  }

  function normalizeZone(zone, fallback = 'nutrition') {
    const z = String(zone || '').trim().toLowerCase();
    if (z === 'hygiene' || z === 'nutrition' || z === 'fitness') return z;
    return fallback;
  }

  function buildZoneUrl(zone) {
    const safeZone = normalizeZone(zone);
    const zoneMap = {
      hygiene: './hygiene-zone.html',
      nutrition: './nutrition-zone.html',
      fitness: './fitness-zone.html'
    };

    return buildUrl(zoneMap[safeZone] || './hub-v2.html', {
      zone: safeZone
    });
  }

  function buildFitnessPlannerUrl(mode) {
    const m = String(mode || 'launcher').trim().toLowerCase();

    let base = './fitness-planner.html';
    if (m === 'quick' || m === 'class') base = './fitness-planner/index.html';
    if (m === 'weekly') base = './fitness-planner/weekly.html';

    const extra = {
      zone: 'fitness',
      cat: 'fitness',
      game: 'fitnessplanner',
      gameId: 'fitnessplanner',
      theme: 'fitnessplanner'
    };

    if (m === 'quick' || m === 'class' || m === 'weekly') {
      extra.mode = m;
      extra.seed = String(Date.now());
    }

    return buildUrl(base, extra);
  }

  function buildFitnessLauncherUrl(config) {
    const cfg = config || {};
    const base = cfg.path || './fitness-zone.html';

    return buildUrl(base, {
      zone: 'fitness',
      cat: 'fitness',
      game: cfg.game || '',
      gameId: cfg.gameId || cfg.game || '',
      theme: cfg.theme || cfg.game || '',
      mode: cfg.mode || 'solo',
      diff: qsGet('diff', cfg.diff || 'normal'),
      view: qsGet('view', cfg.view || 'mobile'),
      time: qsGet('time', cfg.time || '90')
    });
  }

  function goToZone(zone) {
    const safeZone = normalizeZone(zone);
    setLastZone(safeZone);
    W.location.href = buildZoneUrl(safeZone);
  }

  function patchAnchorHref(anchorOrId, href) {
    const el = typeof anchorOrId === 'string'
      ? W.document.getElementById(anchorOrId)
      : anchorOrId;

    if (!el) return null;
    if ('href' in el) el.href = href;
    return el;
  }

  function getDebugSnapshot() {
    const ctx = getCommonCtx();

    return {
      href: W.location.href,
      ctx,
      zoneState: {
        lastZone: getLastZone(),
        nextZone: getNextZone(),
        recommendedZone: getRecommendedZone()
      },
      resolved: {
        hygieneZone: buildZoneUrl('hygiene'),
        nutritionZone: buildZoneUrl('nutrition'),
        fitnessZone: buildZoneUrl('fitness'),
        plannerLauncher: buildFitnessPlannerUrl('launcher'),
        plannerQuick: buildFitnessPlannerUrl('quick'),
        plannerClass: buildFitnessPlannerUrl('class'),
        plannerWeekly: buildFitnessPlannerUrl('weekly')
      }
    };
  }

  W.HHHubRoutes = {
    qsGet,
    getPlayerName,
    getCommonCtx,
    applyCommonParams,
    buildUrl,
    normalizeZone,

    setLastZone,
    getLastZone,
    setNextZone,
    getNextZone,
    setRecommendedZone,
    getRecommendedZone,

    buildZoneUrl,
    buildFitnessPlannerUrl,
    buildFitnessLauncherUrl,
    goToZone,
    patchAnchorHref,
    getDebugSnapshot
  };
})(window);
