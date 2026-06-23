// === /sgnal-hunt/js/uxq-unlock-gate-v5.js ===
// UX Quest • Canonical W1 → W2 unlock gate
// V5 fixes the Hub crash caused by a re-entrant unlock event loop.
// This file never dispatches a custom unlock event. Pages simply read the same canonical state.

(function () {
  'use strict';

  const CANONICAL_W1_KEY = 'uxquest-w1-progress-v6';
  const GATE_KEY = 'uxquest-w1-unlock-gate-v5';
  const W1_KEY_PATTERN = /^(?:uxquest-w1-|uxquest-act1-unlock|uxquest-w2-unlocked)/i;

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

  function getStorageKeys() {
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

  function scoreFromText(text) {
    const match = String(text || '')
      .replace(/,/g, '')
      .match(/Final\s*Score\s*(\d+)/i);

    return match ? number(match[1]) : 0;
  }

  function summarizeRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return { cleared: false, stars: 0, score: 0, rounds: 0 };
    }

    const w1 = record.w1 && typeof record.w1 === 'object' ? record.w1 : {};
    const history = Array.isArray(record.roundHistory) ? record.roundHistory : [];

    const stars = clamp(Math.max(
      number(record.bestStars),
      number(record.tutorialBestStars),
      number(record.stars),
      number(w1.stars)
    ), 0, 3);

    const score = Math.max(
      number(record.bestScore),
      number(record.score),
      number(w1.score)
    );

    const rounds = Math.max(
      number(record.totalRounds),
      number(record.rounds),
      number(w1.rounds),
      history.length
    );

    const historyClear = history.some((round) => {
      const starsFromRound = number(round && round.stars);
      const scoreFromRound = number(round && round.score);
      return starsFromRound >= 1 || (round && round.mode === 'tutorial' && scoreFromRound >= 200);
    });

    const cleared = Boolean(
      record.tutorialComplete ||
      record.cleared ||
      record.unlocked ||
      w1.cleared ||
      stars >= 1 ||
      historyClear ||
      (record.complete === true && score >= 200)
    );

    return { cleared, stars, score, rounds };
  }

  function summarizeCompletionDom() {
    const card = document.querySelector('.complete-card');
    if (!card) return { cleared: false, stars: 0, score: 0, rounds: 0 };

    const stars = card.querySelectorAll('.final-star.earned').length;
    const score = scoreFromText(card.textContent || '');

    return {
      cleared: stars >= 1 || score >= 200,
      stars: clamp(stars, 0, 3),
      score,
      rounds: 1
    };
  }

  function discover() {
    const candidates = [];

    getStorageKeys()
      .filter((key) => W1_KEY_PATTERN.test(key))
      .forEach((key) => {
        candidates.push(summarizeRecord(safeParse(localStorage.getItem(key), null)));
      });

    candidates.push(summarizeRecord(safeParse(localStorage.getItem(GATE_KEY), null)));
    candidates.push(summarizeCompletionDom());

    const cleared = candidates.some((item) => item.cleared);
    const stars = clamp(Math.max(0, ...candidates.map((item) => item.stars), cleared ? 1 : 0), 0, 3);
    const score = Math.max(0, ...candidates.map((item) => item.score));
    const rounds = Math.max(0, ...candidates.map((item) => item.rounds));

    return { cleared, stars, score, rounds };
  }

  function persistIfNeeded(summary) {
    if (!summary.cleared) return summary;

    try {
      const existing = safeParse(localStorage.getItem(CANONICAL_W1_KEY), {}) || {};
      const current = summarizeRecord(existing);
      const next = {
        cleared: true,
        stars: Math.max(1, summary.stars),
        score: Math.max(summary.score, current.score),
        rounds: Math.max(1, summary.rounds, current.rounds)
      };

      const alreadyCurrent = current.cleared &&
        current.stars >= next.stars &&
        current.score >= next.score &&
        current.rounds >= next.rounds;

      if (!alreadyCurrent) {
        const updatedAt = new Date().toISOString();
        localStorage.setItem(CANONICAL_W1_KEY, JSON.stringify({
          ...existing,
          version: 6,
          tutorialComplete: true,
          tutorialBestStars: Math.max(number(existing.tutorialBestStars), next.stars),
          bestStars: Math.max(number(existing.bestStars), next.stars),
          bestScore: Math.max(number(existing.bestScore), next.score),
          totalRounds: Math.max(number(existing.totalRounds), next.rounds),
          unlockGate: 'v5',
          lastUpdated: updatedAt
        }));

        localStorage.setItem(GATE_KEY, JSON.stringify({
          version: 5,
          unlocked: true,
          w1: next,
          updatedAt,
          source: 'canonical-unlock-gate-v5'
        }));
      }
    } catch (error) {
      // The game remains usable on pages where browser storage is restricted.
    }

    return summary;
  }

  function sync() {
    return persistIfNeeded(discover());
  }

  function readW1() {
    const canonical = summarizeRecord(
      safeParse(localStorage.getItem(CANONICAL_W1_KEY), null)
    );

    return canonical.cleared ? canonical : discover();
  }

  function clear() {
    try {
      localStorage.removeItem(GATE_KEY);
    } catch (error) {
      // Reset orchestration is handled by the Hub.
    }
  }

  window.UXQUnlockGateV5 = {
    sync,
    readW1,
    clear
  };

  sync();

  // W1 renders its completion card dynamically. Sync once when it appears.
  if (document.documentElement && typeof MutationObserver !== 'undefined') {
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      window.setTimeout(() => {
        pending = false;
        sync();
      }, 0);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.addEventListener('pageshow', sync);
  window.addEventListener('focus', sync);
})();
