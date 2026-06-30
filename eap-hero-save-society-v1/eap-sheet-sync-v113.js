/* =========================================================
   EAP Hero v113 • Portfolio-to-Sheet Sync
   - Reads portfolio only; never reads result-page text
   - Sends real Accuracy only when portfolio actually contains it
   - Does not convert missing Accuracy into 0%
========================================================= */
(function () {
  'use strict';

  const CONFIG = window.EAP_SHEET_CONFIG || {};
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const SENT_KEY = 'EAP_HERO_SHEET_SENT_V113';

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || '');
    } catch (_) {
      return fallback;
    }
  }

  function asText(value) {
    return value === undefined || value === null
      ? ''
      : String(value);
  }

  function asNumber(value, fallback) {
    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : (fallback === undefined ? 0 : fallback);
  }

  function hasNumber(value) {
    if (value === undefined || value === null || value === '') {
      return false;
    }

    const n = Number(value);

    return Number.isFinite(n) && n >= 0;
  }

  function getRealAccuracy(entry) {
    const directCandidates = [
      entry.accuracy,
      entry.bestAccuracy,
      entry.accPct,
      entry.accuracyPct
    ];

    for (const value of directCandidates) {
      if (hasNumber(value)) {
        return Math.max(0, Math.min(100, asNumber(value)));
      }
    }

    const correct = entry.correct ?? entry.correctCount;
    const total = entry.total ?? entry.questionCount ?? entry.questions;

    if (
      hasNumber(correct) &&
      hasNumber(total) &&
      asNumber(total) > 0
    ) {
      return Math.round(
        (asNumber(correct) / asNumber(total)) * 100
      );
    }

    return null;
  }

  function getProfile(state) {
    const profile = state.profile || state.player || {};

    return {
      studentId: asText(
        profile.studentId ||
        profile.id ||
        state.studentId ||
        'guest'
      ),

      studentName: asText(
        profile.studentName ||
        profile.name ||
        state.studentName ||
        'Guest'
      ),

      section: asText(
        profile.section ||
        state.section ||
        CONFIG.section ||
        '122'
      )
    };
  }

  function requestUrl(payload) {
    const url = new URL(CONFIG.webAppUrl);

    Object.keys(payload).forEach(function(key) {
      url.searchParams.set(key, asText(payload[key]));
    });

    url.searchParams.set('_cache', String(Date.now()));

    return url.toString();
  }

  function send(payload) {
    const image = document.createElement('img');

    image.width = 1;
    image.height = 1;

    image.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;' +
      'opacity:0;pointer-events:none';

    image.onload = image.onerror = function() {
      setTimeout(function() {
        image.remove();
      }, 100);
    };

    image.src = requestUrl(payload);
    document.body.appendChild(image);
  }

  function sync() {
    if (!CONFIG.enabled || !CONFIG.webAppUrl) {
      return;
    }

    const state = readJson(STATE_KEY, null);

    if (!state || !Array.isArray(state.portfolio)) {
      return;
    }

    const profile = getProfile(state);
    const sent = readJson(SENT_KEY, {});

    state.portfolio.forEach(function(entry, index) {
      const sessionId = asText(
        entry.session || entry.sessionId
      );

      const skill = asText(entry.skill);

      if (!sessionId || !skill) {
        return;
      }

      const score = asNumber(
        entry.latestScore !== undefined
          ? entry.latestScore
          : entry.score
      );

      const accuracy = getRealAccuracy(entry);

      const stamp = asText(
        entry.latestAt ||
        entry.at ||
        entry.evidenceId ||
        index
      );

      const attemptId =
        'eap-' +
        profile.studentId +
        '-s' +
        sessionId +
        '-' +
        skill.toLowerCase() +
        '-' +
        stamp.replace(/[^A-Za-z0-9_-]/g, '');

      if (sent[attemptId]) {
        return;
      }

      const legacy =
        entry.legacyCompletion === true ||
        String(entry.legacyCompletion).toLowerCase() === 'true';

      const payload = {
        action: 'submit_attempt',

        attemptId: attemptId,
        studentId: profile.studentId,
        studentName: profile.studentName,
        section: profile.section,

        sessionId: sessionId,

        sessionTitle: asText(
          entry.sessionTitle ||
          (
            state.sessions &&
            state.sessions[sessionId] &&
            state.sessions[sessionId].title
          )
        ),

        skill: skill,

        score: score,

        /* Blank means the game did not provide Accuracy. */
        accuracy: accuracy === null ? '' : accuracy,

        passMark: 60,
        passed: legacy || score >= 60,
        legacyCompletion: legacy,

        hintUsed: asNumber(
          entry.aiUses || entry.hintUsed
        ),

        replay: entry.replay === true,
        clientTimestamp: stamp,
        sourceUrl: location.href
      };

      send(payload);
      sent[attemptId] = Date.now();
    });

    localStorage.setItem(
      SENT_KEY,
      JSON.stringify(sent)
    );
  }

  window.EAPSheetSyncV113 = {
    sync: sync
  };

  window.addEventListener('load', function() {
    setTimeout(sync, 700);
  });

  setInterval(sync, 1800);
})();
