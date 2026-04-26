// === /english/js/lesson-pass-next-flow-fix.js ===
// PATCH v20260426a-LESSON-PASS-NEXT-FLOW
// Fix: after correct answer, do NOT repeat the same S.
// ✅ One correct/pass = clear current S
// ✅ Saves completion per S
// ✅ Shows clear "ไป S ถัดไป"
// ✅ Auto-next to next S after short delay
// ✅ Keeps AI difficulty as next-question/next-session support, not repeat forcing
// ✅ Works with lesson:item-result and lesson:mission-pass

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-PASS-NEXT-FLOW';
  const COMPLETE_KEY = 'TECHPATH_SESSION_COMPLETED_V1';

  const CONFIG = {
    autoNext: true,
    autoNextDelayMs: 1200,
    debounceMs: 900
  };

  const state = {
    lastPassKey: '',
    lastPassAt: 0,
    nextTimer: 0
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

  function sidNumber(sid) {
    return Math.max(1, Math.min(15, parseInt(String(sid).replace('S', ''), 10) || 1));
  }

  function currentSid(detail) {
    if (detail && (detail.sid || detail.sessionSid)) {
      return normalizeSid(detail.sid || detail.sessionSid);
    }

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

  function isAutoNextOff() {
    const p = q();
    const raw = safe(p.get('autoNext') || p.get('next') || '').toLowerCase();
    return ['0', 'off', 'false', 'no'].includes(raw);
  }

  function nextSidOf(sid) {
    const n = sidNumber(sid);
    if (n >= 15) return '';
    return `S${n + 1}`;
  }

  function buildUrlForSid(sid) {
    sid = normalizeSid(sid);

    const url = new URL(location.href);

    url.searchParams.set('s', String(sidNumber(sid)));
    url.searchParams.set('sid', sid);
    url.searchParams.set('ai', 'auto');

    [
      'skill',
      'stage',
      'mission',
      'type',
      'old',
      'native',
      'question',
      'prompt',
      'modeSkill',
      'difficulty',
      'level',
      'diff'
    ].forEach((k) => url.searchParams.delete(k));

    return url.toString();
  }

  function loadCompleted() {
    try {
      return JSON.parse(localStorage.getItem(COMPLETE_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function saveCompleted(store) {
    try {
      localStorage.setItem(COMPLETE_KEY, JSON.stringify(store));
    } catch (err) {}
  }

  function markCompleted(detail) {
    const sid = currentSid(detail);
    const store = loadCompleted();

    if (!store.version) store.version = VERSION;
    if (!store.sessions) store.sessions = {};

    store.sessions[sid] = {
      sid,
      completed: true,
      completedAt: new Date().toISOString(),
      score: Number(detail?.score || 0),
      skill: safe(detail?.skill || detail?.type || ''),
      difficulty: safe(detail?.difficulty || ''),
      cefr: safe(detail?.cefr || ''),
      itemId: safe(detail?.itemId || detail?.id || ''),
      durationSec: Number(detail?.sessionDurationSec || 0),
      durationLabel: safe(detail?.sessionDurationLabel || '')
    };

    store.lastCompletedSid = sid;
    store.lastCompletedAt = store.sessions[sid].completedAt;

    saveCompleted(store);

    return store.sessions[sid];
  }

  function passKey(detail) {
    return [
      currentSid(detail),
      safe(detail?.itemId || detail?.id || ''),
      safe(detail?.skill || detail?.type || ''),
      safe(detail?.answer || ''),
      safe(detail?.score || '')
    ].join('|');
  }

  function isDuplicatePass(detail) {
    const key = passKey(detail);
    const now = Date.now();

    if (key === state.lastPassKey && now - state.lastPassAt < CONFIG.debounceMs) {
      return true;
    }

    state.lastPassKey = key;
    state.lastPassAt = now;

    return false;
  }

  function ensureCSS() {
    if ($('#lesson-pass-next-flow-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-pass-next-flow-css';
    style.textContent = `
      #lessonPassNextToast {
        position: fixed;
        left: 50%;
        bottom: max(18px, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 2147483647;
        width: min(680px, calc(100vw - 24px));
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-radius: 24px;
        border: 2px solid rgba(34,197,94,.55);
        background: rgba(240,253,244,.96);
        color: #052e16;
        padding: 14px 16px;
        box-shadow: 0 24px 70px rgba(0,0,0,.34);
        font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      #lessonPassNextToast.show {
        display: flex;
      }

      .lesson-pass-next-main {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      .lesson-pass-next-title {
        font-size: 16px;
        font-weight: 1000;
      }

      .lesson-pass-next-sub {
        font-size: 13px;
        font-weight: 850;
        color: #166534;
      }

      .lesson-pass-next-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .lesson-pass-next-actions button {
        border: 0;
        border-radius: 999px;
        padding: 11px 14px;
        font-weight: 1000;
        cursor: pointer;
      }

      #lessonPassGoNextBtn {
        background: #22c55e;
        color: #052e16;
      }

      #lessonPassStayBtn {
        background: rgba(15,23,42,.10);
        color: #0f172a;
      }

      html.lesson-mode-cardboard #lessonPassNextToast {
        display: none !important;
      }

      @media (max-width: 640px) {
        #lessonPassNextToast {
          align-items: stretch;
          flex-direction: column;
          border-radius: 20px;
        }

        .lesson-pass-next-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureToast() {
    ensureCSS();

    let box = $('#lessonPassNextToast');

    if (!box) {
      box = document.createElement('div');
      box.id = 'lessonPassNextToast';
      box.innerHTML = `
        <div class="lesson-pass-next-main">
          <div class="lesson-pass-next-title" id="lessonPassNextTitle">ผ่านแล้ว</div>
          <div class="lesson-pass-next-sub" id="lessonPassNextSub">กำลังไปด่านถัดไป</div>
        </div>
        <div class="lesson-pass-next-actions">
          <button type="button" id="lessonPassStayBtn">อยู่หน้านี้</button>
          <button type="button" id="lessonPassGoNextBtn">ไปต่อ</button>
        </div>
      `;
      document.body.appendChild(box);
    }

    return box;
  }

  function hideOldRepeatUi() {
    // กันผู้เรียนกดทำซ้ำโดยไม่ตั้งใจหลังผ่านแล้ว
    try {
      const panel = $('#lessonMissionPanel');
      if (panel) {
        panel.style.pointerEvents = 'none';
        panel.style.opacity = '0.72';
      }
    } catch (err) {}

    try {
      const speaking = $('#lessonSpeakingPanel');
      if (speaking) {
        speaking.style.pointerEvents = 'none';
        speaking.style.opacity = '0.72';
      }
    } catch (err) {}
  }

  function showPassToast(detail) {
    const sid = currentSid(detail);
    const nextSid = nextSidOf(sid);
    const box = ensureToast();

    const title = $('#lessonPassNextTitle');
    const sub = $('#lessonPassNextSub');
    const goBtn = $('#lessonPassGoNextBtn');
    const stayBtn = $('#lessonPassStayBtn');

    if (title) {
      title.textContent = nextSid
        ? `✅ ผ่าน ${sid} แล้ว`
        : `🏆 ผ่าน S15 แล้ว`;
    }

    if (sub) {
      sub.textContent = nextSid
        ? `ไม่ต้องทำซ้ำ กำลังไป ${nextSid}`
        : 'จบครบ 15 Session แล้ว';
    }

    if (goBtn) {
      goBtn.textContent = nextSid ? `→ ไป ${nextSid}` : 'เลือก S1–S15';
      goBtn.onclick = () => {
        clearTimeout(state.nextTimer);

        if (nextSid) {
          location.href = buildUrlForSid(nextSid);
        } else if (window.LESSON_CLEAN_SESSION_BOARD_FIX?.open) {
          box.classList.remove('show');
          window.LESSON_CLEAN_SESSION_BOARD_FIX.open();
        }
      };
    }

    if (stayBtn) {
      stayBtn.onclick = () => {
        clearTimeout(state.nextTimer);
        box.classList.remove('show');

        const panel = $('#lessonMissionPanel');
        if (panel) {
          panel.style.pointerEvents = '';
          panel.style.opacity = '';
        }

        const speaking = $('#lessonSpeakingPanel');
        if (speaking) {
          speaking.style.pointerEvents = '';
          speaking.style.opacity = '';
        }
      };
    }

    box.classList.add('show');

    if (CONFIG.autoNext && !isAutoNextOff() && nextSid) {
      clearTimeout(state.nextTimer);
      state.nextTimer = setTimeout(() => {
        location.href = buildUrlForSid(nextSid);
      }, CONFIG.autoNextDelayMs);
    }
  }

  function handlePass(detail) {
    if (!detail) detail = {};

    const passed =
      detail.passed === true ||
      detail.correct === true ||
      detail.isCorrect === true ||
      Number(detail.score || 0) >= Number(detail.passScore || 70);

    if (!passed) return;
    if (isDuplicatePass(detail)) return;

    const completed = markCompleted(detail);

    try {
      if (!window.LESSON_CURRENT_STATE) window.LESSON_CURRENT_STATE = {};
      window.LESSON_CURRENT_STATE.lastCompletedSid = completed.sid;
      window.LESSON_CURRENT_STATE.lastCompletedAt = completed.completedAt;
      window.LESSON_CURRENT_STATE.sessionCompleted = true;
    } catch (err) {}

    hideOldRepeatUi();
    showPassToast(detail);

    console.log('[LessonPassNextFlow]', VERSION, {
      completed,
      nextSid: nextSidOf(completed.sid)
    });
  }

  function bindEvents() {
    window.addEventListener('lesson:mission-pass', (ev) => handlePass(ev.detail || {}));
    document.addEventListener('lesson:mission-pass', (ev) => handlePass(ev.detail || {}));

    window.addEventListener('lesson:item-result', (ev) => {
      const d = ev.detail || {};
      if (d.passed === true) handlePass(d);
    });

    document.addEventListener('lesson:item-result', (ev) => {
      const d = ev.detail || {};
      if (d.passed === true) handlePass(d);
    });
  }

  function boot() {
    ensureCSS();
    bindEvents();

    window.LESSON_PASS_NEXT_FLOW_FIX = {
      version: VERSION,
      config: CONFIG,
      handlePass,
      getCompleted: loadCompleted,
      goNext() {
        const sid = currentSid();
        const nextSid = nextSidOf(sid);
        if (nextSid) location.href = buildUrlForSid(nextSid);
      },
      disableAuto() {
        CONFIG.autoNext = false;
      },
      enableAuto() {
        CONFIG.autoNext = true;
      }
    };

    console.log('[LessonPassNextFlow]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();