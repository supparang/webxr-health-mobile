// === /english/js/lesson-clean-session-board-fix.js ===
// PATCH v20260426a-LESSON-CLEAN-SESSION-BOARD
// Replace unreadable 3D S selector with clean HTML session board.
// ✅ Clear S1-S15 selection
// ✅ Shows skill / boss / CEFR plan
// ✅ Routes to new Mission Panel flow
// ✅ Hides confusing scene pan controls
// ✅ Disables accidental old 3D selector clicks on PC/Mobile
// ✅ Keeps Cardboard scene untouched

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-CLEAN-SESSION-BOARD';

  const SESSIONS = [
    { sid: 'S1',  title: 'Self Introduction in Tech',      skill: 'speaking',  cefr: 'A2',  boss: false },
    { sid: 'S2',  title: 'Academic Background',            skill: 'listening', cefr: 'A2+', boss: false },
    { sid: 'S3',  title: 'Boss 1 — Intro + Background',    skill: 'boss',      cefr: 'A2+', boss: true  },

    { sid: 'S4',  title: 'Tech Jobs and Roles',            skill: 'reading',   cefr: 'A2+', boss: false },
    { sid: 'S5',  title: 'Emails and Chat',                skill: 'writing',   cefr: 'A2+', boss: false },
    { sid: 'S6',  title: 'Boss 2 — Workplace Basics',      skill: 'boss',      cefr: 'B1',  boss: true  },

    { sid: 'S7',  title: 'Explaining a System',            skill: 'speaking',  cefr: 'B1',  boss: false },
    { sid: 'S8',  title: 'Problems and Bugs',              skill: 'reading',   cefr: 'B1',  boss: false },
    { sid: 'S9',  title: 'Boss 3 — Team Stand-up',         skill: 'boss',      cefr: 'B1+', boss: true  },

    { sid: 'S10', title: 'Client Communication',           skill: 'listening', cefr: 'B1',  boss: false },
    { sid: 'S11', title: 'Data and AI Communication',      skill: 'writing',   cefr: 'B1',  boss: false },
    { sid: 'S12', title: 'Boss 4 — Client + AI',           skill: 'boss',      cefr: 'B1+', boss: true  },

    { sid: 'S13', title: 'Job Interview',                  skill: 'speaking',  cefr: 'B1',  boss: false },
    { sid: 'S14', title: 'Project Pitch',                  skill: 'speaking',  cefr: 'B1+', boss: false },
    { sid: 'S15', title: 'Final Boss — Career Mission',    skill: 'finalBoss', cefr: 'B1+', boss: true  }
  ];

  const state = {
    open: false,
    filter: 'all'
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
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

  function getViewMode() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    const ds = document.documentElement.dataset.lessonViewMode;
    if (ds) return ds;

    const view = safe(q().get('view')).toLowerCase();

    if (['vr', 'cvr', 'cardboard', 'cardboard-vr'].includes(view)) return 'cardboard';
    if (['mobile', 'phone'].includes(view)) return 'mobile';

    return 'pc';
  }

  function skillIcon(skill) {
    if (skill === 'listening') return '🎧';
    if (skill === 'speaking') return '🎤';
    if (skill === 'reading') return '📖';
    if (skill === 'writing') return '✍️';
    if (skill === 'boss') return '👑';
    if (skill === 'finalBoss') return '🏆';
    return '⭐';
  }

  function skillLabel(skill) {
    if (skill === 'listening') return 'Listening';
    if (skill === 'speaking') return 'Speaking';
    if (skill === 'reading') return 'Reading';
    if (skill === 'writing') return 'Writing';
    if (skill === 'boss') return 'Boss';
    if (skill === 'finalBoss') return 'Final Boss';
    return skill || 'Mission';
  }

  function buildUrlForSid(sid) {
    sid = normalizeSid(sid);

    const url = new URL(location.href);

    url.searchParams.set('s', String(sidNumber(sid)));
    url.searchParams.set('sid', sid);
    url.searchParams.set('ai', 'auto');

    if (!url.searchParams.get('view')) {
      url.searchParams.set('view', getViewMode());
    }

    [
      'skill',
      'stage',
      'mission',
      'type',
      'old',
      'native',
      'question',
      'prompt',
      'modeSkill'
    ].forEach((k) => url.searchParams.delete(k));

    url.searchParams.delete('difficulty');
    url.searchParams.delete('level');
    url.searchParams.delete('diff');

    return url.toString();
  }

  function goSid(sid) {
    sid = normalizeSid(sid);

    try {
      sessionStorage.setItem('TECHPATH_LAST_CLEAN_SELECTED_SID', sid);
    } catch (err) {}

    location.href = buildUrlForSid(sid);
  }

  function ensureCSS() {
    if ($('#lesson-clean-session-board-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-clean-session-board-css';
    style.textContent = `
      #lessonCleanSessionBtn {
        position: fixed;
        left: 16px;
        top: max(14px, env(safe-area-inset-top));
        z-index: 2147483647;
        border: 1px solid rgba(125,211,252,.65);
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(8,18,38,.95);
        color: #e0faff;
        font: 1000 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow: 0 16px 42px rgba(0,0,0,.34);
        cursor: pointer;
      }

      #lessonCleanSessionOverlay {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: none;
        background:
          radial-gradient(circle at top left, rgba(14,165,233,.24), transparent 34%),
          rgba(2,6,23,.74);
        backdrop-filter: blur(7px);
        color: #eaf6ff;
        font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      #lessonCleanSessionOverlay.open {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }

      .lesson-clean-board {
        width: min(980px, 96vw);
        max-height: min(88vh, 820px);
        overflow: auto;
        border-radius: 30px;
        border: 1px solid rgba(125,211,252,.35);
        background: linear-gradient(180deg, rgba(15,23,42,.97), rgba(15,23,42,.92));
        box-shadow: 0 28px 90px rgba(0,0,0,.48);
      }

      .lesson-clean-head {
        position: sticky;
        top: 0;
        z-index: 2;
        display: grid;
        gap: 12px;
        padding: 18px;
        background: rgba(15,23,42,.98);
        border-bottom: 1px solid rgba(125,211,252,.20);
      }

      .lesson-clean-title-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 14px;
      }

      .lesson-clean-title {
        font-size: 24px;
        line-height: 1.15;
        font-weight: 1000;
        color: #7df2ff;
        letter-spacing: .02em;
      }

      .lesson-clean-sub {
        margin-top: 4px;
        color: #b7d4e8;
        font-size: 13px;
        font-weight: 800;
      }

      .lesson-clean-close {
        border: 0;
        border-radius: 999px;
        padding: 10px 12px;
        background: rgba(255,255,255,.12);
        color: #eaf6ff;
        font-weight: 1000;
        cursor: pointer;
      }

      .lesson-clean-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .lesson-clean-filter {
        border: 1px solid rgba(125,211,252,.25);
        border-radius: 999px;
        padding: 8px 11px;
        background: rgba(255,255,255,.08);
        color: #dff7ff;
        font-size: 12px;
        font-weight: 1000;
        cursor: pointer;
      }

      .lesson-clean-filter.active {
        background: #0ea5e9;
        color: white;
        border-color: rgba(255,255,255,.35);
      }

      .lesson-clean-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        padding: 18px;
      }

      .lesson-session-card {
        position: relative;
        min-height: 138px;
        display: grid;
        align-content: space-between;
        gap: 12px;
        border: 1px solid rgba(125,211,252,.22);
        border-radius: 22px;
        padding: 14px;
        background:
          radial-gradient(circle at top right, rgba(14,165,233,.18), transparent 38%),
          rgba(30,41,59,.78);
        color: #eaf6ff;
        cursor: pointer;
        text-align: left;
        box-shadow: 0 12px 28px rgba(0,0,0,.20);
      }

      .lesson-session-card:hover {
        transform: translateY(-1px);
        border-color: rgba(125,211,252,.64);
        background:
          radial-gradient(circle at top right, rgba(14,165,233,.28), transparent 38%),
          rgba(30,41,59,.92);
      }

      .lesson-session-card.current {
        outline: 3px solid rgba(34,211,238,.35);
        border-color: #22d3ee;
      }

      .lesson-session-card.boss {
        background:
          radial-gradient(circle at top right, rgba(250,204,21,.22), transparent 40%),
          rgba(42,37,20,.82);
        border-color: rgba(250,204,21,.36);
      }

      .lesson-session-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .lesson-session-sid {
        font-size: 20px;
        font-weight: 1000;
        color: #7df2ff;
      }

      .lesson-session-card.boss .lesson-session-sid {
        color: #fde68a;
      }

      .lesson-session-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border-radius: 999px;
        padding: 5px 8px;
        background: rgba(255,255,255,.12);
        color: #e0faff;
        font-size: 11px;
        font-weight: 1000;
        white-space: nowrap;
      }

      .lesson-session-title {
        color: #ffffff;
        font-size: 15px;
        font-weight: 1000;
        line-height: 1.25;
      }

      .lesson-session-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .lesson-session-chip {
        border-radius: 999px;
        padding: 5px 8px;
        background: rgba(255,255,255,.10);
        color: #cdeeff;
        font-size: 11px;
        font-weight: 900;
      }

      .lesson-clean-foot {
        padding: 0 18px 18px;
        color: #b7d4e8;
        font-size: 12px;
        font-weight: 800;
      }

      body.lesson-clean-board-open {
        overflow: hidden;
      }

      /* Hide old scene pan controls because clean board replaces scene scrolling. */
      #lessonScenePanControls {
        display: none !important;
      }

      html.lesson-mode-cardboard #lessonCleanSessionBtn,
      html.lesson-mode-cardboard #lessonCleanSessionOverlay {
        display: none !important;
      }

      @media (max-width: 900px) {
        .lesson-clean-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 620px) {
        #lessonCleanSessionBtn {
          left: 10px;
          top: 10px;
          padding: 9px 11px;
          font-size: 13px;
        }

        #lessonCleanSessionOverlay.open {
          padding: 10px;
        }

        .lesson-clean-board {
          border-radius: 22px;
          max-height: 92vh;
        }

        .lesson-clean-title {
          font-size: 20px;
        }

        .lesson-clean-grid {
          grid-template-columns: 1fr;
          padding: 12px;
        }

        .lesson-clean-head {
          padding: 14px;
        }

        .lesson-session-card {
          min-height: 116px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function disableOldScenePointerOnPc() {
    if (getViewMode() === 'cardboard') return;

    const scene = $('a-scene');
    if (!scene) return;

    // Prevent accidental clicks on the unreadable old scene selector.
    // Clean board is now the reliable selector.
    try {
      scene.style.pointerEvents = 'none';
      scene.setAttribute('data-clean-board-pointer-disabled', VERSION);
    } catch (err) {}
  }

  function ensureButton() {
    if ($('#lessonCleanSessionBtn')) return;

    ensureCSS();

    const btn = document.createElement('button');
    btn.id = 'lessonCleanSessionBtn';
    btn.type = 'button';
    btn.textContent = '☰ เลือก S1–S15';

    document.body.appendChild(btn);

    btn.addEventListener('click', openBoard);
  }

  function ensureOverlay() {
    if ($('#lessonCleanSessionOverlay')) return;

    ensureCSS();

    const overlay = document.createElement('div');
    overlay.id = 'lessonCleanSessionOverlay';
    overlay.innerHTML = `
      <section class="lesson-clean-board" role="dialog" aria-modal="true" aria-label="เลือก Session S1-S15">
        <div class="lesson-clean-head">
          <div class="lesson-clean-title-row">
            <div>
              <div class="lesson-clean-title">TECHPATH SESSION MAP</div>
              <div class="lesson-clean-sub">เลือก S1–S15 แบบอ่านง่าย แล้วเข้า Mission Panel ใหม่</div>
            </div>
            <button type="button" class="lesson-clean-close" id="lessonCleanCloseBtn">ปิด</button>
          </div>

          <div class="lesson-clean-filters" id="lessonCleanFilters">
            <button type="button" class="lesson-clean-filter active" data-filter="all">ทั้งหมด</button>
            <button type="button" class="lesson-clean-filter" data-filter="listening">🎧 Listening</button>
            <button type="button" class="lesson-clean-filter" data-filter="speaking">🎤 Speaking</button>
            <button type="button" class="lesson-clean-filter" data-filter="reading">📖 Reading</button>
            <button type="button" class="lesson-clean-filter" data-filter="writing">✍️ Writing</button>
            <button type="button" class="lesson-clean-filter" data-filter="boss">👑 Boss</button>
          </div>
        </div>

        <div class="lesson-clean-grid" id="lessonCleanGrid"></div>

        <div class="lesson-clean-foot">
          หมายเหตุ: ทุก 3 Session เป็น Boss Mission และระบบ AI Difficulty จะเลือกระดับ Easy / Normal / Hard / Challenge ตามผลการเล่น
        </div>
      </section>
    `;

    document.body.appendChild(overlay);

    $('#lessonCleanCloseBtn')?.addEventListener('click', closeBoard);

    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) closeBoard();
    });

    $all('.lesson-clean-filter', overlay).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter || 'all';

        $all('.lesson-clean-filter', overlay).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        renderGrid();
      });
    });

    renderGrid();
  }

  function filteredSessions() {
    if (state.filter === 'all') return SESSIONS;

    if (state.filter === 'boss') {
      return SESSIONS.filter(s => s.boss || s.skill === 'boss' || s.skill === 'finalBoss');
    }

    return SESSIONS.filter(s => s.skill === state.filter);
  }

  function renderGrid() {
    const grid = $('#lessonCleanGrid');
    if (!grid) return;

    const cur = currentSid();

    grid.innerHTML = '';

    filteredSessions().forEach((s) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = [
        'lesson-session-card',
        s.sid === cur ? 'current' : '',
        s.boss ? 'boss' : ''
      ].filter(Boolean).join(' ');

      card.innerHTML = `
        <div>
          <div class="lesson-session-top">
            <div class="lesson-session-sid">${s.sid}</div>
            <div class="lesson-session-badge">${skillIcon(s.skill)} ${skillLabel(s.skill)}</div>
          </div>

          <div class="lesson-session-title">${escapeHtml(s.title)}</div>
        </div>

        <div class="lesson-session-meta">
          <span class="lesson-session-chip">${escapeHtml(s.cefr)}</span>
          <span class="lesson-session-chip">AI Difficulty</span>
          ${s.boss ? '<span class="lesson-session-chip">Boss Checkpoint</span>' : ''}
          ${s.sid === cur ? '<span class="lesson-session-chip">กำลังเลือกอยู่</span>' : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        goSid(s.sid);
      });

      grid.appendChild(card);
    });
  }

  function escapeHtml(text) {
    return safe(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function openBoard() {
    ensureOverlay();

    const overlay = $('#lessonCleanSessionOverlay');
    if (!overlay) return;

    state.open = true;
    overlay.classList.add('open');
    document.body.classList.add('lesson-clean-board-open');

    renderGrid();
  }

  function closeBoard() {
    const overlay = $('#lessonCleanSessionOverlay');
    if (!overlay) return;

    state.open = false;
    overlay.classList.remove('open');
    document.body.classList.remove('lesson-clean-board-open');
  }

  function interceptOldPickerButton() {
    const oldBtn = $('#lessonPcSessionOpenBtn');

    if (!oldBtn || oldBtn.dataset.cleanBoardIntercepted === VERSION) return;

    oldBtn.dataset.cleanBoardIntercepted = VERSION;

    oldBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (typeof ev.stopImmediatePropagation === 'function') {
        ev.stopImmediatePropagation();
      }

      openBoard();
    }, true);
  }

  function boot() {
    if (getViewMode() === 'cardboard') {
      console.log('[LessonCleanSessionBoard]', VERSION, 'cardboard skip');
      return;
    }

    ensureCSS();
    ensureButton();
    ensureOverlay();
    interceptOldPickerButton();
    disableOldScenePointerOnPc();

    setTimeout(() => {
      interceptOldPickerButton();
      disableOldScenePointerOnPc();
    }, 500);

    setTimeout(() => {
      interceptOldPickerButton();
      disableOldScenePointerOnPc();
    }, 1500);

    setTimeout(() => {
      interceptOldPickerButton();
      disableOldScenePointerOnPc();
    }, 3000);

    [
      'lesson:view-mode-ready',
      'lesson:router-ready',
      'lesson:data-skill-ready',
      'lesson:item-ready'
    ].forEach((name) => {
      window.addEventListener(name, () => {
        renderGrid();
        interceptOldPickerButton();
        disableOldScenePointerOnPc();
      });

      document.addEventListener(name, () => {
        renderGrid();
        interceptOldPickerButton();
        disableOldScenePointerOnPc();
      });
    });

    window.LESSON_CLEAN_SESSION_BOARD_FIX = {
      version: VERSION,
      open: openBoard,
      close: closeBoard,
      goSid,
      buildUrlForSid,
      sessions: SESSIONS,
      state
    };

    console.log('[LessonCleanSessionBoard]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
