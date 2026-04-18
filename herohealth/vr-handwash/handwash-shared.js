// /herohealth/vr-handwash/handwash-shared.js
(function () {
  'use strict';

  const NS = 'HHA_HW';
  const LAST_SUMMARY_KEY = `${NS}_LAST_SUMMARY`;
  const SUMMARY_HISTORY_KEY = `${NS}_SUMMARY_HISTORY`;
  const MAX_HISTORY = 20;

  const DEFAULTS = {
    pid: 'anon',
    name: 'Hero',
    diff: 'normal',
    time: '90',
    view: 'mobile',
    run: 'play',
    zone: 'hygiene',
    cat: 'hygiene',
    game: 'handwash',
    gameId: 'handwash',
    theme: 'handwash',
    entry: 'full',
    stage: '',
    seed: ''
  };

  function getQs(url) {
    try {
      return new URL(url || window.location.href).searchParams;
    } catch (e) {
      return new URLSearchParams('');
    }
  }

  function getParam(key, fallback = '') {
    const qs = getQs();
    const v = qs.get(key);
    return v == null || v === '' ? fallback : v;
  }

  function currentUrl() {
    return window.location.href;
  }

  function absUrl(path) {
    return new URL(path, window.location.href).toString();
  }

  function defaultHubUrl() {
    return absUrl('../hygiene-zone.html');
  }

  function defaultLauncherUrl() {
    return absUrl('./handwash-launcher.html');
  }

  function cleanObject(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      const v = obj[k];
      if (v === undefined || v === null || v === '') return;
      out[k] = String(v);
    });
    return out;
  }

  function buildBaseParams(overrides = {}) {
    const qs = getQs();

    const merged = {
      ...DEFAULTS,
      pid: qs.get('pid') || DEFAULTS.pid,
      name: qs.get('name') || DEFAULTS.name,
      diff: qs.get('diff') || DEFAULTS.diff,
      time: qs.get('time') || DEFAULTS.time,
      view: qs.get('view') || DEFAULTS.view,
      run: qs.get('run') || DEFAULTS.run,
      zone: qs.get('zone') || DEFAULTS.zone,
      cat: qs.get('cat') || DEFAULTS.cat,
      game: qs.get('game') || DEFAULTS.game,
      gameId: qs.get('gameId') || DEFAULTS.gameId,
      theme: qs.get('theme') || DEFAULTS.theme,
      entry: qs.get('entry') || DEFAULTS.entry,
      stage: qs.get('stage') || DEFAULTS.stage,
      seed: qs.get('seed') || String(Date.now()),
      hub: qs.get('hub') || defaultHubUrl(),
      launcher: qs.get('launcher') || defaultLauncherUrl(),
      next: qs.get('next') || ''
    };

    return cleanObject({ ...merged, ...overrides });
  }

  function buildUrl(path, overrides = {}) {
    const url = new URL(path, window.location.href);
    const params = buildBaseParams(overrides);

    Object.keys(params).forEach((key) => {
      if (params[key] !== '') url.searchParams.set(key, params[key]);
    });

    return url.toString();
  }

  function buildZoneUrl(overrides = {}) {
    return buildUrl('../hygiene-zone.html', {
      stage: '',
      next: '',
      ...overrides
    });
  }

  function buildLauncherUrl(overrides = {}) {
    return buildUrl('./handwash-launcher.html', {
      stage: 'launcher',
      launcher: defaultLauncherUrl(),
      hub: defaultHubUrl(),
      next: '',
      ...overrides
    });
  }

  function buildHowtoUrl(overrides = {}) {
    return buildUrl('./handwash-howto.html', {
      stage: 'howto',
      ...overrides
    });
  }

  function buildPracticeUrl(overrides = {}) {
    return buildUrl('./handwash-vr.html', {
      stage: 'practice',
      ...overrides
    });
  }

  function buildMainUrl(overrides = {}) {
    return buildUrl('../handwash-v2.html', {
      stage: 'main',
      ...overrides
    });
  }

  function buildMiniUrl(overrides = {}) {
    return buildUrl('./handwash-mini-order.html', {
      stage: 'mini',
      ...overrides
    });
  }

  function go(url) {
    if (!url) return;
    window.location.href = url;
  }

  function goHub() {
    const hub = getParam('hub', defaultHubUrl());
    go(hub || buildZoneUrl());
  }

  function goLauncher() {
    const launcher = getParam('launcher', defaultLauncherUrl());
    go(launcher || buildLauncherUrl());
  }

  function goRetry() {
    go(currentUrl());
  }

  function goNext(fallbackBuilder) {
    const next = getParam('next', '');
    if (next) {
      go(next);
      return;
    }

    if (typeof fallbackBuilder === 'function') {
      go(fallbackBuilder());
      return;
    }

    goHub();
  }

  function saveSummary(payload = {}) {
    const summary = {
      ts: Date.now(),
      stage: payload.stage || getParam('stage', ''),
      entry: payload.entry || getParam('entry', ''),
      success: !!payload.success,
      score: Number(payload.score || 0),
      stars: Number(payload.stars || 0),
      miss: Number(payload.miss || 0),
      timeLeft: Number(payload.timeLeft || 0),
      accuracy: Number(payload.accuracy || 0),
      progress: Number(payload.progress || 0),
      bestStreak: Number(payload.bestStreak || 0),
      whoDone: Number(payload.whoDone || 0),
      badges: Array.isArray(payload.badges) ? payload.badges : [],
      rank: payload.rank || '',
      notes: payload.notes || '',
      pid: getParam('pid', DEFAULTS.pid),
      name: getParam('name', DEFAULTS.name),
      diff: getParam('diff', DEFAULTS.diff),
      view: getParam('view', DEFAULTS.view)
    };

    try {
      localStorage.setItem(LAST_SUMMARY_KEY, JSON.stringify(summary));
    } catch (e) {}

    pushSummaryHistory(summary);
    return summary;
  }

  function loadLastSummary() {
    try {
      const raw = localStorage.getItem(LAST_SUMMARY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function pushSummaryHistory(payload) {
    try {
      const raw = localStorage.getItem(SUMMARY_HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr) ? arr : [];
      next.unshift(payload);
      localStorage.setItem(SUMMARY_HISTORY_KEY, JSON.stringify(next.slice(0, MAX_HISTORY)));
    } catch (e) {}
  }

  function loadSummaryHistory() {
    try {
      const raw = localStorage.getItem(SUMMARY_HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function clearSummary() {
    try {
      localStorage.removeItem(LAST_SUMMARY_KEY);
    } catch (e) {}
  }

  function resolveFullFlowUrls(baseOverrides = {}) {
    const zoneUrl = buildZoneUrl(baseOverrides);
    const launcherUrl = buildLauncherUrl(baseOverrides);

    const miniUrl = buildMiniUrl({
      ...baseOverrides,
      entry: 'full',
      stage: 'mini',
      hub: zoneUrl,
      launcher: launcherUrl,
      next: zoneUrl
    });

    const mainUrl = buildMainUrl({
      ...baseOverrides,
      entry: 'full',
      stage: 'main',
      hub: zoneUrl,
      launcher: launcherUrl,
      next: miniUrl
    });

    const practiceUrl = buildPracticeUrl({
      ...baseOverrides,
      entry: 'full',
      stage: 'practice',
      hub: zoneUrl,
      launcher: launcherUrl,
      next: mainUrl
    });

    const howtoUrl = buildHowtoUrl({
      ...baseOverrides,
      entry: 'full',
      stage: 'howto',
      hub: zoneUrl,
      launcher: launcherUrl,
      next: practiceUrl
    });

    return {
      zoneUrl,
      launcherUrl,
      howtoUrl,
      practiceUrl,
      mainUrl,
      miniUrl
    };
  }

  function resolveDirectEntryUrls(baseOverrides = {}) {
    const zoneUrl = buildZoneUrl(baseOverrides);
    const launcherUrl = buildLauncherUrl(baseOverrides);

    const miniOnlyUrl = buildMiniUrl({
      ...baseOverrides,
      entry: 'mini',
      stage: 'mini',
      hub: zoneUrl,
      launcher: launcherUrl,
      next: zoneUrl
    });

    const mainOnlyUrl = buildMainUrl({
      ...baseOverrides,
      entry: 'main',
      stage: 'main',
      hub: zoneUrl,
      launcher: launcherUrl,
      next: miniOnlyUrl
    });

    const practiceOnlyUrl = buildPracticeUrl({
      ...baseOverrides,
      entry: 'practice',
      stage: 'practice',
      hub: zoneUrl,
      launcher: launcherUrl,
      next: mainOnlyUrl
    });

    return {
      zoneUrl,
      launcherUrl,
      practiceOnlyUrl,
      mainOnlyUrl,
      miniOnlyUrl
    };
  }

  function getEntry() {
    return getParam('entry', DEFAULTS.entry);
  }

  function getStage() {
    return getParam('stage', DEFAULTS.stage);
  }

  function isFullFlow() {
    return getEntry() === 'full';
  }

  function isDirectPractice() {
    return getEntry() === 'practice';
  }

  function isDirectMain() {
    return getEntry() === 'main';
  }

  function isDirectMini() {
    return getEntry() === 'mini';
  }

  window.HandwashShared = {
    DEFAULTS,

    getQs,
    getParam,
    buildBaseParams,

    buildUrl,
    buildZoneUrl,
    buildLauncherUrl,
    buildHowtoUrl,
    buildPracticeUrl,
    buildMainUrl,
    buildMiniUrl,

    go,
    goHub,
    goLauncher,
    goRetry,
    goNext,

    saveSummary,
    loadLastSummary,
    loadSummaryHistory,
    pushSummaryHistory,
    clearSummary,

    resolveFullFlowUrls,
    resolveDirectEntryUrls,

    getEntry,
    getStage,
    isFullFlow,
    isDirectPractice,
    isDirectMain,
    isDirectMini
  };
})();