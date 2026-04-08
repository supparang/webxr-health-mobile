(function (W, D) {
  'use strict';

  if (W.HHFitnessBridge) return;

  const STORAGE = {
    FITNESS_LAST: 'HH_FITNESS_LAST_GAME_V1',
    LAST_SUMMARY: 'HHA_LAST_SUMMARY',
    LAST_ZONE: 'HHA_LAST_ZONE',
    NEXT_ZONE: 'HHA_NEXT_ZONE',
    RECOMMENDED_ZONE: 'HHA_RECOMMENDED_ZONE'
  };

  const GAME_ALIASES = {
    'shadowbreaker': 'shadow-breaker',
    'shadow-breaker': 'shadow-breaker',

    'rhythmboxer': 'rhythm-boxer',
    'rhythm-boxer': 'rhythm-boxer',

    'jumpduck': 'jump-duck',
    'jump-duck': 'jump-duck',

    'balancehold': 'balance-hold',
    'balance-hold': 'balance-hold',

    'fitnessplanner': 'fitness-planner',
    'fitness-planner': 'fitness-planner'
  };

  const GAME_LABELS = {
    'shadow-breaker': 'Shadow Breaker',
    'rhythm-boxer': 'Rhythm Boxer',
    'jump-duck': 'Jump & Duck',
    'balance-hold': 'Balance Hold',
    'fitness-planner': 'Fitness Planner'
  };

  const DEFAULTS = {
    zone: 'fitness',
    nextZone: 'hygiene'
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? safeJsonParse(raw, fallback) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function setTextStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function qs(key, fallback = '') {
    try {
      const v = new URL(W.location.href).searchParams.get(key);
      return v == null || v === '' ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function canonicalGameId(input) {
    const raw = String(input || '').trim().toLowerCase();
    return GAME_ALIASES[raw] || raw || 'fitness-planner';
  }

  function gameLabel(gameId) {
    const id = canonicalGameId(gameId);
    return GAME_LABELS[id] || id || 'Fitness Game';
  }

  function numberOr(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function cleanText(v, fallback = '') {
    const s = String(v || '').trim();
    return s || fallback;
  }

  function buildHubUrl() {
    const raw = qs('hub', '');
    if (raw) {
      try { return new URL(raw, W.location.href).toString(); }
      catch (_) {}
    }
    return new URL('./hub-v2.html', W.location.href).toString();
  }

  function buildFitnessZoneUrl(extraParams) {
    const u = new URL('./fitness-zone.html', W.location.href);
    const params = [
      'pid',
      'name',
      'nick',
      'studyId',
      'run',
      'view',
      'diff',
      'time',
      'seed',
      'debug',
      'api',
      'log',
      'studentKey',
      'schoolCode',
      'classRoom',
      'studentNo',
      'nickName'
    ];

    params.forEach((k) => {
      const v = qs(k, '');
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('hub', buildHubUrl());

    if (extraParams && typeof extraParams === 'object') {
      Object.keys(extraParams).forEach((k) => {
        const v = extraParams[k];
        if (v == null || v === '') return;
        u.searchParams.set(k, String(v));
      });
    }

    return u.toString();
  }

  function ensureZonePointers() {
    setTextStorage(STORAGE.LAST_ZONE, DEFAULTS.zone);
    setTextStorage(STORAGE.NEXT_ZONE, DEFAULTS.nextZone);
    setTextStorage(STORAGE.RECOMMENDED_ZONE, DEFAULTS.nextZone);
  }

  function makeSnapshot(gameId, payload) {
    const canonical = canonicalGameId(gameId);
    const timeSec = numberOr(
      payload?.timeSec ?? payload?.time ?? qs('time', '90'),
      90
    );

    const mode =
      cleanText(payload?.mode, '') ||
      cleanText(payload?.run, '') ||
      cleanText(qs('mode', ''), '') ||
      cleanText(qs('run', ''), 'play');

    return {
      zone: DEFAULTS.zone,
      gameId: canonical,
      game: canonical,
      gameLabel: gameLabel(canonical),
      ts: Date.now(),
      tsIso: nowIso(),

      pid: cleanText(payload?.pid, cleanText(qs('pid', 'anon'), 'anon')),
      name: cleanText(
        payload?.name,
        cleanText(qs('name', qs('nickName', 'Player')), 'Player')
      ),
      studyId: cleanText(payload?.studyId, qs('studyId', '')),

      mode,
      run: cleanText(payload?.run, qs('run', 'play')),
      diff: cleanText(payload?.diff, qs('diff', 'normal')),
      time: String(timeSec),
      timeSec,
      view: cleanText(payload?.view, qs('view', 'mobile')),

      score: numberOr(payload?.scoreFinal ?? payload?.score ?? 0, 0),
      accPct: numberOr(payload?.accPct ?? payload?.rhythmAccuracy ?? 0, 0),
      rank: cleanText(payload?.rank, ''),
      result: cleanText(payload?.result, ''),
      href: cleanText(payload?.href, W.location.href),
      hub: cleanText(payload?.hub, buildHubUrl())
    };
  }

  function makeSummary(gameId, payload) {
    const canonical = canonicalGameId(gameId);
    const scoreFinal = numberOr(payload?.scoreFinal ?? payload?.score ?? 0, 0);
    const accPct = numberOr(payload?.accPct ?? payload?.rhythmAccuracy ?? 0, 0);
    const missTotal = numberOr(payload?.missTotal ?? payload?.miss ?? 0, 0);
    const timeSec = numberOr(payload?.timeSec ?? payload?.time ?? qs('time', '90'), 90);

    const summary = {
      game: canonical,
      gameId: canonical,
      zone: DEFAULTS.zone,
      theme: cleanText(payload?.theme, canonical),

      pid: cleanText(payload?.pid, cleanText(qs('pid', 'anon'), 'anon')),
      name: cleanText(payload?.name, cleanText(qs('name', qs('nickName', 'Player')), 'Player')),
      studyId: cleanText(payload?.studyId, qs('studyId', '')),

      run: cleanText(payload?.run, qs('run', 'play')),
      mode: cleanText(payload?.mode, qs('mode', qs('run', 'play'))),
      diff: cleanText(payload?.diff, qs('diff', 'normal')),
      view: cleanText(payload?.view, qs('view', 'mobile')),

      scoreFinal,
      score: scoreFinal,
      accPct,
      rank: cleanText(payload?.rank, ''),
      missTotal,
      miss: missTotal,
      comboMax: numberOr(payload?.maxCombo ?? payload?.comboMax ?? 0, 0),
      maxCombo: numberOr(payload?.maxCombo ?? payload?.comboMax ?? 0, 0),
      timeSec,

      result: cleanText(payload?.result, ''),
      href: cleanText(payload?.href, W.location.href),
      hub: cleanText(payload?.hub, buildHubUrl()),
      timestampIso: nowIso()
    };

    if (payload && payload.snapshotExtra && typeof payload.snapshotExtra === 'object') {
      Object.assign(summary, payload.snapshotExtra);
    }
    if (payload && payload.summaryExtra && typeof payload.summaryExtra === 'object') {
      Object.assign(summary, payload.summaryExtra);
    }

    return summary;
  }

  function saveFitnessSnapshot(gameId, payload) {
    const snap = makeSnapshot(gameId, payload || {});
    writeJson(STORAGE.FITNESS_LAST, snap);
    ensureZonePointers();
    return snap;
  }

  function saveLastSummary(gameId, payload) {
    const summary = makeSummary(gameId, payload || {});
    writeJson(STORAGE.LAST_SUMMARY, summary);
    return summary;
  }

  function patchAnchorHref(anchor, href) {
    if (!anchor) return;
    try {
      anchor.href = href;
    } catch (_) {}
  }

  function installBasicHooks(gameId, options) {
    const canonical = canonicalGameId(gameId);
    const opts = options || {};
    const fitnessHref = buildFitnessZoneUrl({
      focus: canonical,
      featured: canonical
    });

    const selectors = Array.isArray(opts.fitnessLinkSelectors)
      ? opts.fitnessLinkSelectors
      : [];

    selectors.forEach((selector) => {
      try {
        D.querySelectorAll(selector).forEach((el) => patchAnchorHref(el, fitnessHref));
      } catch (_) {}
    });

    return {
      fitnessHref,
      hubHref: buildHubUrl()
    };
  }

  function markOpen(gameId, payload) {
    const canonical = canonicalGameId(gameId);
    return saveFitnessSnapshot(canonical, payload || {});
  }

  function markStart(gameId, payload) {
    const canonical = canonicalGameId(gameId);
    const merged = Object.assign({}, payload || {}, {
      result: cleanText(payload?.result, 'playing')
    });
    return saveFitnessSnapshot(canonical, merged);
  }

  function markFinish(gameId, payload) {
    const canonical = canonicalGameId(gameId);
    const snap = saveFitnessSnapshot(canonical, payload || {});
    const summary = saveLastSummary(canonical, payload || {});
    return { snapshot: snap, summary: summary };
  }

  function getLastFitnessSnapshot() {
    const snap = readJson(STORAGE.FITNESS_LAST, null);
    if (!snap) return null;
    if (cleanText(snap.zone, '') !== DEFAULTS.zone) return null;
    snap.gameId = canonicalGameId(snap.gameId || snap.game);
    snap.game = snap.gameId;
    snap.gameLabel = gameLabel(snap.gameId);
    return snap;
  }

  function normalizeAliasesInStorage() {
    const snap = getLastFitnessSnapshot();
    if (snap) {
      writeJson(STORAGE.FITNESS_LAST, snap);
    }

    const summary = readJson(STORAGE.LAST_SUMMARY, null);
    if (summary && cleanText(summary.zone, '') === DEFAULTS.zone) {
      const canonical = canonicalGameId(summary.game || summary.gameId);
      summary.game = canonical;
      summary.gameId = canonical;
      writeJson(STORAGE.LAST_SUMMARY, summary);
    }
  }

  W.HHFitnessBridge = {
    version: '20260408-fitness-bridge-jumpduck-alias',
    STORAGE,
    canonicalGameId,
    gameLabel,
    buildHubUrl,
    buildFitnessZoneUrl,
    getLastFitnessSnapshot,
    installBasicHooks,
    markOpen,
    markStart,
    markFinish,
    normalizeAliasesInStorage
  };

  normalizeAliasesInStorage();
  ensureZonePointers();
})(window, document);