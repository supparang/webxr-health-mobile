// === /english/js/lesson-session-timer-fix.js ===
// PATCH v20260426a-LESSON-SESSION-TIMER
// ✅ Tracks time per S/session
// ✅ Shows live timer on mission panel
// ✅ Saves last duration per S
// ✅ Adds sessionDurationSec / sessionStartedAt / sessionEndedAt to lesson result events
// ✅ Works with new mission panel and scene selector routing

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-SESSION-TIMER';
  const STORAGE_KEY = 'TECHPATH_SESSION_TIMER_V1';

  const state = {
    sid: 'S1',
    startedAtMs: 0,
    endedAtMs: 0,
    passed: false,
    tickId: 0,
    patchedDispatch: false
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

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
      if (window.LESSON_CURRENT_STATE?.sid) return normalizeSid(window.LESSON_CURRENT_STATE.sid);
    } catch (err) {}

    try {
      if (window.LESSON_MISSION_PANEL_FIX?.getState) {
        const st = window.LESSON_MISSION_PANEL_FIX.getState();
        if (st?.sid) return normalizeSid(st.sid);
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

  function ensureStore() {
    const store = loadStore();

    if (!store.version) store.version = VERSION;
    if (!store.sessions) store.sessions = {};

    return store;
  }

  function nowIso(ms) {
    return new Date(ms || Date.now()).toISOString();
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(Number(sec || 0)));

    const m = Math.floor(sec / 60);
    const s = sec % 60;

    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function elapsedSec() {
    if (!state.startedAtMs) return 0;

    const end = state.endedAtMs || Date.now();
    return Math.max(0, Math.floor((end - state.startedAtMs) / 1000));
  }

  function startSession(sid, reason) {
    sid = normalizeSid(sid || currentSid());

    if (state.sid === sid && state.startedAtMs && !state.passed) {
      return;
    }

    state.sid = sid;
    state.startedAtMs = Date.now();
    state.endedAtMs = 0;
    state.passed = false;

    const store = ensureStore();

    store.current = {
      sid,
      startedAt: nowIso(state.startedAtMs),
      reason: reason || 'start'
    };

    if (!store.sessions[sid]) {
      store.sessions[sid] = {
        sid,
        attempts: 0,
        totalDurationSec: 0,
        bestDurationSec: 0,
        lastDurationSec: 0,
        lastStartedAt: '',
        lastEndedAt: ''
      };
    }

    store.sessions[sid].attempts = Number(store.sessions[sid].attempts || 0) + 1;
    store.sessions[sid].lastStartedAt = nowIso(state.startedAtMs);

    saveStore(store);

    try {
      if (!window.LESSON_CURRENT_STATE) window.LESSON_CURRENT_STATE = {};
      window.LESSON_CURRENT_STATE.sid = sid;
      window.LESSON_CURRENT_STATE.sessionStartedAt = nowIso(state.startedAtMs);
      window.LESSON_CURRENT_STATE.sessionTimerVersion = VERSION;
    } catch (err) {}

    updateUI();

    console.log('[LessonSessionTimer] start', {
      version: VERSION,
      sid,
      reason
    });
  }

  function finishSession(reason) {
    if (!state.startedAtMs) return;

    if (!state.endedAtMs) {
      state.endedAtMs = Date.now();
    }

    state.passed = true;

    const durationSec = elapsedSec();
    const store = ensureStore();
    const sid = state.sid;

    if (!store.sessions[sid]) {
      store.sessions[sid] = {
        sid,
        attempts: 0,
        totalDurationSec: 0,
        bestDurationSec: 0,
        lastDurationSec: 0,
        lastStartedAt: '',
        lastEndedAt: ''
      };
    }

    const s = store.sessions[sid];

    s.lastDurationSec = durationSec;
    s.totalDurationSec = Number(s.totalDurationSec || 0) + durationSec;
    s.bestDurationSec =
      Number(s.bestDurationSec || 0) > 0
        ? Math.min(Number(s.bestDurationSec || 0), durationSec)
        : durationSec;

    s.lastEndedAt = nowIso(state.endedAtMs);
    s.lastReason = reason || 'finish';

    store.last = {
      sid,
      durationSec,
      durationLabel: formatTime(durationSec),
      startedAt: nowIso(state.startedAtMs),
      endedAt: nowIso(state.endedAtMs),
      reason: reason || 'finish'
    };

    saveStore(store);

    updateUI();

    console.log('[LessonSessionTimer] finish', store.last);
  }

  function ensureCSS() {
    if ($('#lesson-session-timer-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-session-timer-css';
    style.textContent = `
      #lessonSessionTimerPill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(15,23,42,.88);
        border: 1px solid rgba(125,211,252,.45);
        color: #e0faff;
        font: 1000 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        white-space: nowrap;
      }

      #lessonSessionTimerFloat {
        position: fixed;
        right: 14px;
        top: 56px;
        z-index: 2147483645;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border-radius: 999px;
        background: rgba(15,23,42,.88);
        border: 1px solid rgba(125,211,252,.45);
        color: #e0faff;
        font: 1000 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow: 0 14px 34px rgba(0,0,0,.30);
        pointer-events: none;
      }

      html.lesson-mode-cardboard #lessonSessionTimerFloat {
        top: auto;
        bottom: 54px;
        right: 8px;
        opacity: .82;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureFloatTimer() {
    ensureCSS();

    let el = $('#lessonSessionTimerFloat');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lessonSessionTimerFloat';
      el.innerHTML = `⏱ <span id="lessonSessionTimerFloatText">00:00</span>`;
      document.body.appendChild(el);
    }

    return el;
  }

  function ensurePanelTimer() {
    ensureCSS();

    const head = $('#lessonMissionPanel .lesson-mission-head');
    if (!head) return null;

    let pill = $('#lessonSessionTimerPill');

    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'lessonSessionTimerPill';
      pill.innerHTML = `⏱ <span id="lessonSessionTimerPillText">00:00</span>`;
      head.appendChild(pill);
    }

    return pill;
  }

  function updateUI() {
    ensureFloatTimer();
    ensurePanelTimer();

    const sec = elapsedSec();
    const label = formatTime(sec);

    const floatText = $('#lessonSessionTimerFloatText');
    if (floatText) floatText.textContent = `${state.sid} • ${label}`;

    const pillText = $('#lessonSessionTimerPillText');
    if (pillText) pillText.textContent = label;

    try {
      document.documentElement.dataset.lessonSessionElapsed = String(sec);
      document.documentElement.dataset.lessonSessionElapsedLabel = label;
    } catch (err) {}
  }

  function tick() {
    const sid = currentSid();

    if (sid !== state.sid) {
      startSession(sid, 'sid-change');
    }

    updateUI();
  }

  function addTimingToDetail(detail) {
    if (!detail || typeof detail !== 'object') return detail;

    if (!state.startedAtMs) {
      startSession(currentSid(), 'event-start');
    }

    const sec = elapsedSec();

    detail.sessionTimerVersion = VERSION;
    detail.sessionSid = state.sid;
    detail.sessionStartedAt = nowIso(state.startedAtMs);
    detail.sessionDurationSec = sec;
    detail.sessionDurationLabel = formatTime(sec);

    if (state.endedAtMs) {
      detail.sessionEndedAt = nowIso(state.endedAtMs);
    }

    return detail;
  }

  function patchDispatchEvent() {
    if (state.patchedDispatch) return;
    state.patchedDispatch = true;

    const original = EventTarget.prototype.dispatchEvent;

    EventTarget.prototype.dispatchEvent = function patchedDispatchEvent(ev) {
      try {
        if (
          ev &&
          ev.type &&
          /^lesson:/.test(String(ev.type)) &&
          ev.detail &&
          typeof ev.detail === 'object'
        ) {
          addTimingToDetail(ev.detail);
        }
      } catch (err) {}

      return original.call(this, ev);
    };

    console.log('[LessonSessionTimer] dispatch patched', VERSION);
  }

  function bindEvents() {
    window.addEventListener('lesson:mission-pass', () => finishSession('mission-pass'));
    document.addEventListener('lesson:mission-pass', () => finishSession('document:mission-pass'));

    [
      'lesson:item-ready',
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:view-mode-ready',
      'lesson:ai-difficulty-updated'
    ].forEach((name) => {
      window.addEventListener(name, () => tick());
      document.addEventListener(name, () => tick());
    });
  }

  function boot() {
    patchDispatchEvent();

    startSession(currentSid(), 'boot');
    bindEvents();

    clearInterval(state.tickId);
    state.tickId = setInterval(tick, 1000);

    setTimeout(tick, 500);
    setTimeout(tick, 1200);
    setTimeout(tick, 2500);

    window.LESSON_SESSION_TIMER_FIX = {
      version: VERSION,
      state,
      start: startSession,
      finish: finishSession,
      elapsedSec,
      formatTime,
      getStore: loadStore,
      addTimingToDetail
    };

    console.log('[LessonSessionTimer]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
