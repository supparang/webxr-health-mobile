// === /english/js/lesson-attendance-sheet-fix.js ===
// PATCH v20260426a-TECHPATH-ATTENDANCE-SHEET-LOGGER
// ✅ Uses new Apps Script endpoint
// ✅ Logs session_start / item_result / mission_pass / session_end
// ✅ Includes S1-S15, skill, difficulty, CEFR, score, passed, duration
// ✅ Works with lesson-session-timer-fix.js
// ✅ Uses text/plain to reduce CORS/preflight issues
// ✅ Has beacon fallback for page close

(function () {
  'use strict';

  const VERSION = 'v20260426a-TECHPATH-ATTENDANCE-SHEET-LOGGER';

  const ENDPOINT =
    'https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec';

  const STORAGE_KEY = 'TECHPATH_ATTENDANCE_QUEUE_V1';
  const SESSION_ID_KEY = 'TECHPATH_CURRENT_SESSION_ID_V1';

  const state = {
    started: false,
    sessionId: '',
    sid: '',
    startAt: '',
    lastEventAt: 0,
    sentEnd: false
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

  function sidNumber(sid) {
    return Math.max(1, Math.min(15, parseInt(String(sid).replace('S', ''), 10) || 1));
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

  function currentPlayer() {
    const p = q();

    let name = safe(p.get('name') || p.get('nick') || p.get('display_name') || '');
    let studentId = safe(p.get('student_id') || p.get('sid_student') || p.get('pid') || '');
    let section = safe(p.get('section') || p.get('sec') || '');
    let sessionCode = safe(p.get('session_code') || p.get('class') || p.get('room') || '');

    try {
      const profileRaw =
        localStorage.getItem('TECHPATH_PROFILE') ||
        localStorage.getItem('ENGLISH_QUEST_PROFILE') ||
        localStorage.getItem('VOCAB_V9_PROFILE') ||
        '';

      if (profileRaw) {
        const profile = JSON.parse(profileRaw);

        name = name || safe(profile.name || profile.displayName || profile.display_name || profile.nick);
        studentId = studentId || safe(profile.studentId || profile.student_id || profile.pid);
        section = section || safe(profile.section);
        sessionCode = sessionCode || safe(profile.sessionCode || profile.session_code);
      }
    } catch (err) {}

    return {
      display_name: name || 'anonymous',
      student_id: studentId || 'anon',
      section,
      session_code: sessionCode
    };
  }

  function currentMissionState() {
    try {
      if (window.LESSON_MISSION_PANEL_FIX?.getState) {
        return window.LESSON_MISSION_PANEL_FIX.getState() || {};
      }
    } catch (err) {}

    return {};
  }

  function currentTimer() {
    try {
      if (window.LESSON_SESSION_TIMER_FIX) {
        return {
          duration_sec: Number(window.LESSON_SESSION_TIMER_FIX.elapsedSec?.() || 0),
          duration_label: window.LESSON_SESSION_TIMER_FIX.formatTime?.(
            Number(window.LESSON_SESSION_TIMER_FIX.elapsedSec?.() || 0)
          ) || ''
        };
      }
    } catch (err) {}

    return {
      duration_sec: 0,
      duration_label: ''
    };
  }

  function makeId() {
    return [
      'tp',
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 8)
    ].join('_');
  }

  function getOrCreateSessionId() {
    if (state.sessionId) return state.sessionId;

    try {
      const existing = sessionStorage.getItem(SESSION_ID_KEY);
      if (existing) {
        state.sessionId = existing;
        return existing;
      }
    } catch (err) {}

    const id = makeId();
    state.sessionId = id;

    try {
      sessionStorage.setItem(SESSION_ID_KEY, id);
    } catch (err) {}

    return id;
  }

  function basePayload(action, extra) {
    const sid = currentSid();
    const st = currentMissionState();
    const timer = currentTimer();
    const player = currentPlayer();
    const p = q();

    return {
      api: 'techpath_lesson',
      version: VERSION,
      action,
      event_id: makeId(),
      session_id: getOrCreateSessionId(),
      timestamp: new Date().toISOString(),

      sid,
      session_no: sidNumber(sid),
      lesson_title: safe(st.session?.title || st.item?.title || ''),
      skill: safe(st.skill || st.item?.skill || st.session?.type || ''),
      difficulty: safe(st.difficulty || st.item?.difficulty || p.get('diff') || ''),
      cefr: safe(st.item?.cefr || ''),

      display_name: player.display_name,
      student_id: player.student_id,
      section: player.section,
      session_code: player.session_code,

      duration_sec: timer.duration_sec,
      duration_label: timer.duration_label,

      page_url: location.href,
      user_agent: navigator.userAgent,

      view: safe(p.get('view') || window.LESSON_VIEW_MODE || ''),
      ai: safe(p.get('ai') || ''),
      source: 'lesson.html',

      ...extra
    };
  }

  function loadQueue() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || [];
    } catch (err) {
      return [];
    }
  }

  function saveQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-50)));
    } catch (err) {}
  }

  function queuePayload(payload) {
    const queue = loadQueue();
    queue.push(payload);
    saveQueue(queue);
  }

  async function postPayload(payload, useBeacon) {
    const body = JSON.stringify(payload);

    if (useBeacon && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
        const ok = navigator.sendBeacon(ENDPOINT, blob);
        if (ok) return true;
      } catch (err) {}
    }

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body,
        keepalive: !!useBeacon
      });

      return !!res;
    } catch (err) {
      queuePayload(payload);
      console.warn('[TechPathAttendance] queued after post failure', err);
      return false;
    }
  }

  async function flushQueue() {
    const queue = loadQueue();
    if (!queue.length) return;

    const remaining = [];

    for (const payload of queue) {
      try {
        const ok = await postPayload(payload, false);
        if (!ok) remaining.push(payload);
      } catch (err) {
        remaining.push(payload);
      }
    }

    saveQueue(remaining);
  }

  function log(action, extra, options) {
    const payload = basePayload(action, extra || {});
    postPayload(payload, options?.beacon === true);

    console.log('[TechPathAttendance]', action, payload);
    return payload;
  }

  function startSession(reason) {
    if (state.started) return;

    state.started = true;
    state.sid = currentSid();
    state.startAt = new Date().toISOString();

    log('session_start', {
      reason: reason || 'boot'
    });

    flushQueue();
  }

  function endSession(reason, useBeacon) {
    if (state.sentEnd) return;

    state.sentEnd = true;

    log(
      'session_end',
      {
        reason: reason || 'end',
        started_at: state.startAt,
        ended_at: new Date().toISOString()
      },
      { beacon: !!useBeacon }
    );
  }

  function handleItemResult(ev) {
    const d = ev?.detail || {};

    const key = [
      safe(d.sid || currentSid()),
      safe(d.itemId || d.id),
      safe(d.skill || d.type),
      safe(d.answer),
      safe(d.passed),
      safe(d.score)
    ].join('|');

    const now = Date.now();
    if (key === state.lastKey && now - state.lastEventAt < 300) return;

    state.lastKey = key;
    state.lastEventAt = now;

    log('item_result', {
      item_id: safe(d.itemId || d.id || ''),
      item_skill: safe(d.skill || d.type || ''),
      answer: safe(d.answer || ''),
      passed: d.passed === true,
      score: Number(d.score || 0),
      pass_score: Number(d.passScore || 0),
      result_difficulty: safe(d.difficulty || ''),
      result_cefr: safe(d.cefr || ''),
      raw_event_type: safe(ev.type || '')
    });
  }

  function handleMissionPass(ev) {
    const d = ev?.detail || {};

    log('mission_pass', {
      item_id: safe(d.itemId || d.id || ''),
      item_skill: safe(d.skill || d.type || ''),
      answer: safe(d.answer || ''),
      score: Number(d.score || 0),
      passed: true,
      result_difficulty: safe(d.difficulty || ''),
      result_cefr: safe(d.cefr || '')
    });
  }

  function bindEvents() {
    [
      'lesson:item-result',
      'lesson:listening-result',
      'lesson:reading-result',
      'lesson:writing-result',
      'lesson:speaking-result',
      'lesson:choice-result',
      'lesson:answer-result'
    ].forEach((name) => {
      window.addEventListener(name, handleItemResult);
      document.addEventListener(name, handleItemResult);
    });

    window.addEventListener('lesson:mission-pass', handleMissionPass);
    document.addEventListener('lesson:mission-pass', handleMissionPass);

    window.addEventListener('beforeunload', () => {
      endSession('beforeunload', true);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        endSession('visibility_hidden', true);
      }
    });

    window.addEventListener('pagehide', () => {
      endSession('pagehide', true);
    });
  }

  function boot() {
    bindEvents();

    setTimeout(() => startSession('boot'), 300);
    setTimeout(() => flushQueue(), 1200);

    window.TECHPATH_ATTENDANCE_SHEET_FIX = {
      version: VERSION,
      endpoint: ENDPOINT,
      log,
      startSession,
      endSession,
      flushQueue,
      getPayloadPreview: () => basePayload('preview', {})
    };

    console.log('[TechPathAttendance]', VERSION, ENDPOINT);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
