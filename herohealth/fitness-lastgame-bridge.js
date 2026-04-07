(function () {
  'use strict';

  const STORAGE_KEY = 'HH_FITNESS_LAST_GAME_V1';
  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';

  function safeParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function qsGet(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (_) {
      return d;
    }
  }

  function normalizeGameId(v) {
    const s = String(v || '').trim().toLowerCase();

    if (!s) return '';
    if (s === 'shadowbreaker' || s === 'shadow-breaker') return 'shadow-breaker';
    if (s === 'rhythmboxer' || s === 'rhythm-boxer') return 'rhythm-boxer';
    if (s === 'jumpduck' || s === 'jump-duck') return 'jump-duck';
    if (s === 'balancehold' || s === 'balance-hold') return 'balance-hold';
    if (s === 'fitnessplanner' || s === 'fitness-planner' || s === 'fitnessplanner_weekly') return 'fitness-planner';

    return s;
  }

  function inferGameId() {
    const fromQs = normalizeGameId(qsGet('gameId') || qsGet('game'));
    if (fromQs) return fromQs;

    const bodyGame = normalizeGameId(document.body?.dataset?.gameId || '');
    if (bodyGame) return bodyGame;

    const htmlGame = normalizeGameId(document.documentElement?.dataset?.gameId || '');
    if (htmlGame) return htmlGame;

    const path = String(location.pathname || '').toLowerCase();

    if (path.includes('shadow-breaker')) return 'shadow-breaker';
    if (path.includes('rhythm-boxer')) return 'rhythm-boxer';
    if (path.includes('jump-duck')) return 'jump-duck';
    if (path.includes('balance-hold')) return 'balance-hold';
    if (path.includes('fitness-planner')) return 'fitness-planner';

    return '';
  }

  function buildSnapshot(extra = {}) {
    const gameId = inferGameId();
    if (!gameId) return null;

    return {
      zone: 'fitness',
      gameId,
      ts: Date.now(),
      mode: qsGet('mode', qsGet('run', 'play')),
      run: qsGet('run', 'play'),
      diff: qsGet('diff', 'normal'),
      view: qsGet('view', 'mobile'),
      time: qsGet('time', '90'),
      pid: qsGet('pid', 'anon'),
      name: qsGet('name', qsGet('nickName', 'Hero')),
      studyId: qsGet('studyId', ''),
      path: location.pathname,
      href: location.href,
      ...extra
    };
  }

  function writeSnapshot(extra = {}) {
    const snapshot = buildSnapshot(extra);
    if (!snapshot) return null;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      localStorage.setItem(LAST_ZONE_KEY, 'fitness');
    } catch (_) {}

    return snapshot;
  }

  function readSnapshot() {
    try {
      return safeParse(localStorage.getItem(STORAGE_KEY), null);
    } catch (_) {
      return null;
    }
  }

  function bindHubishLinks() {
    const selectors = [
      'a[href*="hub-v2.html"]',
      'a[href*="fitness-zone.html"]',
      'button[data-back-hub]',
      'button[data-back-zone]'
    ];

    document.querySelectorAll(selectors.join(',')).forEach((el) => {
      if (el.__fitnessBridgeBound) return;
      el.__fitnessBridgeBound = true;

      el.addEventListener('click', function () {
        writeSnapshot({ event: 'nav_click' });
      });
    });
  }

  function boot() {
    writeSnapshot({ event: 'boot' });
    bindHubishLinks();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('focus', function () {
    writeSnapshot({ event: 'focus' });
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      writeSnapshot({ event: 'visible' });
    }
  });

  window.addEventListener('pagehide', function () {
    writeSnapshot({ event: 'pagehide' });
  });

  window.HH_FITNESS_LASTGAME = {
    STORAGE_KEY,
    readSnapshot,
    writeSnapshot,
    inferGameId
  };
})();