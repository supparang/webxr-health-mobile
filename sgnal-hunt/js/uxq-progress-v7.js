// === /sgnal-hunt/js/uxq-progress-v7.js ===
// UX Quest • Canonical Progress Bridge V7
// One source of truth for W1 → W2 unlock. No DOM observers, no recursive events.

(function () {
  'use strict';

  const KEY = 'uxquest-act1-progress-v7';
  const LEGACY_KEYS = [
    'uxquest-w1-progress-v6',
    'uxquest-w1-progress-v5',
    'uxquest-w1-case-investigation-v4',
    'uxquest-w1-unlock-gate-v5',
    'uxquest-w1-unlock-gate-v4',
    'uxquest-w1-unlock-gate-v3',
    'uxquest-w2-unlocked'
  ];

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fresh() {
    return {
      version: 7,
      updatedAt: null,
      w1: {
        cleared: false,
        stars: 0,
        score: 0,
        rounds: 0,
        tutorialComplete: false,
        source: 'fresh'
      }
    };
  }

  function normalizeW1(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return { cleared: false, stars: 0, score: 0, rounds: 0, tutorialComplete: false };
    }

    const nested = record.w1 && typeof record.w1 === 'object' ? record.w1 : {};
    const history = Array.isArray(record.roundHistory) ? record.roundHistory : [];
    const stars = clamp(Math.max(
      number(record.bestStars),
      number(record.tutorialBestStars),
      number(record.stars),
      number(nested.bestStars),
      number(nested.stars)
    ), 0, 3);

    const score = Math.max(
      number(record.bestScore),
      number(record.score),
      number(nested.bestScore),
      number(nested.score)
    );

    const rounds = Math.max(
      number(record.totalRounds),
      number(record.rounds),
      number(nested.totalRounds),
      number(nested.rounds),
      history.length
    );

    const historyClear = history.some((item) => {
      const itemStars = number(item && item.stars);
      const itemScore = number(item && item.score);
      return itemStars >= 1 || itemScore >= 200;
    });

    const cleared = Boolean(
      record.cleared ||
      record.unlocked ||
      record.tutorialComplete ||
      nested.cleared ||
      nested.unlocked ||
      nested.tutorialComplete ||
      stars >= 1 ||
      historyClear
    );

    return {
      cleared,
      stars: cleared ? Math.max(1, stars) : 0,
      score,
      rounds,
      tutorialComplete: Boolean(record.tutorialComplete || nested.tutorialComplete || cleared)
    };
  }

  function readRaw() {
    const saved = safeParse(localStorage.getItem(KEY), null);
    return saved && typeof saved === 'object'
      ? { ...fresh(), ...saved, w1: { ...fresh().w1, ...(saved.w1 || {}) } }
      : fresh();
  }

  function discoverLegacy() {
    const candidates = [];

    LEGACY_KEYS.forEach((legacyKey) => {
      candidates.push(normalizeW1(safeParse(localStorage.getItem(legacyKey), null)));
    });

    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const storageKey = localStorage.key(index);
        if (!storageKey || !/^uxquest-w1-/i.test(storageKey) || storageKey === KEY) {
          continue;
        }
        candidates.push(normalizeW1(safeParse(localStorage.getItem(storageKey), null)));
      }
    } catch (error) {
      // Storage restrictions should not block standalone gameplay.
    }

    return candidates.reduce((best, item) => ({
      cleared: best.cleared || item.cleared,
      stars: Math.max(best.stars, item.stars),
      score: Math.max(best.score, item.score),
      rounds: Math.max(best.rounds, item.rounds),
      tutorialComplete: best.tutorialComplete || item.tutorialComplete
    }), { cleared: false, stars: 0, score: 0, rounds: 0, tutorialComplete: false });
  }

  function save(data) {
    const next = {
      ...fresh(),
      ...data,
      w1: { ...fresh().w1, ...(data.w1 || {}) },
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('[UXQ V7] Could not save canonical progress.', error);
    }

    return next;
  }

  function migrate() {
    const current = readRaw();
    const currentW1 = normalizeW1(current.w1);

    if (currentW1.cleared) {
      return current;
    }

    const legacy = discoverLegacy();

    if (!legacy.cleared) {
      return current;
    }

    return save({
      ...current,
      w1: {
        ...current.w1,
        ...legacy,
        source: 'legacy-migration-v7'
      }
    });
  }

  function read() {
    return migrate();
  }

  function readW1() {
    return normalizeW1(read().w1);
  }

  function writeW1(patch) {
    const current = readRaw();
    const existing = normalizeW1(current.w1);
    const incoming = normalizeW1({ ...patch, w1: patch });

    const nextW1 = {
      cleared: existing.cleared || incoming.cleared,
      stars: clamp(Math.max(existing.stars, incoming.stars), 0, 3),
      score: Math.max(existing.score, incoming.score),
      rounds: Math.max(existing.rounds, incoming.rounds),
      tutorialComplete: existing.tutorialComplete || incoming.tutorialComplete || incoming.cleared,
      source: patch && patch.source ? patch.source : 'w1-v7'
    };

    if (nextW1.cleared && nextW1.stars < 1) {
      nextW1.stars = 1;
    }

    return save({ ...current, w1: nextW1 });
  }

  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (error) {
      console.warn('[UXQ V7] Could not clear canonical progress.', error);
    }
  }

  window.UXQProgressV7 = {
    KEY,
    read,
    readW1,
    writeW1,
    reset
  };

  migrate();
})();
