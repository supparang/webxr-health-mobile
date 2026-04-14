(function () {
  'use strict';

  const ROOT_KEY = 'HHA_HANDWASH';
  const KEYS = {
    last: `${ROOT_KEY}_LAST`,
    history: `${ROOT_KEY}_HISTORY`,
    flow: `${ROOT_KEY}_FLOW`
  };

  function safeParse(text, fallback) {
    try { return JSON.parse(text); } catch { return fallback; }
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return safeParse(raw, fallback);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function str(value, fallback = '') {
    const s = String(value ?? '').trim();
    return s || fallback;
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function nowTs() {
    return Date.now();
  }

  function safeAbsUrl(raw, fallbackPath) {
    const value = String(raw || '').trim();
    try {
      if (value) return new URL(value, location.href).toString();
    } catch {}
    return new URL(fallbackPath, location.href).toString();
  }

  function firstNonEmpty(...vals) {
    for (const v of vals) {
      const s = String(v ?? '').trim();
      if (s) return s;
    }
    return '';
  }

  function looksLikeHubUrl(urlText) {
    const txt = String(urlText || '').toLowerCase();
    return txt.includes('/hub.html') || txt.includes('/hub-v2.html');
  }

  function looksLikeZoneUrl(urlText) {
    return String(urlText || '').toLowerCase().includes('hygiene-zone.html');
  }

  function normalizeStage(stage) {
    const s = str(stage).toLowerCase();
    if (s === 'howto' || s === 'practice' || s === 'main' || s === 'mini-order') return s;
    return 'unknown';
  }

  function stageLabel(stage) {
    switch (normalizeStage(stage)) {
      case 'howto': return 'Howto';
      case 'practice': return 'Practice Lab';
      case 'main': return 'Main Game';
      case 'mini-order': return 'Mini Order';
      default: return 'Unknown';
    }
  }

  function buildHubRoot() {
    const explicitHubRoot = firstNonEmpty(qs('hubRoot', ''));
    if (explicitHubRoot) return safeAbsUrl(explicitHubRoot, '../hub-v2.html');

    const legacyHub = firstNonEmpty(qs('hub', ''));
    if (legacyHub && looksLikeHubUrl(legacyHub)) {
      return safeAbsUrl(legacyHub, '../hub-v2.html');
    }

    return safeAbsUrl('../hub-v2.html', '../hub-v2.html');
  }

  function buildFallbackZoneReturn(viewOverride = '') {
    const view = str(viewOverride, str(qs('view', 'mobile'), 'mobile'));
    const hubRoot = buildHubRoot();
    const url = new URL('../hygiene-zone.html', location.href);

    const passKeys = [
      'pid', 'name', 'nick', 'nickName', 'studyId',
      'diff', 'time', 'run',
      'debug', 'api', 'log',
      'studentKey', 'schoolCode', 'classRoom', 'studentNo',
      'conditionGroup', 'sessionNo', 'weekNo', 'teacher', 'grade'
    ];

    passKeys.forEach((key) => {
      const v = qs(key, '');
      if (v !== '') url.searchParams.set(key, v);
    });

    if (!url.searchParams.get('pid')) url.searchParams.set('pid', 'anon');
    if (!url.searchParams.get('name')) {
      url.searchParams.set(
        'name',
        firstNonEmpty(qs('name', ''), qs('nickName', ''), qs('nick', ''), 'Hero')
      );
    }
    if (!url.searchParams.get('diff')) url.searchParams.set('diff', 'normal');
    if (!url.searchParams.get('time')) url.searchParams.set('time', '90');
    if (!url.searchParams.get('run')) url.searchParams.set('run', 'play');

    url.searchParams.set('view', view);
    url.searchParams.set('zone', 'hygiene');
    url.searchParams.set('cat', 'hygiene');
    url.searchParams.set('hubRoot', hubRoot);
    url.searchParams.set('hub', hubRoot);

    return url.toString();
  }

  function buildZoneReturn(viewOverride = '') {
    const explicitZoneReturn = firstNonEmpty(qs('zoneReturn', ''));
    if (explicitZoneReturn) return safeAbsUrl(explicitZoneReturn, '../hygiene-zone.html');

    const legacyHub = firstNonEmpty(qs('hub', ''));
    if (legacyHub && looksLikeZoneUrl(legacyHub)) {
      return safeAbsUrl(legacyHub, '../hygiene-zone.html');
    }

    return buildFallbackZoneReturn(viewOverride);
  }

  function buildBaseContext(extra = {}) {
    const view = str(extra.view, str(qs('view', 'mobile'), 'mobile'));
    const hubRoot = buildHubRoot();
    const zoneReturn = buildZoneReturn(view);

    return {
      pid: str(qs('pid', 'anon'), 'anon'),
      name: str(firstNonEmpty(qs('name', ''), qs('nickName', ''), qs('nick', ''), 'Hero'), 'Hero'),
      diff: str(qs('diff', 'normal'), 'normal'),
      time: num(qs('time', 0), 0),
      view,
      run: str(qs('run', 'play'), 'play'),
      zone: str(qs('zone', 'hygiene'), 'hygiene'),
      cat: str(qs('cat', 'hygiene'), 'hygiene'),
      game: str(qs('game', 'handwash'), 'handwash'),
      gameId: str(qs('gameId', 'handwash'), 'handwash'),
      theme: str(qs('theme', 'handwash'), 'handwash'),
      studyId: str(qs('studyId', ''), ''),
      hubRoot,
      hub: str(qs('hub', zoneReturn), zoneReturn),
      zoneReturn,
      next: str(qs('next', zoneReturn), zoneReturn),
      main: str(qs('main', ''), ''),
      ...extra
    };
  }

  function normalizeEntry(payload = {}) {
    const base = buildBaseContext();
    return {
      ...base,
      stage: normalizeStage(payload.stage),
      success: !!payload.success,
      score: Math.max(0, Math.round(num(payload.score, 0))),
      stars: clamp(Math.round(num(payload.stars, 0)), 0, 3),
      miss: Math.max(0, Math.round(num(payload.miss, 0))),
      timeLeft: Math.max(0, Math.round(num(payload.timeLeft, 0))),
      progress: clamp(Math.round(num(payload.progress, 0)), 0, 100),
      accuracy: clamp(Math.round(num(payload.accuracy, 0)), 0, 100),
      bestStreak: Math.max(0, Math.round(num(payload.bestStreak, 0))),
      whoDone: clamp(Math.round(num(payload.whoDone, 0)), 0, 7),
      notes: str(payload.notes, ''),
      timestamp: num(payload.timestamp, nowTs())
    };
  }

  function getLast() {
    return read(KEYS.last, null);
  }

  function getHistory() {
    const items = read(KEYS.history, []);
    return Array.isArray(items) ? items : [];
  }

  function getFlow() {
    return read(KEYS.flow, null);
  }

  function rememberZoneState(entry) {
    try {
      localStorage.setItem('HHA_LAST_ZONE', 'hygiene');
    } catch {}

    try {
      localStorage.setItem('HHA_LAST_GAME_BY_ZONE_HYGIENE', JSON.stringify({
        key: 'handwash',
        title: 'Handwash',
        at: entry.timestamp || nowTs()
      }));
    } catch {}

    try {
      const playedKey = 'HHA_ZONE_PLAYED_HYGIENE';
      const played = safeParse(localStorage.getItem(playedKey) || '[]', []);
      if (Array.isArray(played) && !played.includes('handwash')) {
        played.push('handwash');
        localStorage.setItem(playedKey, JSON.stringify(played));
      }
    } catch {}

    try {
      const dailyKey = 'HHA_ZONE_DAILY_HYGIENE';
      const d = new Date();
      const day =
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const daily = safeParse(localStorage.getItem(dailyKey) || '{}', {});
      const row = daily[day] || { count: 0, lastKey: '' };
      row.count += 1;
      row.lastKey = 'handwash';
      daily[day] = row;
      localStorage.setItem(dailyKey, JSON.stringify(daily));
    } catch {}
  }

  function saveSummary(payload = {}) {
    const entry = normalizeEntry(payload);
    write(KEYS.last, entry);

    const history = getHistory();
    history.unshift(entry);
    write(KEYS.history, history.slice(0, 40));

    write(KEYS.flow, {
      pid: entry.pid,
      name: entry.name,
      stage: entry.stage,
      success: entry.success,
      timestamp: entry.timestamp,
      hubRoot: entry.hubRoot,
      zoneReturn: entry.zoneReturn
    });

    rememberZoneState(entry);
    return entry;
  }

  function clearAll() {
    remove(KEYS.last);
    remove(KEYS.history);
    remove(KEYS.flow);
  }

  function getLatestByStage(stage) {
    const target = normalizeStage(stage);
    return getHistory().find(item => normalizeStage(item.stage) === target) || null;
  }

  function getLatestSuccessByStage(stage) {
    const target = normalizeStage(stage);
    return getHistory().find(item => normalizeStage(item.stage) === target && item.success) || null;
  }

  function getLatestSuccessByStages(stages = []) {
    const targetSet = new Set(stages.map(normalizeStage));
    return getHistory().find(item => targetSet.has(normalizeStage(item.stage)) && item.success) || null;
  }

  function getResumeStage() {
    const firstStageDone = !!getLatestSuccessByStages(['howto', 'practice']);
    const mainDone = !!getLatestSuccessByStage('main');
    const miniDone = !!getLatestSuccessByStage('mini-order');

    if (!firstStageDone) return 'practice';
    if (!mainDone) return 'main';
    if (!miniDone) return 'mini-order';
    return 'done';
  }

  function applyCommonParams(params, ctx, timeOverride = 0) {
    const timeValue = timeOverride > 0 ? timeOverride : (ctx.time || 0);

    params.set('pid', str(ctx.pid, 'anon'));
    params.set('name', str(ctx.name, 'Hero'));
    params.set('diff', str(ctx.diff, 'normal'));
    params.set('view', str(ctx.view, 'mobile'));
    params.set('run', str(ctx.run, 'play'));
    params.set('zone', 'hygiene');
    params.set('cat', 'hygiene');
    params.set('game', 'handwash');
    params.set('gameId', 'handwash');
    params.set('theme', 'handwash');
    params.set('seed', String(nowTs()));
    params.set('hubRoot', ctx.hubRoot);
    params.set('hub', ctx.zoneReturn);
    params.set('zoneReturn', ctx.zoneReturn);
    params.set('next', ctx.zoneReturn);

    if (timeValue > 0) params.set('time', String(timeValue));
    if (ctx.studyId) params.set('studyId', ctx.studyId);

    [
      'debug', 'api', 'log',
      'studentKey', 'schoolCode', 'classRoom', 'studentNo',
      'conditionGroup', 'sessionNo', 'weekNo', 'teacher', 'grade'
    ].forEach((key) => {
      const v = qs(key, '');
      if (v) params.set(key, v);
    });
  }

  function buildUrls(viewOverride = '') {
    const view = str(viewOverride, str(qs('view', 'mobile'), 'mobile'));
    const ctx = buildBaseContext({ view });

    const howtoUrl = new URL('./handwash-howto.html', location.href);
    const mainUrl = new URL('./handwash-vr.html', location.href);
    const miniUrl = new URL('./handwash-mini-order.html', location.href);

    const miniParams = new URLSearchParams();
    const mainParams = new URLSearchParams();
    const howtoParams = new URLSearchParams();

    applyCommonParams(miniParams, ctx, num(qs('miniTime', 60), 60));
    miniParams.set('stage', 'mini-order');
    miniParams.set('next', ctx.zoneReturn);

    const miniAbs = `${miniUrl.pathname}?${miniParams.toString()}`;

    applyCommonParams(mainParams, ctx, num(qs('time', ctx.time || 90), ctx.time || 90));
    mainParams.set('stage', 'main');
    mainParams.set('next', miniAbs);

    const mainAbs = `${mainUrl.pathname}?${mainParams.toString()}`;

    applyCommonParams(howtoParams, ctx, num(qs('time', ctx.time || 90), ctx.time || 90));
    howtoParams.set('stage', 'practice');
    howtoParams.set('main', mainAbs);
    howtoParams.set('next', mainAbs);

    const howtoAbs = `${howtoUrl.pathname}?${howtoParams.toString()}`;

    return {
      howto: howtoAbs,
      practice: howtoAbs,
      main: mainAbs,
      'mini-order': miniAbs,
      done: ctx.zoneReturn
    };
  }

  window.HandwashShared = {
    ROOT_KEY,
    KEYS,
    str,
    num,
    clamp,
    qs,
    nowTs,
    stageLabel,
    buildHubRoot,
    buildZoneReturn,
    buildBaseContext,
    normalizeEntry,
    saveSummary,
    getLast,
    getHistory,
    getFlow,
    clearAll,
    getLatestByStage,
    getLatestSuccessByStage,
    getLatestSuccessByStages,
    getResumeStage,
    buildUrls,
    listSummaries: getHistory,
    getSummaries: getHistory
  };
})();