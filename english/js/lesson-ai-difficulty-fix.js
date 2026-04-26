// === /english/js/lesson-ai-difficulty-fix.js ===
// PATCH v20260426a-LESSON-AI-DIFFICULTY-AUTO
// ✅ AI chooses difficulty automatically
// ✅ easy=A2 / normal=A2+ / hard=B1 / challenge=B1+
// ✅ promotes/demotes from performance
// ✅ supports old "expert" alias -> challenge
// ✅ patches LESSON_ROUTER when available
// ✅ updates URL diff before lesson-main can pick item
// ✅ records profile per session

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-AI-DIFFICULTY-AUTO';
  const STORAGE_KEY = 'ENGLISH_QUEST_AI_DIFFICULTY_PROFILE_V2';

  const ORDER = ['easy', 'normal', 'hard', 'challenge'];

  const META = {
    easy: {
      key: 'easy',
      cefr: 'A2',
      label: 'Easy',
      passScore: 65,
      minScoreToStay: 55,
      promoteAvg: 82,
      promoteStreak: 2
    },
    normal: {
      key: 'normal',
      cefr: 'A2+',
      label: 'Normal',
      passScore: 72,
      minScoreToStay: 60,
      promoteAvg: 85,
      promoteStreak: 3
    },
    hard: {
      key: 'hard',
      cefr: 'B1',
      label: 'Hard',
      passScore: 78,
      minScoreToStay: 65,
      promoteAvg: 88,
      promoteStreak: 3
    },
    challenge: {
      key: 'challenge',
      cefr: 'B1+',
      label: 'Challenge',
      passScore: 84,
      minScoreToStay: 72,
      promoteAvg: 95,
      promoteStreak: 999
    }
  };

  let patchedRouter = false;
  let boundEvents = false;
  let lastEventKey = '';

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function normalizeSid(v) {
    const raw = safe(v || '').toUpperCase();

    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(15, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }

    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function currentSid() {
    try {
      if (window.LESSON_CURRENT_STATE?.sid) {
        return normalizeSid(window.LESSON_CURRENT_STATE.sid);
      }
    } catch (err) {}

    try {
      if (window.LESSON_DATA_GUARD?.currentSid) {
        return normalizeSid(window.LESSON_DATA_GUARD.currentSid());
      }
    } catch (err) {}

    const p = q();

    return normalizeSid(
      p.get('s') ||
      p.get('sid') ||
      p.get('session') ||
      p.get('unit') ||
      p.get('lesson') ||
      '1'
    );
  }

  function normalizeDifficulty(v) {
    const raw = safe(v || '').toLowerCase();

    if (['easy', 'e', 'a2'].includes(raw)) return 'easy';
    if (['normal', 'medium', 'n', 'a2+'].includes(raw)) return 'normal';
    if (['hard', 'h', 'b1'].includes(raw)) return 'hard';

    // old name support
    if (['challenge', 'expert', 'x', 'b1+'].includes(raw)) return 'challenge';

    if (['auto', 'ai', 'adaptive'].includes(raw)) {
      return getRecommendedDifficulty(currentSid());
    }

    return 'normal';
  }

  function isAiOff() {
    const p = q();
    const ai = safe(p.get('ai') || p.get('adaptive') || '').toLowerCase();
    const lock = safe(p.get('lockDiff') || p.get('manualDiff') || '').toLowerCase();

    return (
      ai === 'off' ||
      ai === 'false' ||
      ai === 'manual' ||
      lock === '1' ||
      lock === 'true'
    );
  }

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (err) {
      console.warn('[LessonAIDifficulty] save skipped', err);
    }
  }

  function getInitialDifficultyFromUrl() {
    const p = q();
    const raw = p.get('diff') || p.get('difficulty') || p.get('level') || '';

    if (!raw || ['auto', 'ai', 'adaptive'].includes(raw.toLowerCase())) {
      return 'normal';
    }

    return normalizeDifficulty(raw);
  }

  function getSessionProfile(sid = currentSid()) {
    sid = normalizeSid(sid);

    const profile = loadProfile();

    if (!profile.version) profile.version = VERSION;
    if (!profile.sessions) profile.sessions = {};

    if (!profile.sessions[sid]) {
      profile.sessions[sid] = {
        sid,
        currentDifficulty: getInitialDifficultyFromUrl(),
        currentCEFR: META[getInitialDifficultyFromUrl()].cefr,

        attempts: 0,
        correct: 0,
        wrong: 0,

        correctStreak: 0,
        wrongStreak: 0,

        lastScores: [],
        lastDifficulties: [],
        bestScore: 0,
        averageScore: 0,
        accuracy: 0,

        promoted: 0,
        demoted: 0,

        lastResultAt: null,
        updatedAt: new Date().toISOString()
      };

      saveProfile(profile);
    }

    return profile.sessions[sid];
  }

  function putSessionProfile(sid, sessionProfile) {
    sid = normalizeSid(sid);

    const profile = loadProfile();

    if (!profile.version) profile.version = VERSION;
    if (!profile.sessions) profile.sessions = {};

    profile.sessions[sid] = sessionProfile;
    profile.last = {
      sid,
      currentDifficulty: sessionProfile.currentDifficulty,
      currentCEFR: sessionProfile.currentCEFR,
      averageScore: sessionProfile.averageScore,
      accuracy: sessionProfile.accuracy,
      updatedAt: new Date().toISOString()
    };

    saveProfile(profile);
  }

  function avg(list) {
    if (!Array.isArray(list) || !list.length) return 0;
    return Math.round(list.reduce((a, b) => a + Number(b || 0), 0) / list.length);
  }

  function clampScore(v) {
    const n = Number(v);

    if (!Number.isFinite(n)) return 0;
    if (n <= 1 && n > 0) return Math.round(n * 100);

    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function scoreFromResult(result = {}) {
    if (Number.isFinite(Number(result.score))) return clampScore(result.score);
    if (Number.isFinite(Number(result.accuracy))) return clampScore(result.accuracy);
    if (Number.isFinite(Number(result.percent))) return clampScore(result.percent);

    if (typeof result.passed === 'boolean') return result.passed ? 100 : 0;
    if (typeof result.correct === 'boolean') return result.correct ? 100 : 0;
    if (result.isCorrect === true) return 100;
    if (result.isCorrect === false) return 0;

    return 0;
  }

  function passedFromResult(result = {}, score, difficulty) {
    if (typeof result.passed === 'boolean') return result.passed;
    if (typeof result.correct === 'boolean') return result.correct;
    if (typeof result.isCorrect === 'boolean') return result.isCorrect;

    const passScore = Number(result.passScore || META[difficulty]?.passScore || 72);

    return score >= passScore;
  }

  function stepDifficulty(current, direction) {
    current = normalizeDifficulty(current);

    const i = ORDER.indexOf(current);

    if (direction > 0) return ORDER[Math.min(i + 1, ORDER.length - 1)];
    if (direction < 0) return ORDER[Math.max(i - 1, 0)];

    return current;
  }

  function decideNextDifficulty(sessionProfile, currentDifficulty) {
    currentDifficulty = normalizeDifficulty(currentDifficulty);

    const recent3 = sessionProfile.lastScores.slice(-3);
    const recent5 = sessionProfile.lastScores.slice(-5);

    const avg3 = avg(recent3);
    const avg5 = avg(recent5);

    const currentMeta = META[currentDifficulty] || META.normal;

    const enoughRecent = recent3.length >= 3;
    const enoughRecent5 = recent5.length >= 5;

    const shouldDemote =
      sessionProfile.wrongStreak >= 2 ||
      (enoughRecent && avg3 < currentMeta.minScoreToStay) ||
      (currentDifficulty === 'challenge' && enoughRecent && avg3 < 72) ||
      (currentDifficulty === 'hard' && enoughRecent5 && avg5 < 66);

    if (shouldDemote) {
      return {
        next: stepDifficulty(currentDifficulty, -1),
        reason: `demote: wrongStreak=${sessionProfile.wrongStreak}, avg3=${avg3}, avg5=${avg5}`
      };
    }

    const shouldPromote =
      sessionProfile.correctStreak >= currentMeta.promoteStreak &&
      enoughRecent &&
      avg3 >= currentMeta.promoteAvg;

    if (shouldPromote) {
      return {
        next: stepDifficulty(currentDifficulty, 1),
        reason: `promote: correctStreak=${sessionProfile.correctStreak}, avg3=${avg3}`
      };
    }

    return {
      next: currentDifficulty,
      reason: `stay: avg3=${avg3}, avg5=${avg5}, streak=${sessionProfile.correctStreak}/${sessionProfile.wrongStreak}`
    };
  }

  function getRecommendedDifficulty(sid = currentSid()) {
    if (isAiOff()) {
      return normalizeDifficulty(getInitialDifficultyFromUrl());
    }

    const sp = getSessionProfile(sid);
    return normalizeDifficulty(sp.currentDifficulty || 'normal');
  }

  function getRecommendedMeta(sid = currentSid()) {
    const diff = getRecommendedDifficulty(sid);
    return META[diff] || META.normal;
  }

  function updateUrlDifficulty(sid = currentSid()) {
    if (isAiOff()) return;

    try {
      const diff = getRecommendedDifficulty(sid);
      const url = new URL(location.href);

      url.searchParams.set('diff', diff);
      url.searchParams.set('ai', 'auto');

      // Do not leave old level param conflicting with diff.
      url.searchParams.delete('difficulty');
      url.searchParams.delete('level');

      history.replaceState(null, '', url.toString());
    } catch (err) {}
  }

  function applyCurrentDifficultyToGlobals(sid = currentSid()) {
    const diff = getRecommendedDifficulty(sid);
    const meta = META[diff] || META.normal;

    try {
      document.documentElement.dataset.lessonDifficulty = diff;
      document.documentElement.dataset.lessonCefr = meta.cefr;
      document.documentElement.dataset.lessonAiDifficulty = diff;
      document.documentElement.dataset.lessonAiCefr = meta.cefr;
    } catch (err) {}

    try {
      window.LESSON_AI_CURRENT_DIFFICULTY = diff;
      window.LESSON_AI_CURRENT_CEFR = meta.cefr;

      if (window.LESSON_CURRENT_STATE) {
        window.LESSON_CURRENT_STATE.difficulty = diff;
        window.LESSON_CURRENT_STATE.cefr = meta.cefr;
        window.LESSON_CURRENT_STATE.aiDifficulty = diff;
      }
    } catch (err) {}

    updateUrlDifficulty(sid);
  }

  function reportResult(result = {}) {
    const sid = normalizeSid(result.sid || result.sessionId || result._sid || currentSid());

    const currentDifficulty = normalizeDifficulty(
      result.difficulty ||
      result.diff ||
      result.level ||
      getRecommendedDifficulty(sid)
    );

    const score = scoreFromResult(result);
    const passed = passedFromResult(result, score, currentDifficulty);

    const sp = getSessionProfile(sid);

    sp.attempts = Number(sp.attempts || 0) + 1;

    if (passed) {
      sp.correct = Number(sp.correct || 0) + 1;
      sp.correctStreak = Number(sp.correctStreak || 0) + 1;
      sp.wrongStreak = 0;
    } else {
      sp.wrong = Number(sp.wrong || 0) + 1;
      sp.wrongStreak = Number(sp.wrongStreak || 0) + 1;
      sp.correctStreak = 0;
    }

    sp.lastScores = Array.isArray(sp.lastScores) ? sp.lastScores : [];
    sp.lastScores.push(score);
    sp.lastScores = sp.lastScores.slice(-8);

    sp.lastDifficulties = Array.isArray(sp.lastDifficulties) ? sp.lastDifficulties : [];
    sp.lastDifficulties.push(currentDifficulty);
    sp.lastDifficulties = sp.lastDifficulties.slice(-8);

    sp.bestScore = Math.max(Number(sp.bestScore || 0), score);
    sp.averageScore = avg(sp.lastScores);

    const total = Math.max(1, Number(sp.correct || 0) + Number(sp.wrong || 0));
    sp.accuracy = Math.round((Number(sp.correct || 0) / total) * 100);

    const before = normalizeDifficulty(sp.currentDifficulty || currentDifficulty);
    const decision = decideNextDifficulty(sp, before);
    const after = normalizeDifficulty(decision.next);

    if (ORDER.indexOf(after) > ORDER.indexOf(before)) {
      sp.promoted = Number(sp.promoted || 0) + 1;
    } else if (ORDER.indexOf(after) < ORDER.indexOf(before)) {
      sp.demoted = Number(sp.demoted || 0) + 1;
    }

    sp.currentDifficulty = after;
    sp.currentCEFR = META[after].cefr;
    sp.lastScore = score;
    sp.lastPassed = passed;
    sp.lastReason = decision.reason;
    sp.lastResultAt = new Date().toISOString();
    sp.updatedAt = new Date().toISOString();

    putSessionProfile(sid, sp);
    applyCurrentDifficultyToGlobals(sid);

    const detail = {
      version: VERSION,
      sid,
      score,
      passed,
      beforeDifficulty: before,
      beforeCEFR: META[before].cefr,
      recommendedDifficulty: after,
      recommendedCEFR: META[after].cefr,
      reason: decision.reason,
      profile: sp,
      raw: result
    };

    window.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));

    console.log('[LessonAIDifficulty] result -> next', detail);

    return detail;
  }

  function makeEventKey(detail = {}) {
    const sid = normalizeSid(detail.sid || detail.sessionId || currentSid());
    const item = safe(detail.itemId || detail.id || detail.questionId || detail._id || '');
    const score = scoreFromResult(detail);
    const passed = typeof detail.passed === 'boolean' ? detail.passed : '';

    return `${sid}|${item}|${score}|${passed}|${safe(detail.skill || detail.type || '')}`;
  }

  function handleResultEvent(ev) {
    const detail = ev?.detail || {};

    if (!detail || typeof detail !== 'object') return;

    const key = makeEventKey(detail);
    const nowKey = `${key}|${Math.floor(Date.now() / 800)}`;

    if (nowKey === lastEventKey) return;
    lastEventKey = nowKey;

    reportResult(detail);
  }

  function bindResultEvents() {
    if (boundEvents) return;
    boundEvents = true;

    const events = [
      'lesson:speaking-result',
      'lesson:writing-result',
      'lesson:reading-result',
      'lesson:listening-result',
      'lesson:choice-result',
      'lesson:answer-result',
      'lesson:mission-result',
      'lesson:item-result'
    ];

    events.forEach((name) => {
      window.addEventListener(name, handleResultEvent);
      document.addEventListener(name, handleResultEvent);
    });

    // mission-pass has no failure info, so use it only when no other result event exists.
    window.addEventListener('lesson:mission-pass', function (ev) {
      const d = ev?.detail || {};
      if (d.__aiHandled) return;

      handleResultEvent({
        detail: {
          ...d,
          passed: true,
          score: Number(d.score || d.accuracy || 100)
        }
      });
    });
  }

  function patchRouter() {
    const router = window.LESSON_ROUTER;
    if (!router || patchedRouter) return;

    patchedRouter = true;

    const originalGetRecommendedDifficulty =
      typeof router.getRecommendedDifficulty === 'function'
        ? router.getRecommendedDifficulty.bind(router)
        : null;

    const originalNormalizeDifficulty =
      typeof router.normalizeDifficulty === 'function'
        ? router.normalizeDifficulty.bind(router)
        : null;

    const originalGetBank =
      typeof router.getBank === 'function'
        ? router.getBank.bind(router)
        : null;

    const originalPickItem =
      typeof router.pickItem === 'function'
        ? router.pickItem.bind(router)
        : null;

    const originalReportResult =
      typeof router.reportResult === 'function'
        ? router.reportResult.bind(router)
        : null;

    try {
      if (window.LESSON_DIFFICULTY_LEVELS) {
        window.LESSON_DIFFICULTY_LEVELS.challenge = {
          key: 'challenge',
          label: 'Challenge',
          cefr: 'B1+',
          order: 3,
          itemCount: 10,
          passScore: 84,
          description: 'B1+ challenge task'
        };

        // old alias still accepted
        window.LESSON_DIFFICULTY_LEVELS.expert = window.LESSON_DIFFICULTY_LEVELS.challenge;
      }

      if (router.levels) {
        router.levels.challenge = window.LESSON_DIFFICULTY_LEVELS?.challenge || META.challenge;
        router.levels.expert = router.levels.challenge;
      }

      router.order = ORDER.slice();
    } catch (err) {}

    router.normalizeDifficulty = function patchedNormalizeDifficulty(v) {
      return normalizeDifficulty(v || (originalNormalizeDifficulty ? originalNormalizeDifficulty(v) : 'normal'));
    };

    router.getRecommendedDifficulty = function patchedGetRecommendedDifficulty(sid) {
      if (isAiOff() && originalGetRecommendedDifficulty) {
        return normalizeDifficulty(originalGetRecommendedDifficulty(sid));
      }

      return getRecommendedDifficulty(sid || currentSid());
    };

    if (originalGetBank) {
      router.getBank = function patchedGetBank(sid, difficulty) {
        const diff = normalizeDifficulty(difficulty);

        // Some older router banks still use expert internally.
        const internalDiff = diff === 'challenge' ? 'expert' : diff;

        let bank = originalGetBank(sid, internalDiff);

        if ((!bank || !bank.length) && diff === 'challenge') {
          bank = originalGetBank(sid, 'challenge');
        }

        if (Array.isArray(bank)) {
          return bank.map((item) => ({
            ...item,
            difficulty: diff,
            cefr: META[diff].cefr,
            passScore: item.passScore || META[diff].passScore
          }));
        }

        return bank;
      };
    }

    if (originalPickItem) {
      router.pickItem = function patchedPickItem(options = {}) {
        const sid = normalizeSid(options.sid || currentSid());
        const aiDiff = getRecommendedDifficulty(sid);
        const internalDiff = aiDiff === 'challenge' ? 'expert' : aiDiff;

        const finalOptions = isAiOff() || options.ai === false
          ? {
              ...options,
              difficulty: normalizeDifficulty(options.difficulty || options.diff || aiDiff)
            }
          : {
              ...options,
              difficulty: internalDiff,
              diff: internalDiff
            };

        const item = originalPickItem(finalOptions);

        if (item) {
          item.difficulty = aiDiff;
          item.diff = aiDiff;
          item.cefr = META[aiDiff].cefr;
          item.passScore = item.passScore || META[aiDiff].passScore;
          item.aiDifficulty = aiDiff;
          item.aiCEFR = META[aiDiff].cefr;
        }

        return item;
      };
    }

    router.reportResult = function patchedReportResult(result = {}) {
      let originalReturn = null;

      try {
        if (originalReportResult) {
          originalReturn = originalReportResult({
            ...result,
            difficulty: normalizeDifficulty(result.difficulty || result.diff || getRecommendedDifficulty(result.sid || currentSid()))
          });
        }
      } catch (err) {
        console.warn('[LessonAIDifficulty] original router report failed', err);
      }

      const aiReturn = reportResult(result);

      return {
        original: originalReturn,
        ai: aiReturn
      };
    };

    console.log('[LessonAIDifficulty] router patched', VERSION);
  }

  function boot() {
    const sid = currentSid();

    applyCurrentDifficultyToGlobals(sid);
    patchRouter();
    bindResultEvents();

    setTimeout(() => {
      patchRouter();
      applyCurrentDifficultyToGlobals(currentSid());
    }, 300);

    setTimeout(() => {
      patchRouter();
      applyCurrentDifficultyToGlobals(currentSid());
    }, 1000);

    setTimeout(() => {
      patchRouter();
      applyCurrentDifficultyToGlobals(currentSid());
    }, 2500);

    window.LESSON_AI_DIFFICULTY = {
      version: VERSION,
      order: ORDER,
      meta: META,

      normalizeSid,
      normalizeDifficulty,
      currentSid,

      isAiOff,
      getProfile: loadProfile,
      getSessionProfile,
      getRecommendedDifficulty,
      getRecommendedMeta,

      reportResult,
      apply: applyCurrentDifficultyToGlobals,
      patchRouter,

      resetSession(sid = currentSid()) {
        sid = normalizeSid(sid);
        const profile = loadProfile();
        if (profile.sessions) delete profile.sessions[sid];
        saveProfile(profile);
        applyCurrentDifficultyToGlobals(sid);
      },

      resetAll() {
        localStorage.removeItem(STORAGE_KEY);
        applyCurrentDifficultyToGlobals(currentSid());
      }
    };

    console.log('[LessonAIDifficulty]', VERSION, {
      sid,
      recommendedDifficulty: getRecommendedDifficulty(sid),
      cefr: getRecommendedMeta(sid).cefr,
      aiOff: isAiOff()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
