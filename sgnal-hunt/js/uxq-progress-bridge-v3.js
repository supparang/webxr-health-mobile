// === /sgnal-hunt/js/uxq-progress-bridge-v3.js ===
// UX Quest • Canonical W1 unlock bridge
// Reads legacy/current W1 records, writes a single unlock source, and mirrors it in a cookie.

(function () {
  'use strict';

  const BRIDGE_KEY = 'uxquest-unlock-bridge-v3';
  const LEGACY_BRIDGE_KEY = 'uxquest-act1-unlock-v1';
  const CANONICAL_W1_KEY = 'uxquest-w1-progress-v6';
  const COOKIE_NAME = 'uxquest_w1_unlock_v3';
  const DAY_SECONDS = 60 * 60 * 24 * 180;

  const W1_KEY_PATTERN = /^uxquest-w1-(?:progress|session|case-investigation)(?:-|$)/i;

  function safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function number(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readCookie() {
    try {
      const prefix = `${COOKIE_NAME}=`;
      const row = document.cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(prefix));

      return row ? safeParse(decodeURIComponent(row.slice(prefix.length)), null) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCookie(value) {
    try {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${DAY_SECONDS}; Path=/; SameSite=Lax`;
    } catch (error) {
      // Cookies are a fallback only; local storage remains the primary path.
    }
  }

  function storageKeys() {
    try {
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) keys.push(key);
      }
      return keys;
    } catch (error) {
      return [];
    }
  }

  function storageRecords() {
    const fixed = [
      'uxquest-w1-progress-v6',
      'uxquest-w1-progress-v5',
      'uxquest-w1-progress-v4',
      'uxquest-w1-progress',
      'uxquest-w1-session-v6',
      'uxquest-w1-session-v5',
      'uxquest-w1-session-v4',
      'uxquest-w1-case-investigation-v4'
    ];

    const keys = [...new Set([...fixed, ...storageKeys().filter((key) => W1_KEY_PATTERN.test(key))])];

    return keys
      .map((key) => ({ key, value: safeParse(localStorage.getItem(key), null) }))
      .filter((item) => item.value && typeof item.value === 'object' && !Array.isArray(item.value));
  }

  function completionFromRecord(record) {
    const value = record && record.value ? record.value : {};
    const bestStars = Math.max(number(value.bestStars), number(value.tutorialBestStars));
    const history = Array.isArray(value.roundHistory) ? value.roundHistory : [];
    const historyClear = history.some((round) => number(round && round.stars) >= 1 || (round && round.mode === 'tutorial' && number(round.score) >= 200));
    const sessionClear = value.complete === true && (number(value.score) >= 200 || bestStars >= 1);

    return {
      cleared: bestStars >= 1 || Boolean(value.tutorialComplete) || historyClear || sessionClear,
      stars: clamp(bestStars, 0, 3),
      score: Math.max(number(value.bestScore), number(value.score)),
      rounds: Math.max(number(value.totalRounds), history.length)
    };
  }

  function readW1() {
    const results = [];

    storageRecords().forEach((record) => results.push(completionFromRecord(record)));

    const v3 = safeParse(localStorage.getItem(BRIDGE_KEY), null);
    const v1 = safeParse(localStorage.getItem(LEGACY_BRIDGE_KEY), null);
    const cookie = readCookie();

    [v3 && v3.w1, v1 && v1.w1, cookie && cookie.w1].forEach((source) => {
      if (source && typeof source === 'object') {
        results.push({
          cleared: Boolean(source.cleared),
          stars: clamp(number(source.stars), 0, 3),
          score: number(source.score),
          rounds: number(source.rounds)
        });
      }
    });

    const cleared = results.some((item) => item.cleared);
    const stars = clamp(Math.max(0, ...results.map((item) => item.stars), cleared ? 1 : 0), 0, 3);
    const score = Math.max(0, ...results.map((item) => item.score));
    const rounds = Math.max(0, ...results.map((item) => item.rounds));

    return { cleared, stars, score, rounds };
  }

  function writeW1(input) {
    const current = readW1();
    const w1 = {
      cleared: Boolean(input && input.cleared) || current.cleared,
      stars: clamp(Math.max(current.stars, number(input && input.stars), 1), 0, 3),
      score: Math.max(current.score, number(input && input.score)),
      rounds: Math.max(current.rounds, number(input && input.rounds)),
      updatedAt: new Date().toISOString(),
      source: (input && input.source) || 'progress-bridge-v3'
    };

    const payload = { version: 3, updatedAt: w1.updatedAt, w1 };

    try {
      localStorage.setItem(BRIDGE_KEY, JSON.stringify(payload));
      localStorage.setItem(LEGACY_BRIDGE_KEY, JSON.stringify({ version: 1, updatedAt: w1.updatedAt, w1 }));

      const existing = safeParse(localStorage.getItem(CANONICAL_W1_KEY), {}) || {};
      localStorage.setItem(CANONICAL_W1_KEY, JSON.stringify({
        ...existing,
        version: 6,
        tutorialComplete: true,
        tutorialBestStars: Math.max(number(existing.tutorialBestStars), w1.stars),
        bestStars: Math.max(number(existing.bestStars), w1.stars),
        bestScore: Math.max(number(existing.bestScore), w1.score),
        totalRounds: Math.max(number(existing.totalRounds), w1.rounds),
        unlockBridge: 'v3',
        lastUpdated: w1.updatedAt
      }));
    } catch (error) {
      // Cookie remains available when browser storage is unavailable.
    }

    writeCookie(payload);

    try {
      window.dispatchEvent(new CustomEvent('uxquest:w1-unlocked', { detail: w1 }));
    } catch (error) {
      // Optional browser event only.
    }

    return w1;
  }

  function syncW1() {
    const w1 = readW1();
    return w1.cleared ? writeW1({ ...w1, source: 'sync-v3' }) : w1;
  }

  window.UXQProgressBridge = {
    readW1,
    syncW1,
    markW1Complete(detail) {
      return writeW1({
        cleared: true,
        stars: number(detail && detail.stars),
        score: number(detail && detail.score),
        rounds: number(detail && detail.rounds),
        source: 'w1-complete-event-v3'
      });
    }
  };

  window.addEventListener('uxquest:w1-complete', (event) => {
    window.UXQProgressBridge.markW1Complete(event.detail || {});
  });

  syncW1();
})();
