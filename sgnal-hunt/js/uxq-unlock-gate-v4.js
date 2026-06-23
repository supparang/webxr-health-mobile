// === /sgnal-hunt/js/uxq-unlock-gate-v4.js ===
// UX Quest • Direct W1 → W2 unlock gate
// Purpose: make W2 unlock immediately after W1 reaches >= 1 star,
// even when earlier prototype versions saved progress under different keys.

(function () {
  'use strict';

  const CANONICAL_W1_KEY = 'uxquest-w1-progress-v6';
  const UNLOCK_KEY = 'uxquest-w2-unlocked-v4';
  const LEGACY_BRIDGE_KEY = 'uxquest-act1-unlock-v1';
  const COOKIE_NAME = 'uxquest_w2_unlock_v4';

  function safeParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
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

  function scoreFromText(text) {
    const match = String(text || '')
      .replace(/,/g, '')
      .match(/Final\s*Score\s*(\d+)/i);

    return match ? number(match[1]) : 0;
  }

  function recordSummary(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { cleared: false, stars: 0, score: 0, rounds: 0 };
    }

    const nested = value.w1 && typeof value.w1 === 'object' ? value.w1 : {};
    const history = Array.isArray(value.roundHistory) ? value.roundHistory : [];

    const stars = clamp(Math.max(
      number(value.bestStars),
      number(value.tutorialBestStars),
      number(value.stars),
      number(nested.stars)
    ), 0, 3);

    const score = Math.max(
      number(value.bestScore),
      number(value.score),
      number(nested.score)
    );

    const rounds = Math.max(
      number(value.totalRounds),
      number(value.rounds),
      number(nested.rounds),
      history.length
    );

    const historyClear = history.some((round) => {
      const roundStars = number(round && round.stars);
      const roundScore = number(round && round.score);
      return roundStars >= 1 || (round && round.mode === 'tutorial' && roundScore >= 200);
    });

    const cleared = Boolean(
      value.tutorialComplete ||
      value.cleared ||
      nested.cleared ||
      stars >= 1 ||
      historyClear ||
      (value.complete === true && score >= 200)
    );

    return { cleared, stars, score, rounds };
  }

  function domSummary() {
    const completeCard = document.querySelector('.complete-card');
    if (!completeCard) {
      return { cleared: false, stars: 0, score: 0, rounds: 0 };
    }

    const stars = completeCard.querySelectorAll('.final-star.earned').length;
    const score = scoreFromText(completeCard.textContent || '');

    return {
      cleared: stars >= 1 || score >= 200,
      stars: clamp(stars, 0, 3),
      score,
      rounds: 1
    };
  }

  function cookieSummary() {
    try {
      const prefix = `${COOKIE_NAME}=`;
      const token = document.cookie
        .split(';')
        .map((item) => item.trim())
        .find((item) => item.startsWith(prefix));

      return token
        ? recordSummary(safeParse(decodeURIComponent(token.slice(prefix.length)), null))
        : { cleared: false, stars: 0, score: 0, rounds: 0 };
    } catch (error) {
      return { cleared: false, stars: 0, score: 0, rounds: 0 };
    }
  }

  function discoverW1() {
    const summaries = [];

    storageKeys()
      .filter((key) => /^uxquest-w1-/i.test(key))
      .forEach((key) => summaries.push(recordSummary(safeParse(localStorage.getItem(key), null))));

    summaries.push(recordSummary(safeParse(localStorage.getItem(UNLOCK_KEY), null)));
    summaries.push(recordSummary(safeParse(localStorage.getItem(LEGACY_BRIDGE_KEY), null)));
    summaries.push(cookieSummary());
    summaries.push(domSummary());

    const cleared = summaries.some((item) => item.cleared);
    const stars = clamp(Math.max(0, ...summaries.map((item) => item.stars), cleared ? 1 : 0), 0, 3);
    const score = Math.max(0, ...summaries.map((item) => item.score));
    const rounds = Math.max(0, ...summaries.map((item) => item.rounds));

    return { cleared, stars, score, rounds };
  }

  function persist(summary) {
    if (!summary.cleared) return summary;

    const now = new Date().toISOString();
    const payload = {
      unlocked: true,
      w1: {
        cleared: true,
        stars: Math.max(1, summary.stars),
        score: summary.score,
        rounds: Math.max(1, summary.rounds)
      },
      updatedAt: now,
      source: 'direct-unlock-gate-v4'
    };

    try {
      const current = safeParse(localStorage.getItem(CANONICAL_W1_KEY), {}) || {};
      const bestStars = Math.max(number(current.bestStars), number(current.tutorialBestStars), payload.w1.stars);
      const bestScore = Math.max(number(current.bestScore), payload.w1.score);
      const totalRounds = Math.max(number(current.totalRounds), payload.w1.rounds);

      localStorage.setItem(CANONICAL_W1_KEY, JSON.stringify({
        ...current,
        version: 6,
        tutorialComplete: true,
        tutorialBestStars: bestStars,
        bestStars,
        bestScore,
        totalRounds,
        lastUpdated: now,
        unlockGate: 'v4'
      }));

      localStorage.setItem(UNLOCK_KEY, JSON.stringify(payload));
      localStorage.setItem(LEGACY_BRIDGE_KEY, JSON.stringify({ version: 1, updatedAt: now, w1: payload.w1 }));
    } catch (error) {
      // LocalStorage may be unavailable in privacy-restricted browsers.
    }

    try {
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`;
    } catch (error) {
      // Cookie is only a secondary fallback.
    }

    try {
      window.dispatchEvent(new CustomEvent('uxquest:w1-unlocked', { detail: payload.w1 }));
    } catch (error) {
      // Optional notification only.
    }

    return payload.w1;
  }

  function sync() {
    return persist(discoverW1());
  }

  window.UXQDirectUnlockGate = { sync, discoverW1 };

  sync();

  // On W1, the completion card is rendered after the game engine loads.
  // Observe it and write the unlock immediately without replaying the mission.
  if (document.documentElement && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => sync());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.addEventListener('pageshow', sync);
  window.addEventListener('focus', sync);
  window.setTimeout(sync, 250);
  window.setTimeout(sync, 1000);
})();
