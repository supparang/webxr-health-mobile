// === /english/js/lesson-pc-session-picker-fix.js ===
// PATCH v20260424i-LESSON-PC-SESSION-PICKER-FIX
// Fix PC mode: S1-S15 selector hidden/blocked by 3D scene.
// Adds clear HTML overlay session picker above A-Frame.

(function () {
  'use strict';

  const VERSION = 'v20260424i-LESSON-PC-SESSION-PICKER-FIX';

  const FALLBACK_ROUTES = {
    S1:  { skill: 'speaking',  boss: false, title: 'Self-Introduction in Tech' },
    S2:  { skill: 'listening', boss: false, title: 'Academic Background and Projects' },
    S3:  { skill: 'boss',      boss: true,  title: 'Boss 1' },
    S4:  { skill: 'reading',   boss: false, title: 'Tech Jobs and Roles' },
    S5:  { skill: 'writing',   boss: false, title: 'Emails and Chat' },
    S6:  { skill: 'boss',      boss: true,  title: 'Boss 2' },
    S7:  { skill: 'speaking',  boss: false, title: 'Explaining a System' },
    S8:  { skill: 'reading',   boss: false, title: 'Describing Problems and Bugs' },
    S9:  { skill: 'boss',      boss: true,  title: 'Boss 3' },
    S10: { skill: 'listening', boss: false, title: 'Client Communication' },
    S11: { skill: 'writing',   boss: false, title: 'Data and AI Communication' },
    S12: { skill: 'boss',      boss: true,  title: 'Boss 4' },
    S13: { skill: 'speaking',  boss: false, title: 'Job Interview' },
    S14: { skill: 'speaking',  boss: false, title: 'Project Pitch' },
    S15: { skill: 'finalBoss', boss: true,  title: 'Final Boss' }
  };

  const SKILL_TH = {
    speaking: 'พูด',
    listening: 'ฟัง',
    reading: 'อ่าน',
    writing: 'เขียน',
    boss: 'Boss',
    finalBoss: 'Final Boss'
  };

  const SKILL_ICON = {
    speaking: '🎤',
    listening: '🎧',
    reading: '📖',
    writing: '✍️',
    boss: '👾',
    finalBoss: '🏆'
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
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

  function currentView() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    const view = safe(q().get('view') || '').toLowerCase();
    if (['vr', 'cvr', 'cardboard', 'cardboard-vr'].includes(view)) return 'cardboard';
    if (['mobile', 'phone'].includes(view)) return 'mobile';
    return 'pc';
  }

  function currentDiff() {
    const p = q();

    try {
      const sid = currentSid();
      const d = window.LESSON_ROUTER?.getRecommendedDifficulty?.(sid);
      if (d) return d;
    } catch (err) {}

    return p.get('diff') || p.get('difficulty') || 'normal';
  }

  function routes() {
    try {
      if (window.LESSON_ROUTE) return window.LESSON_ROUTE;
      if (window.LESSON_ROUTER?.routes) return window.LESSON_ROUTER.routes;
    } catch (err) {}

    return FALLBACK_ROUTES;
  }

  function makeUrlForSession(sid, diff) {
    const n = parseInt(String(sid).replace('S', ''), 10) || 1;
    const url = new URL(location.href);

    url.searchParams.set('s', String(n));
    url.searchParams.set('sid', sid);
    url.searchParams.set('diff', diff || currentDiff());
    url.searchParams.set('view', currentView() || 'pc');

    // สำคัญ: ให้ router/data เป็นคนตัดสิน skill ตาม S
    url.searchParams.delete('skill');
    url.searchParams.delete('stage');
    url.searchParams.delete('mission');
    url.searchParams.delete('type');

    return url.toString();
  }

  function ensureCSS() {
    if ($('#lesson-pc-session-picker-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-pc-session-picker-css';
    style.textContent = `
      #lessonPcSessionOpenBtn{
        position:fixed;
        left:16px;
        top:max(14px, env(safe-area-inset-top));
        z-index:2147483646;
        border:1px solid rgba(125,211,252,.65);
        border-radius:999px;
        padding:10px 14px;
        background:rgba(8,18,38,.92);
        color:#e0faff;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-weight:1000;
        cursor:pointer;
        box-shadow:0 14px 36px rgba(0,0,0,.34);
        backdrop-filter:blur(10px);
      }

      #lessonPcSessionOpenBtn:hover{
        transform:translateY(-1px);
        background:rgba(14,35,70,.96);
      }

      #lessonPcSessionOverlay{
        position:fixed;
        inset:0;
        z-index:2147483647;
        display:none;
        align-items:center;
        justify-content:center;
        padding:20px;
        background:rgba(2,6,23,.68);
        backdrop-filter:blur(10px);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      #lessonPcSessionOverlay.show{
        display:flex;
      }

      .lesson-pc-session-card{
        width:min(1040px, 96vw);
        max-height:92vh;
        overflow:auto;
        border-radius:28px;
        background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(30,41,59,.98));
        color:#f8fafc;
        border:1px solid rgba(125,211,252,.35);
        box-shadow:0 24px 80px rgba(0,0,0,.55);
      }

      .lesson-pc-session-head{
        position:sticky;
        top:0;
        z-index:2;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:18px 20px;
        background:linear-gradient(90deg,rgba(8,145,178,.98),rgba(37,99,235,.98));
        border-bottom:1px solid rgba(255,255,255,.18);
      }

      .lesson-pc-session-title{
        font-size:22px;
        font-weight:1000;
        letter-spacing:.02em;
      }

      .lesson-pc-session-sub{
        margin-top:3px;
        color:#dff7ff;
        font-size:13px;
        font-weight:800;
      }

      #lessonPcSessionCloseBtn{
        border:0;
        border-radius:999px;
        padding:10px 14px;
        cursor:pointer;
        background:#fff;
        color:#0f172a;
        font-weight:1000;
      }

      .lesson-pc-session-toolbar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        flex-wrap:wrap;
        gap:10px;
        padding:14px 18px;
        border-bottom:1px solid rgba(255,255,255,.12);
      }

      .lesson-pc-session-chipgroup{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .lesson-pc-diff-btn{
        border:1px solid rgba(125,211,252,.35);
        border-radius:999px;
        padding:8px 12px;
        cursor:pointer;
        background:rgba(15,23,42,.76);
        color:#e0faff;
        font-weight:900;
      }

      .lesson-pc-diff-btn.active{
        background:#22d3ee;
        color:#082f49;
        border-color:#67e8f9;
      }

      .lesson-pc-session-grid{
        display:grid;
        grid-template-columns:repeat(5, minmax(120px, 1fr));
        gap:12px;
        padding:18px;
      }

      .lesson-pc-session-item{
        position:relative;
        min-height:132px;
        padding:14px;
        border:1px solid rgba(125,211,252,.24);
        border-radius:22px;
        background:rgba(15,23,42,.76);
        color:#f8fafc;
        cursor:pointer;
        text-align:left;
        box-shadow:0 12px 28px rgba(0,0,0,.22);
      }

      .lesson-pc-session-item:hover{
        transform:translateY(-2px);
        border-color:rgba(34,211,238,.75);
        background:rgba(15,23,42,.92);
      }

      .lesson-pc-session-item.current{
        outline:3px solid #22c55e;
        border-color:#86efac;
      }

      .lesson-pc-session-item.boss{
        background:linear-gradient(180deg,rgba(88,28,135,.92),rgba(30,41,59,.92));
        border-color:rgba(216,180,254,.5);
      }

      .lesson-pc-session-no{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        font-size:22px;
        font-weight:1000;
        color:#67e8f9;
      }

      .lesson-pc-session-skill{
        display:inline-flex;
        align-items:center;
        gap:5px;
        margin-top:10px;
        padding:5px 8px;
        border-radius:999px;
        background:rgba(255,255,255,.12);
        color:#fff;
        font-size:12px;
        font-weight:1000;
      }

      .lesson-pc-session-name{
        margin-top:10px;
        color:#e2e8f0;
        font-size:13px;
        font-weight:800;
        line-height:1.3;
      }

      .lesson-pc-session-current{
        position:absolute;
        right:10px;
        bottom:10px;
        padding:4px 8px;
        border-radius:999px;
        background:#22c55e;
        color:#052e16;
        font-size:11px;
        font-weight:1000;
      }

      html.lesson-mode-cardboard #lessonPcSessionOpenBtn,
      html.lesson-mode-cardboard #lessonPcSessionOverlay{
        display:none !important;
      }

      @media (max-width:820px){
        .lesson-pc-session-grid{
          grid-template-columns:repeat(3, minmax(100px, 1fr));
        }
      }

      @media (max-width:560px){
        #lessonPcSessionOpenBtn{
          left:10px;
          top:10px;
          padding:8px 10px;
          font-size:12px;
        }

        .lesson-pc-session-grid{
          grid-template-columns:repeat(2, minmax(100px, 1fr));
          padding:12px;
        }

        .lesson-pc-session-title{
          font-size:18px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePicker() {
    ensureCSS();

    let btn = $('#lessonPcSessionOpenBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'lessonPcSessionOpenBtn';
      btn.type = 'button';
      btn.textContent = '☰ เลือก S1–S15';
      document.body.appendChild(btn);
      btn.addEventListener('click', openPicker);
    }

    let overlay = $('#lessonPcSessionOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lessonPcSessionOverlay';
      overlay.innerHTML = `
        <div class="lesson-pc-session-card" role="dialog" aria-modal="true">
          <div class="lesson-pc-session-head">
            <div>
              <div class="lesson-pc-session-title">เลือกด่าน S1–S15</div>
              <div class="lesson-pc-session-sub">PC Mode: เลือกจากเมนูนี้แทนการกดวัตถุในฉาก 3D</div>
            </div>
            <button id="lessonPcSessionCloseBtn" type="button">ปิด</button>
          </div>

          <div class="lesson-pc-session-toolbar">
            <div class="lesson-pc-session-chipgroup">
              <button class="lesson-pc-diff-btn" data-diff="easy" type="button">Easy A2</button>
              <button class="lesson-pc-diff-btn" data-diff="normal" type="button">Normal A2+</button>
              <button class="lesson-pc-diff-btn" data-diff="hard" type="button">Hard B1</button>
              <button class="lesson-pc-diff-btn" data-diff="expert" type="button">Expert B1+</button>
            </div>
            <div id="lessonPcSessionNow" style="font-weight:900;color:#bae6fd;"></div>
          </div>

          <div class="lesson-pc-session-grid" id="lessonPcSessionGrid"></div>
        </div>
      `;

      document.body.appendChild(overlay);

      $('#lessonPcSessionCloseBtn')?.addEventListener('click', closePicker);

      overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) closePicker();
      });

      overlay.querySelectorAll('.lesson-pc-diff-btn').forEach((dBtn) => {
        dBtn.addEventListener('click', function () {
          overlay.dataset.diff = dBtn.dataset.diff || 'normal';
          renderPicker();
        });
      });
    }

    renderPicker();
  }

  function renderPicker() {
    const overlay = $('#lessonPcSessionOverlay');
    const grid = $('#lessonPcSessionGrid');
    const now = $('#lessonPcSessionNow');

    if (!overlay || !grid) return;

    const sidNow = currentSid();
    const diffNow = overlay.dataset.diff || currentDiff();

    overlay.dataset.diff = diffNow;

    overlay.querySelectorAll('.lesson-pc-diff-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === diffNow);
    });

    if (now) now.textContent = `ตอนนี้: ${sidNow} • ${diffNow.toUpperCase()}`;

    const r = routes();

    grid.innerHTML = '';

    for (let i = 1; i <= 15; i++) {
      const sid = `S${i}`;
      const route = r[sid] || FALLBACK_ROUTES[sid] || {};
      const skill = route.skill || 'unknown';
      const isBoss = !!route.boss || skill === 'boss' || skill === 'finalBoss';
      const isCurrent = sid === sidNow;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = `lesson-pc-session-item ${isBoss ? 'boss' : ''} ${isCurrent ? 'current' : ''}`;
      item.innerHTML = `
        <div class="lesson-pc-session-no">
          <span>${sid}</span>
          <span>${SKILL_ICON[skill] || '⭐'}</span>
        </div>
        <div class="lesson-pc-session-skill">${SKILL_ICON[skill] || '⭐'} ${SKILL_TH[skill] || skill}</div>
        <div class="lesson-pc-session-name">${route.title || 'Lesson Mission'}</div>
        ${isCurrent ? '<div class="lesson-pc-session-current">กำลังเล่น</div>' : ''}
      `;

      item.addEventListener('click', function () {
        location.href = makeUrlForSession(sid, diffNow);
      });

      grid.appendChild(item);
    }
  }

  function openPicker() {
    ensurePicker();
    renderPicker();
    $('#lessonPcSessionOverlay')?.classList.add('show');
  }

  function closePicker() {
    $('#lessonPcSessionOverlay')?.classList.remove('show');
  }

  function boot() {
    ensurePicker();

    window.LESSON_PC_SESSION_PICKER_FIX = {
      version: VERSION,
      open: openPicker,
      close: closePicker,
      render: renderPicker,
      makeUrlForSession
    };

    window.addEventListener('lesson:router-ready', renderPicker);
    window.addEventListener('lesson:view-mode-ready', renderPicker);
    window.addEventListener('lesson:data-skill-ready', renderPicker);

    console.log('[LessonPcSessionPickerFix]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
