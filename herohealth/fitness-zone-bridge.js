(function (W) {
  'use strict';

  if (W.HHFitnessBridge) return;

  const FITNESS_LAST_KEY = 'HH_FITNESS_LAST_GAME_V1';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
  const NEXT_ZONE_KEY = 'HHA_NEXT_ZONE';
  const RECOMMENDED_ZONE_KEY = 'HHA_RECOMMENDED_ZONE';

  function qs(k, d = '') {
    try {
      const v = new URL(location.href).searchParams.get(k);
      return v == null || v === '' ? d : v;
    } catch (_) {
      return d;
    }
  }

  function safeJsonParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? safeJsonParse(raw, fallback) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function nowIso() {
    try {
      return new Date().toISOString();
    } catch (_) {
      return '';
    }
  }

  function normalizeFitnessGameId(gameId) {
    const raw = String(gameId || qs('gameId', qs('game', ''))).trim().toLowerCase();

    if (!raw) return '';
    if (raw === 'shadowbreaker') return 'shadow-breaker';
    if (raw === 'shadow_breaker') return 'shadow-breaker';
    if (raw === 'rhythmboxer') return 'rhythm-boxer';
    if (raw === 'rhythm_boxer') return 'rhythm-boxer';
    if (raw === 'jumpduck') return 'jump-duck';
    if (raw === 'jump_duck') return 'jump-duck';
    if (raw === 'balancehold') return 'balance-hold';
    if (raw === 'balance_hold') return 'balance-hold';
    if (raw === 'fitnessplanner') return 'fitness-planner';
    if (raw === 'fitness_planner') return 'fitness-planner';
    return raw;
  }

  function normalizeTitle(gameId) {
    const g = normalizeFitnessGameId(gameId);
    if (g === 'shadow-breaker') return 'Shadow Breaker';
    if (g === 'rhythm-boxer') return 'Rhythm Boxer';
    if (g === 'jump-duck') return 'Jump & Duck';
    if (g === 'balance-hold') return 'Balance Hold';
    if (g === 'fitness-planner') return 'Fitness Planner';
    return g || 'Fitness Game';
  }

  function currentMode() {
    return qs('mode', qs('run', 'play'));
  }

  function currentRun() {
    return qs('run', 'play');
  }

  function currentDiff() {
    return qs('diff', 'normal');
  }

  function currentTime() {
    return qs('time', '90');
  }

  function currentView() {
    return qs('view', 'mobile');
  }

  function currentPid() {
    return qs('pid', 'anon');
  }

  function currentName() {
    return qs('name', qs('nickName', 'Player'));
  }

  function currentStudyId() {
    return qs('studyId', '');
  }

  function currentSeed() {
    return qs('seed', '');
  }

  function currentHub() {
    return qs('hub', './fitness-zone.html');
  }

  function setZonePointers() {
    try { localStorage.setItem(LAST_ZONE_KEY, 'fitness'); } catch (_) {}
    try { localStorage.setItem(NEXT_ZONE_KEY, 'hygiene'); } catch (_) {}
    try { localStorage.setItem(RECOMMENDED_ZONE_KEY, 'fitness'); } catch (_) {}
  }

  function baseSnapshot(gameId, extra) {
    const gid = normalizeFitnessGameId(gameId);

    return {
      zone: 'fitness',
      gameId: gid,
      game: gid,
      title: normalizeTitle(gid),

      pid: currentPid(),
      name: currentName(),
      studyId: currentStudyId(),

      mode: currentMode(),
      run: currentRun(),
      diff: currentDiff(),
      time: currentTime(),
      view: currentView(),
      seed: currentSeed(),

      hub: currentHub(),
      href: location.href,
      path: location.pathname,

      ts: Date.now(),
      timestampIso: nowIso(),

      ...(extra || {})
    };
  }

  function saveSnapshot(gameId, extra = {}) {
    const payload = baseSnapshot(gameId, extra);
    saveJson(FITNESS_LAST_KEY, payload);
    setZonePointers();
    return payload;
  }

  function saveSummary(gameId, summary = {}) {
    const gid = normalizeFitnessGameId(gameId);

    const merged = {
      game: gid,
      gameId: gid,
      zone: 'fitness',
      title: normalizeTitle(gid),

      pid: currentPid(),
      name: currentName(),
      studyId: currentStudyId(),

      mode: currentMode(),
      run: currentRun(),
      diff: currentDiff(),
      timeSec: Number(summary.timeSec || currentTime() || 90),
      view: currentView(),
      seed: currentSeed(),

      timestampIso: nowIso(),

      ...summary
    };

    saveJson(LAST_SUMMARY_KEY, merged);
    return merged;
  }

  function saveAll(gameId, options = {}) {
    const gid = normalizeFitnessGameId(gameId);

    const snapshot = saveSnapshot(gid, options.snapshot || {});
    const summary = options.summary ? saveSummary(gid, options.summary) : null;

    return { snapshot, summary };
  }

  function markOpen(gameId, extra = {}) {
    return saveSnapshot(gameId, {
      event: 'open',
      result: 'idle',
      score: 0,
      combo: 0,
      bestStreak: 0,
      miss: 0,
      ...extra
    });
  }

  function markStart(gameId, extra = {}) {
    return saveSnapshot(gameId, {
      event: 'start',
      result: 'playing',
      ...extra
    });
  }

  function markFinish(gameId, result = {}) {
    const gid = normalizeFitnessGameId(gameId);

    const snapshot = saveSnapshot(gid, {
      event: 'finish',
      result: result.result || 'summary',
      score: Number(result.scoreFinal ?? result.score ?? 0),
      combo: Number(result.combo ?? result.maxCombo ?? 0),
      bestStreak: Number(result.bestStreak ?? result.maxCombo ?? result.combo ?? 0),
      miss: Number(result.miss ?? result.missTotal ?? 0),
      rank: result.rank || '',
      accPct: Number(result.accPct ?? result.accuracy ?? 0),
      stars: Number(result.stars ?? 0),
      ...result.snapshotExtra
    });

    const summary = saveSummary(gid, {
      score: Number(result.scoreFinal ?? result.score ?? 0),
      scoreFinal: Number(result.scoreFinal ?? result.score ?? 0),
      combo: Number(result.combo ?? result.maxCombo ?? 0),
      maxCombo: Number(result.maxCombo ?? result.combo ?? 0),
      bestStreak: Number(result.bestStreak ?? result.maxCombo ?? result.combo ?? 0),
      miss: Number(result.miss ?? result.missTotal ?? 0),
      missTotal: Number(result.missTotal ?? result.miss ?? 0),
      accPct: Number(result.accPct ?? result.accuracy ?? 0),
      accuracy: Number(result.accuracy ?? result.accPct ?? 0),
      stability: Number(result.stability ?? result.stabilityMin ?? 0),
      stabilityMin: Number(result.stabilityMin ?? result.stability ?? 0),
      rhythmAccuracy: Number(result.rhythmAccuracy ?? 0),
      landingControl: Number(result.landingControl ?? 0),
      postsCleared: Number(result.postsCleared ?? 0),
      jumpSuccess: Number(result.jumpSuccess ?? 0),
      stars: Number(result.stars ?? 0),
      rank: result.rank || '',
      result: result.result || 'summary',
      rewardLabel: result.rewardLabel || '',
      bossLabel: result.bossLabel || '',
      bossVariant: result.bossVariant || '',
      timeSec: Number(result.timeSec || currentTime() || 90),
      ...result.summaryExtra
    });

    return { snapshot, summary };
  }

  function patchBackLinks(selectorList, href) {
    const list = Array.isArray(selectorList) ? selectorList : [selectorList];
    list.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (el && 'href' in el) el.href = href;
        });
      } catch (_) {}
    });
  }

  function buildFitnessZoneUrl() {
    try {
      const u = new URL('./fitness-zone.html', location.href);

      [
        'pid', 'name', 'nick', 'studyId', 'view', 'debug', 'api', 'log',
        'studentKey', 'schoolCode', 'classRoom', 'studentNo', 'nickName'
      ].forEach((k) => {
        const v = qs(k, '');
        if (v) u.searchParams.set(k, v);
      });

      u.searchParams.set('zone', 'fitness');
      u.searchParams.set('featured', normalizeFitnessGameId(qs('gameId', qs('game', ''))));
      u.searchParams.set('focus', normalizeFitnessGameId(qs('gameId', qs('game', ''))));
      u.searchParams.set('mode', currentMode());
      u.searchParams.set('time', currentTime());
      u.searchParams.set('run', currentRun());
      u.searchParams.set('hub', currentHub());

      return u.toString();
    } catch (_) {
      return './fitness-zone.html';
    }
  }

  function installBasicHooks(gameId, opts = {}) {
    const gid = normalizeFitnessGameId(gameId);
    if (!gid) return null;

    markOpen(gid, opts.openExtra || {});

    const startSelectors = opts.startSelectors || [
      '[data-action="start"]',
      '#btnStart',
      '#btn-start',
      '.btn-start'
    ];

    const finishSelectors = opts.finishSelectors || [
      '[data-action="back-menu"]',
      '#btnSummary',
      '#btn-summary'
    ];

    startSelectors.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (el.__hhFitnessBoundStart) return;
          el.__hhFitnessBoundStart = true;
          el.addEventListener('click', function () {
            markStart(gid, opts.startExtra || {});
          });
        });
      } catch (_) {}
    });

    finishSelectors.forEach((sel) => {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (el.__hhFitnessBoundFinish) return;
          el.__hhFitnessBoundFinish = true;
          el.addEventListener('click', function () {
            saveSnapshot(gid, {
              event: 'ui-finish',
              result: 'summary'
            });
          });
        });
      } catch (_) {}
    });

    if (opts.patchFitnessLinks !== false) {
      const fitnessUrl = buildFitnessZoneUrl();
      patchBackLinks(
        opts.fitnessLinkSelectors || ['a[href*="fitness-zone.html"]', '#btnBackFitness', '#jd-back-hub-result'],
        fitnessUrl
      );
    }

    return {
      gameId: gid,
      fitnessUrl: buildFitnessZoneUrl()
    };
  }

  W.HHFitnessBridge = {
    keys: {
      FITNESS_LAST_KEY,
      LAST_SUMMARY_KEY,
      LAST_ZONE_KEY,
      NEXT_ZONE_KEY,
      RECOMMENDED_ZONE_KEY
    },
    normalizeFitnessGameId,
    normalizeTitle,
    readJson,
    saveJson,
    currentPid,
    currentName,
    currentMode,
    currentRun,
    currentDiff,
    currentTime,
    currentView,
    currentSeed,
    currentHub,
    buildFitnessZoneUrl,
    setZonePointers,
    saveSnapshot,
    saveSummary,
    saveAll,
    markOpen,
    markStart,
    markFinish,
    patchBackLinks,
    installBasicHooks
  };
})(window);