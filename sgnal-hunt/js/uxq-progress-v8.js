// === /sgnal-hunt/js/uxq-progress-v8.js ===
// UX Quest • Canonical Progress Bridge V8
// One durable source of truth for W1 → W2.
// It imports earlier W1 records once, then every page reads the same state.

(function () {
  'use strict';

  const KEY = 'csai2601-uxquest-act1-v8';
  const LEGACY_KEY_PATTERN = /(?:uxquest-(?:w1|act1|unlock)|uxq-.*w1)/i;

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
      version: 8,
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

  function merge(base, incoming) {
    const cleared = Boolean(base.cleared || incoming.cleared);
    const stars = clamp(Math.max(number(base.stars), number(incoming.stars)), 0, 3);
    return {
      cleared,
      stars: cleared ? Math.max(1, stars) : stars,
      score: Math.max(number(base.score), number(incoming.score)),
      rounds: Math.max(number(base.rounds), number(incoming.rounds)),
      tutorialComplete: Boolean(base.tutorialComplete || incoming.tutorialComplete || cleared)
    };
  }

  function summarize(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return { cleared: false, stars: 0, score: 0, rounds: 0, tutorialComplete: false };
    }

    const nested = record.w1 && typeof record.w1 === 'object' ? record.w1 : {};
    const history = Array.isArray(record.roundHistory)
      ? record.roundHistory
      : Array.isArray(nested.roundHistory) ? nested.roundHistory : [];

    const historyStars = history.reduce((max, item) => Math.max(max, number(item && item.stars)), 0);
    const historyScore = history.reduce((max, item) => Math.max(max, number(item && item.score)), 0);
    const historyClear = history.some((item) => Boolean(item && (item.cleared || item.complete)) || number(item && item.stars) >= 1 || number(item && item.score) >= 200);

    const stars = clamp(Math.max(
      number(record.bestStars), number(record.tutorialBestStars), number(record.stars), number(record.starCount),
      number(nested.bestStars), number(nested.tutorialBestStars), number(nested.stars), number(nested.starCount),
      historyStars
    ), 0, 3);

    const score = Math.max(
      number(record.bestScore), number(record.score), number(record.finalScore),
      number(nested.bestScore), number(nested.score), number(nested.finalScore), historyScore
    );

    const rounds = Math.max(
      number(record.totalRounds), number(record.rounds), number(record.completedRounds),
      number(nested.totalRounds), number(nested.rounds), history.length
    );

    const explicitClear = Boolean(
      record.cleared || record.unlocked || record.tutorialComplete || record.completed || record.complete || record.w2Unlocked ||
      nested.cleared || nested.unlocked || nested.tutorialComplete || nested.completed || nested.complete || nested.w2Unlocked
    );

    const cleared = Boolean(explicitClear || historyClear || stars >= 1 || score >= 200);

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
    if (!saved || typeof saved !== 'object') return fresh();
    return { ...fresh(), ...saved, w1: { ...fresh().w1, ...(saved.w1 || {}) } };
  }

  function discoverLegacy() {
    let result = { cleared: false, stars: 0, score: 0, rounds: 0, tutorialComplete: false };
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const storageKey = localStorage.key(index);
        if (!storageKey || storageKey === KEY || !LEGACY_KEY_PATTERN.test(storageKey)) continue;
        result = merge(result, summarize(safeParse(localStorage.getItem(storageKey), null)));
      }
    } catch (error) {
      // Browser storage can be restricted; the local canonical state still works.
    }
    return result;
  }

  function save(data) {
    const next = {
      ...fresh(),
      ...data,
      w1: { ...fresh().w1, ...(data.w1 || {}) },
      updatedAt: new Date().toISOString()
    };
    try { localStorage.setItem(KEY, JSON.stringify(next)); }
    catch (error) { console.warn('[UXQ V8] Could not save progress.', error); }
    return next;
  }

  function read() {
    const current = readRaw();
    const currentW1 = summarize(current.w1);
    const legacyW1 = discoverLegacy();
    const merged = merge(currentW1, legacyW1);

    const differs = merged.cleared !== Boolean(current.w1.cleared) ||
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
          source: legacyW1.cleared ? 'legacy-import-v8' : (current.w1.source || 'v8')
        }
      });
    }
    return current;
  }

  function readW1() { return summarize(read().w1); }

  function writeW1(patch) {
    const current = readRaw();
    const merged = merge(summarize(current.w1), summarize({ ...patch, w1: patch || {} }));
    return save({
      ...current,
      w1: { ...current.w1, ...merged, source: patch && patch.source ? patch.source : 'w1-v8' }
    });
  }

  function reset() {
    try { localStorage.removeItem(KEY); }
    catch (error) { console.warn('[UXQ V8] Could not reset progress.', error); }
  }

  window.UXQProgressV8 = { KEY, read, readW1, writeW1, reset };
  read();
})();
