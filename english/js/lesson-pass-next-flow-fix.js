// === /english/js/lesson-pass-next-flow-fix.js ===
// PATCH v20260426b-LESSON-PASS-NEXT-FLOW-ROBUST
// Fix: correct answer stays on same S and does not go next.
// ✅ One correct/pass = clear current S
// ✅ Works with lesson:item-result / writing-result / speaking-result / listening-result
// ✅ Also detects old "Correct!" toast / SCORE 100 fallback
// ✅ Saves completion per S
// ✅ Shows clear "ไป S ถัดไป"
// ✅ Auto-next to next S after short delay
// ✅ Prevents repeat same S after correct answer

(function () {
  'use strict';

  const VERSION = 'v20260426b-LESSON-PASS-NEXT-FLOW-ROBUST';
  const COMPLETE_KEY = 'TECHPATH_SESSION_COMPLETED_V1';

  const CONFIG = {
    autoNext: true,
    autoNextDelayMs: 950,
    debounceMs: 1400,
    observeCorrectToast: true
  };

  const state = {
    lastPassKey: '',
    lastPassAt: 0,
    nextTimer: 0,
    observer: null,
    lastDomCorrectAt: 0
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

  function currentSkill(detail) {
    if (detail && (detail.skill || detail.type)) {
      return safe(detail.skill || detail.type).toLowerCase();
    }

    try {
      const st = window.LESSON_MISSION_PANEL_FIX?.getState?.();
      const skill = safe(st?.skill || st?.item?.skill || st?.type || st?.item?.type).toLowerCase();
      if (skill) return skill;
    } catch (err) {}

    const text = safe(
      $('#lessonMissionPanel')?.innerText ||
      $('#lessonSpeakingPanel')?.innerText ||
      ''
    ).toLowerCase();

    if (text.includes('writing')) return 'writing';
    if (text.includes('speaking')) return 'speaking';
    if (text.includes('listening')) return 'listening';
    if (text.includes('reading')) return 'reading';

    return '';
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

  function getTimerInfo() {
    try {
      const sec = Number(window.LESSON_SESSION_TIMER_FIX?.elapsedSec?.() || 0);
      const label = window.LESSON_SESSION_TIMER_FIX?.formatTime?.(sec) || '';
      return { sec, label };
    } catch (err) {
      return { sec: 0, label: '' };
    }
  }

  function makeInferredDetail(reason) {
    const timer = getTimerInfo();

    return {
      version: VERSION,
      sid: currentSid(),
      skill: currentSkill(),
      type: currentSkill(),
      passed: true,
      correct: true,
      isCorrect: true,
      score: 100,
      passScore: 70,
      reason: reason || 'inferred_correct',
      sessionDurationSec: timer.sec,
      sessionDurationLabel: timer.label
    };
  }

  function isPassDetail(detail) {
    const d = detail || {};

    if (d.passed === true) return true;
    if (d.correct === true) return true;
    if (d.isCorrect === true) return true;
    if (safe(d.result).toLowerCase() === 'correct') return true;
    if (safe(d.status).toLowerCase() === 'correct') return true;

    const score = Number(d.score || d.percent || d.accuracy || 0);
    const passScore = Number(d.passScore || d.pass_score || 70);

    if (score >= passScore && score > 0) return true;
    if (score >= 100) return true;

    return false;
  }

  function markCompleted(detail) {
    const sid = currentSid(detail);
    const timer = getTimerInfo();
    const store = loadCompleted();

    if (!store.version) store.version = VERSION;
    if (!store.sessions) store.sessions = {};

    store.sessions[sid] = {
      sid,
      completed: true,
      completedAt: new Date().toISOString(),
      score: Number(detail?.score || 100),
      skill: safe(detail?.skill || detail?.type || currentSkill(detail)),
      difficulty: safe(detail?.difficulty || ''),
      cefr: safe(detail?.cefr || ''),
      itemId: safe(detail?.itemId || detail?.id || ''),
      durationSec: Number(detail?.sessionDurationSec || timer.sec || 0),
      durationLabel: safe(detail?.sessionDurationLabel || timer.label || ''),
      reason: safe(detail?.reason || 'pass')
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
      safe(detail?.skill || detail?.type || currentSkill(detail)),
      safe(detail?.answer || ''),
      safe(detail?.score || '100'),
      safe(detail?.reason || '')
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
        background: rgba(240,253,244,.97);
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

  function freezeOldRepeatUi() {
    try {
      const panel = $('#lessonMissionPanel');
      if (panel) {
        panel.style.pointerEvents = 'none';
        panel.style.opacity = '0.70';
      }
    } catch (err) {}

    try {
      const speaking = $('#lessonSpeakingPanel');
      if (speaking) {
        speaking.style.pointerEvents = 'none';
        speaking.style.opacity = '0.70';
      }
    } catch (err) {}
  }

  function unfreezeOldRepeatUi() {
    try {
      const panel = $('#lessonMissionPanel');
      if (panel) {
        panel.style.pointerEvents = '';
        panel.style.opacity = '';
      }
    } catch (err) {}

    try {
      const speaking = $('#lessonSpeakingPanel');
      if (speaking) {
        speaking.style.pointerEvents = '';
        speaking.style.opacity = '';
      }
    } catch (err) {}
  }

  function fireNormalizedPass(detail) {
    const d = Object.assign({}, detail || {});
    d.sid = currentSid(d);
    d.skill = d.skill || d.type || currentSkill(d);
    d.type = d.type || d.skill || currentSkill(d);
    d.passed = true;
    d.correct = true;
    d.isCorrect = true;
    d.score = Number(d.score || 100);
    d.passScore = Number(d.passScore || 70);
    d.normalizedBy = VERSION;

    try {
      window.dispatchEvent(new CustomEvent('lesson:pass-next-normalized', { detail: d }));
      document.dispatchEvent(new CustomEvent('lesson:pass-next-normalized', { detail: d }));
    } catch (err) {}

    return d;
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
        unfreezeOldRepeatUi();
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

  function handlePass(detail, source) {
    const raw = detail || {};

    if (!isPassDetail(raw)) return;

    const normalized = fireNormalizedPass(Object.assign({}, raw, {
      reason: raw.reason || source || 'pass'
    }));

    if (isDuplicatePass(normalized)) return;

    const completed = markCompleted(normalized);

    try {
      if (!window.LESSON_CURRENT_STATE) window.LESSON_CURRENT_STATE = {};
      window.LESSON_CURRENT_STATE.lastCompletedSid = completed.sid;
      window.LESSON_CURRENT_STATE.lastCompletedAt = completed.completedAt;
      window.LESSON_CURRENT_STATE.sessionCompleted = true;
    } catch (err) {}

    freezeOldRepeatUi();
    showPassToast(normalized);

    console.log('[LessonPassNextFlow]', VERSION, {
      source,
      completed,
      nextSid: nextSidOf(completed.sid)
    });
  }

  function detectCorrectFromDom(reason) {
    if (!CONFIG.observeCorrectToast) return;

    const now = Date.now();

    if (now - state.lastDomCorrectAt < CONFIG.debounceMs) return;

    const bodyText = safe(document.body?.innerText || document.body?.textContent || '');

    const hasCorrect =
      /correct!/i.test(bodyText) ||
      /✅\s*correct/i.test(bodyText) ||
      /ถูกต้อง/i.test(bodyText) ||
      /ผ่านด่านนี้แล้ว/i.test(bodyText);

    if (!hasCorrect) return;

    const scoreText = safe($('#lessonScoreText')?.textContent || '');
    const hasScore100 = /100/.test(scoreText) || /score\s*100/i.test(bodyText);

    if (!hasScore100 && !/ผ่านด่านนี้แล้ว|ถูกต้อง/i.test(bodyText)) return;

    state.lastDomCorrectAt = now;

    handlePass(makeInferredDetail(reason || 'dom_correct_detected'), reason || 'dom_correct_detected');
  }

  function observeCorrectDom() {
    if (!CONFIG.observeCorrectToast) return;
    if (state.observer) return;

    try {
      state.observer = new MutationObserver(() => {
        setTimeout(() => detectCorrectFromDom('mutation_correct_detected'), 80);
      });

      state.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    } catch (err) {}
  }

  function bindEvents() {
    const resultEvents = [
      'lesson:mission-pass',
      'lesson:item-result',
      'lesson:writing-result',
      'lesson:speaking-result',
      'lesson:listening-result',
      'lesson:reading-result',
      'lesson:choice-result',
      'lesson:answer-result',
      'lesson:correct',
      'lesson:pass'
    ];

    resultEvents.forEach((name) => {
      window.addEventListener(name, (ev) => handlePass(ev.detail || {}, name));
      document.addEventListener(name, (ev) => handlePass(ev.detail || {}, `document:${name}`));
    });

    window.addEventListener('click', () => {
      setTimeout(() => detectCorrectFromDom('click_after_correct'), 180);
      setTimeout(() => detectCorrectFromDom('click_after_correct_late'), 650);
    }, true);
  }

  function boot() {
    ensureCSS();
    bindEvents();
    observeCorrectDom();

    setTimeout(() => detectCorrectFromDom('boot_check'), 900);

    window.LESSON_PASS_NEXT_FLOW_FIX = {
      version: VERSION,
      config: CONFIG,
      handlePass,
      detectCorrectFromDom,
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
