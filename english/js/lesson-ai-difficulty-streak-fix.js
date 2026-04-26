// === /english/js/lesson-ai-difficulty-streak-fix.js ===
// PATCH v20260426a-LESSON-AI-DIFFICULTY-STREAK
// ✅ Adaptive difficulty per S1-S15
// ✅ 2 correct in a row = promote
// ✅ 1 wrong = demote
// ✅ easy -> normal -> hard -> challenge
// ✅ exposes LESSON_AI_DIFFICULTY.getRecommendedDifficulty()
// ✅ triggers lesson:ai-difficulty-updated so Mission Panel re-renders

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-AI-DIFFICULTY-STREAK';
  const STORAGE_KEY = 'TECHPATH_AI_DIFFICULTY_STREAK_V1';

  const LEVELS = ['easy', 'normal', 'hard', 'challenge'];

  const CONFIG = {
    promoteStreak: 2,
    demoteOnFail: true,
    minLevel: 'easy',
    maxLevel: 'challenge',
    defaultLevel: 'easy',
    debounceMs: 450
  };

  const state = {
    lastKey: '',
    lastAt: 0
  };

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function normalizeSid(v) {
    const raw = safe(v).toUpperCase();

    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(15, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }

    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function currentSid() {
    try {
      if (window.LESSON_MISSION_PANEL_FIX?.getState) {
        const st = window.LESSON_MISSION_PANEL_FIX.getState();
        if (st?.sid) return normalizeSid(st.sid);
      }
    } catch (err) {}

    try {
      if (window.LESSON_CURRENT_STATE?.sid) {
        return normalizeSid(window.LESSON_CURRENT_STATE.sid);
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

  function normalizeLevel(v) {
    const raw = safe(v).toLowerCase();

    if (['easy', 'e', 'a2'].includes(raw)) return 'easy';
    if (['normal', 'medium', 'n', 'a2+'].includes(raw)) return 'normal';
    if (['hard', 'h', 'b1'].includes(raw)) return 'hard';
    if (['challenge', 'expert', 'x', 'b1+'].includes(raw)) return 'challenge';

    return CONFIG.defaultLevel;
  }

  function levelIndex(level) {
    const i = LEVELS.indexOf(normalizeLevel(level));
    return i >= 0 ? i : 0;
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {}
  }

  function ensureRecord(store, sid) {
    sid = normalizeSid(sid);

    if (!store.version) store.version = VERSION;
    if (!store.sessions) store.sessions = {};

    if (!store.sessions[sid]) {
      store.sessions[sid] = {
        sid,
        level: CONFIG.defaultLevel,
        correctStreak: 0,
        wrongStreak: 0,
        attempts: 0,
        passes: 0,
        fails: 0,
        lastScore: 0,
        updatedAt: ''
      };
    }

    store.sessions[sid].level = normalizeLevel(store.sessions[sid].level);

    return store.sessions[sid];
  }

  function getRecommendedDifficulty(sid) {
    sid = normalizeSid(sid || currentSid());

    const store = loadStore();
    const rec = ensureRecord(store, sid);

    return normalizeLevel(rec.level);
  }

  function setDifficulty(sid, level, reason) {
    sid = normalizeSid(sid || currentSid());
    level = normalizeLevel(level);

    const store = loadStore();
    const rec = ensureRecord(store, sid);

    rec.level = level;
    rec.updatedAt = new Date().toISOString();
    rec.reason = reason || 'manual';

    saveStore(store);

    dispatchUpdate(sid, rec, reason || 'manual');

    return rec;
  }

  function promote(level) {
    const i = levelIndex(level);
    return LEVELS[Math.min(LEVELS.length - 1, i + 1)];
  }

  function demote(level) {
    const i = levelIndex(level);
    return LEVELS[Math.max(0, i - 1)];
  }

  function resultKey(detail) {
    return [
      safe(detail.sid || detail.sessionSid || currentSid()),
      safe(detail.itemId || detail.id || ''),
      safe(detail.skill || detail.type || ''),
      safe(detail.answer || ''),
      safe(detail.score || ''),
      safe(detail.passed)
    ].join('|');
  }

  function shouldIgnoreDuplicate(detail) {
    const key = resultKey(detail);
    const now = Date.now();

    if (key === state.lastKey && now - state.lastAt < CONFIG.debounceMs) {
      return true;
    }

    state.lastKey = key;
    state.lastAt = now;
    return false;
  }

  function dispatchUpdate(sid, rec, reason) {
    const detail = {
      version: VERSION,
      sid,
      difficulty: rec.level,
      level: rec.level,
      correctStreak: rec.correctStreak,
      wrongStreak: rec.wrongStreak,
      attempts: rec.attempts,
      passes: rec.passes,
      fails: rec.fails,
      reason: reason || rec.reason || 'updated'
    };

    try {
      if (!window.LESSON_CURRENT_STATE) window.LESSON_CURRENT_STATE = {};
      window.LESSON_CURRENT_STATE.sid = sid;
      window.LESSON_CURRENT_STATE.difficulty = rec.level;
      window.LESSON_CURRENT_STATE.aiDifficultyVersion = VERSION;
    } catch (err) {}

    window.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));

    console.log('[LessonAIDifficulty]', VERSION, detail);
  }

  function handleResult(ev) {
    const d = ev?.detail || {};
    if (!d) return;

    // ใช้เฉพาะ item-result เป็นหลัก กัน mission-pass ซ้ำ
    if (ev.type !== 'lesson:item-result') return;

    if (shouldIgnoreDuplicate(d)) return;

    const sid = normalizeSid(d.sid || d.sessionSid || currentSid());
    const passed =
      d.passed === true ||
      d.correct === true ||
      d.isCorrect === true ||
      Number(d.score || 0) >= Number(d.passScore || 70);

    const score = Number(d.score || 0);

    const store = loadStore();
    const rec = ensureRecord(store, sid);

    rec.attempts = Number(rec.attempts || 0) + 1;
    rec.lastScore = score;
    rec.updatedAt = new Date().toISOString();

    let oldLevel = normalizeLevel(rec.level);
    let newLevel = oldLevel;
    let reason = 'stay';

    if (passed) {
      rec.passes = Number(rec.passes || 0) + 1;
      rec.correctStreak = Number(rec.correctStreak || 0) + 1;
      rec.wrongStreak = 0;

      if (rec.correctStreak >= CONFIG.promoteStreak) {
        newLevel = promote(oldLevel);

        if (newLevel !== oldLevel) {
          rec.level = newLevel;
          rec.correctStreak = 0;
          reason = `promote_after_${CONFIG.promoteStreak}_correct`;
        } else {
          reason = 'max_level_keep_challenge';
        }
      } else {
        reason = `correct_streak_${rec.correctStreak}_${CONFIG.promoteStreak}`;
      }
    } else {
      rec.fails = Number(rec.fails || 0) + 1;
      rec.wrongStreak = Number(rec.wrongStreak || 0) + 1;
      rec.correctStreak = 0;

      if (CONFIG.demoteOnFail) {
        newLevel = demote(oldLevel);

        if (newLevel !== oldLevel) {
          rec.level = newLevel;
          reason = 'demote_after_wrong';
        } else {
          reason = 'min_level_keep_easy';
        }
      } else {
        reason = 'wrong_keep_level';
      }
    }

    rec.reason = reason;

    saveStore(store);
    dispatchUpdate(sid, rec, reason);
  }

  function reset(sid) {
    sid = normalizeSid(sid || currentSid());

    const store = loadStore();

    if (store.sessions && store.sessions[sid]) {
      delete store.sessions[sid];
      saveStore(store);
    }

    const freshStore = loadStore();
    const rec = ensureRecord(freshStore, sid);
    saveStore(freshStore);

    dispatchUpdate(sid, rec, 'reset');

    return rec;
  }

  function getProfile(sid) {
    sid = normalizeSid(sid || currentSid());

    const store = loadStore();
    const rec = ensureRecord(store, sid);

    return { ...rec };
  }

  function bindEvents() {
    window.addEventListener('lesson:item-result', handleResult);
    document.addEventListener('lesson:item-result', handleResult);
  }

  function boot() {
    bindEvents();

    const sid = currentSid();
    const level = getRecommendedDifficulty(sid);

    try {
      if (!window.LESSON_CURRENT_STATE) window.LESSON_CURRENT_STATE = {};
      window.LESSON_CURRENT_STATE.sid = sid;
      window.LESSON_CURRENT_STATE.difficulty = level;
      window.LESSON_CURRENT_STATE.aiDifficultyVersion = VERSION;
    } catch (err) {}

    window.LESSON_AI_DIFFICULTY = {
      version: VERSION,
      getRecommendedDifficulty,
      setDifficulty,
      reset,
      getProfile,
      getStore: loadStore
    };

    console.log('[LessonAIDifficulty]', VERSION, {
      sid,
      level,
      profile: getProfile(sid)
    });

    setTimeout(() => {
      dispatchUpdate(sid, getProfile(sid), 'boot-sync');
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();