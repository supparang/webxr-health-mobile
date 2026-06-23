// === /sgnal-hunt/js/uxq-progress-v9.js ===
// UX Quest • Canonical Progress Bridge V9
// One source of truth for W1 → W2. Imports legacy records safely once.

(function () {
  'use strict';

  const KEY = 'csai2601-uxquest-act1-v9';
  const LEGACY_KEY_PATTERN = /(?:uxquest[-_](?:w1|act1|unlock)|uxq[-_].*w1|csai2601[-_]?uxquest[-_]?act1)/i;

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (error) { return fallback; }
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
      version: 9,
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

  function normalize(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return {
        cleared: false,
        stars: 0,
        score: 0,
        rounds: 0,
        tutorialComplete: false
      };
    }

    const nested = record.w1 && typeof record.w1 === 'object'
      ? record.w1
      : {};

    const histories = [
      record.roundHistory,
      nested.roundHistory,
      record.history,
      nested.history
    ]
      .filter(Array.isArray)
      .flat();

    const historyStars = histories.reduce(
      (max, item) => Math.max(max, number(item?.stars), number(item?.starCount)),
      0
    );

    const historyScore = histories.reduce(
      (max, item) => Math.max(max, number(item?.score), number(item?.finalScore)),
      0
    );

    const historyClear = histories.some(
      (item) =>
        Boolean(item?.cleared || item?.complete || item?.completed) ||
        number(item?.stars) >= 1 ||
        number(item?.score) >= 200
    );

    const stars = clamp(
      Math.max(
        number(record.stars),
        number(record.bestStars),
        number(record.tutorialBestStars),
        number(record.starCount),
        number(nested.stars),
        number(nested.bestStars),
        number(nested.tutorialBestStars),
        number(nested.starCount),
        historyStars
      ),
      0,
      3
    );

    const score = Math.max(
      number(record.score),
      number(record.bestScore),
      number(record.finalScore),
      number(nested.score),
      number(nested.bestScore),
      number(nested.finalScore),
      historyScore
    );

    const rounds = Math.max(
      number(record.rounds),
      number(record.totalRounds),
      number(record.completedRounds),
      number(nested.rounds),
      number(nested.totalRounds),
      histories.length
    );

    const directClear = Boolean(
      record.cleared ||
      record.unlocked ||
      record.complete ||
      record.completed ||
      record.tutorialComplete ||
      record.w2Unlocked ||
      nested.cleared ||
      nested.unlocked ||
      nested.complete ||
      nested.completed ||
      nested.tutorialComplete ||
      nested.w2Unlocked
    );

    const cleared = Boolean(
      directClear ||
      historyClear ||
      stars >= 1 ||
      score >= 200
    );

    return {
      cleared,
      stars: cleared ? Math.max(1, stars) : 0,
      score,
      rounds,
      tutorialComplete: Boolean(
        record.tutorialComplete ||
        nested.tutorialComplete ||
        cleared
      )
    };
  }

  function merge(a, b) {
    const cleared = Boolean(a.cleared || b.cleared);

    return {
      cleared,
      stars: cleared ? Math.max(1, number(a.stars), number(b.stars)) : 0,
      score: Math.max(number(a.score), number(b.score)),
      rounds: Math.max(number(a.rounds), number(b.rounds)),
      tutorialComplete: Boolean(
        a.tutorialComplete ||
        b.tutorialComplete ||
        cleared
      )
    };
  }

  function raw() {
    const saved = safeParse(localStorage.getItem(KEY), null);

    return saved && typeof saved === 'object'
      ? {
          ...fresh(),
          ...saved,
          w1: {
            ...fresh().w1,
            ...(saved.w1 || {})
          }
        }
      : fresh();
  }

  function scanLegacy() {
    let result = {
      cleared: false,
      stars: 0,
      score: 0,
      rounds: 0,
      tutorialComplete: false
    };

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const storageKey = localStorage.key(i);

        if (
          !storageKey ||
          storageKey === KEY ||
          !LEGACY_KEY_PATTERN.test(storageKey)
        ) {
          continue;
        }

        result = merge(
          result,
          normalize(
            safeParse(localStorage.getItem(storageKey), null)
          )
        );
      }
    } catch (error) {
      // Storage may be unavailable in restrictive contexts.
      // New state still works.
    }

    return result;
  }

  function save(data) {
    const next = {
      ...fresh(),
      ...data,
      w1: {
        ...fresh().w1,
        ...(data.w1 || {})
      },
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (error) {
      console.warn(
        '[UXQ V9] Could not save canonical progress.',
        error
      );
    }

    return next;
  }

  function read() {
    const current = raw();
    const currentW1 = normalize(current.w1);
    const migrated = scanLegacy();
    const merged = merge(currentW1, migrated);

    const differs =
      merged.cleared !== Boolean(current.w1.cleared) ||
      merged.stars !== number(current.w1.stars) ||
      merged.score !== number(current.w1.score) ||
      merged.rounds !== number(current.w1.rounds) ||
      merged.tutorialComplete !== Boolean(current.w1.tutorialComplete);

    if (differs) {
      return save({
        ...current,
        w1: {
          ...current.w1,
          ...merged,
          source: migrated.cleared
            ? 'legacy-import-v9'
            : (current.w1.source || 'v9')
        }
      });
    }

    return current;
  }

  function readW1() {
    return normalize(read().w1);
  }

  function writeW1(patch) {
    const current = raw();

    const next = merge(
      normalize(current.w1),
      normalize({
        ...patch,
        w1: patch || {}
      })
    );

    return save({
      ...current,
      w1: {
        ...current.w1,
        ...next,
        source: patch?.source || 'w1-v9'
      }
    });
  }

  function applyW1CompletionFromUrl() {
    const params = new URLSearchParams(window.location.search);

    if (params.get('from') !== 'w1') {
      return readW1();
    }

    const stars = clamp(number(params.get('stars')), 0, 3);
    const score = number(params.get('score'));

    if (stars >= 1 || score >= 200) {
      writeW1({
        cleared: true,
        tutorialComplete: true,
        stars: Math.max(1, stars),
        score,
        source: 'w1-completion-link-v9'
      });
    }

    return readW1();
  }

  function reset() {
    try {
      localStorage.removeItem(KEY);
    } catch (error) {
      console.warn(
        '[UXQ V9] Could not reset canonical progress.',
        error
      );
    }
  }

  window.UXQProgressV9 = {
    KEY,
    read,
    readW1,
    writeW1,
    applyW1CompletionFromUrl,
    reset
  };

  read();
})();
