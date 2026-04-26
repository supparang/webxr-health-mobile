// === /english/js/lesson-listening-quality-fix.js ===
// PATCH v20260426c-LESSON-LISTENING-QUALITY-FIX-FORCE-ACTIVE
// Fix: sometimes choices remain disabled after pressing Listen.
// ✅ Intercepts legacy Listen button
// ✅ After Listen, always renders choices A/B/C/D
// ✅ Force-enables choices after Listen in multiple ticks
// ✅ Removes disabled / aria-disabled / pointer-events locks
// ✅ Uses delegated click handler for robustness
// ✅ Correct answer is shuffled
// ✅ Session-specific listening choices
// ✅ Dispatches lesson:item-result and lesson:mission-pass

(function () {
  'use strict';

  const VERSION = 'v20260426c-LESSON-LISTENING-QUALITY-FIX-FORCE-ACTIVE';
  const STORAGE_KEY = 'TECHPATH_LISTENING_QFIX_INDEX_V3';

  const state = {
    cache: {},
    listened: {},
    speaking: false,
    lastRenderAt: 0,
    activeItemId: '',
    observer: null
  };

  const CEFR_BY_LEVEL = {
    easy: 'A2',
    normal: 'A2+',
    hard: 'B1',
    challenge: 'B1+'
  };

  const CONTEXT = {
    S2: {
      title: 'Academic Background',
      topic: 'academic background',
      actions: [
        'studies computer science and builds a small app',
        'learns AI and makes a simple chatbot',
        'tests a class project with her team',
        'uses data to manage student tasks',
        'builds a study planner app'
      ]
    },
    S3: {
      title: 'Boss 1 — Intro + Background',
      topic: 'introduction and study background',
      actions: [
        'introduces herself and explains her computer science project',
        'talks about an AI class and a useful app',
        'describes her study background and teamwork skill',
        'explains a small project for students',
        'says her main skill is writing simple code'
      ]
    },
    S6: {
      title: 'Boss 2 — Workplace Basics',
      topic: 'workplace communication',
      actions: [
        'writes a short email to confirm the meeting time',
        'asks the team to update the task list',
        'checks the schedule before the online meeting',
        'sends a polite message in the team chat',
        'confirms the deadline with the project team'
      ]
    },
    S9: {
      title: 'Boss 3 — Team Stand-up',
      topic: 'team stand-up update',
      actions: [
        'fixed the login bug and asked the team to test the dashboard',
        'updated the task board and explained the next step',
        'reported project progress and asked for feedback',
        'found a system problem and planned a quick fix',
        'shared progress, blockers, and next tasks'
      ]
    },
    S10: {
      title: 'Client Communication',
      topic: 'client communication',
      actions: [
        'asks the client to confirm the main requirement',
        'summarizes the client feedback after the meeting',
        'explains the prototype in a short message',
        'checks if the client wants a new dashboard feature',
        'writes a polite reply about the project timeline'
      ]
    },
    S12: {
      title: 'Boss 4 — Client + AI',
      topic: 'client and AI project',
      actions: [
        'explains how the AI feature supports the client requirement',
        'uses data to improve the prototype for users',
        'summarizes client feedback and plans the next version',
        'checks the data report before changing the AI feature',
        'connects user feedback with a better interface design'
      ]
    },
    S15: {
      title: 'Final Boss — Career Mission',
      topic: 'career mission',
      actions: [
        'presents a portfolio and explains one useful project',
        'answers an interview question about teamwork',
        'describes a project that solves a real user problem',
        'explains a career plan in computer science',
        'pitches an app idea with clear user value'
      ]
    }
  };

  const FALLBACK_CONTEXT = {
    title: 'Tech Communication',
    topic: 'technology communication',
    actions: [
      'explains a useful technology project',
      'updates the team about a small task',
      'describes a system problem clearly',
      'asks for feedback on an app',
      'summarizes the next project step'
    ]
  };

  const PEOPLE = ['Anna', 'Ben', 'Maya', 'Ken', 'Lina', 'Nina', 'Tom'];

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

  function currentSid() {
    try {
      const st = window.LESSON_MISSION_PANEL_FIX?.getState?.();
      if (st?.sid) return normalizeSid(st.sid);
    } catch (err) {}

    try {
      if (window.LESSON_CURRENT_STATE?.sid) return normalizeSid(window.LESSON_CURRENT_STATE.sid);
    } catch (err) {}

    const p = q();
    return normalizeSid(p.get('s') || p.get('sid') || p.get('session') || '1');
  }

  function normalizeLevel(v) {
    const raw = safe(v).toLowerCase();

    if (['easy', 'a2', 'e'].includes(raw)) return 'easy';
    if (['normal', 'a2+', 'medium', 'n'].includes(raw)) return 'normal';
    if (['hard', 'b1', 'h'].includes(raw)) return 'hard';
    if (['challenge', 'b1+', 'expert', 'x'].includes(raw)) return 'challenge';

    return 'easy';
  }

  function currentLevel() {
    const sid = currentSid();

    try {
      const ai = window.LESSON_AI_DIFFICULTY?.getRecommendedDifficulty?.(sid);
      if (ai) return normalizeLevel(ai);
    } catch (err) {}

    try {
      const st = window.LESSON_MISSION_PANEL_FIX?.getState?.();
      if (st?.difficulty) return normalizeLevel(st.difficulty);
      if (st?.item?.difficulty) return normalizeLevel(st.item.difficulty);
    } catch (err) {}

    try {
      if (window.LESSON_CURRENT_STATE?.difficulty) {
        return normalizeLevel(window.LESSON_CURRENT_STATE.difficulty);
      }
    } catch (err) {}

    return normalizeLevel(q().get('diff') || q().get('difficulty') || 'easy');
  }

  function getPanel() {
    return (
      $('#lessonMissionPanel') ||
      $('.lesson-mission-panel') ||
      $('[data-lesson-mission-panel]') ||
      null
    );
  }

  function isListeningMission() {
    try {
      const st = window.LESSON_MISSION_PANEL_FIX?.getState?.();
      const skill = safe(st?.skill || st?.item?.skill || st?.type || st?.item?.type).toLowerCase();
      const title = safe(st?.item?.title || st?.session?.title || '').toLowerCase();

      if (skill.includes('listening')) return true;
      if (title.includes('listening')) return true;
    } catch (err) {}

    const panel = getPanel();
    const text = safe(panel?.innerText || panel?.textContent).toLowerCase();

    return text.includes('listening mission') || text.includes('ฟังเสียง') || text.includes('listen');
  }

  function loadIndexStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function saveIndexStore(store) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {}
  }

  function seededShuffle(items, seedText) {
    const arr = items.slice();
    let seed = 0;
    const s = safe(seedText);

    for (let i = 0; i < s.length; i++) {
      seed = (seed * 31 + s.charCodeAt(i)) >>> 0;
    }

    function rnd() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
  }

  function ctxForSid(sid) {
    return CONTEXT[sid] || FALLBACK_CONTEXT;
  }

  function makeAudio(ctx, level, index) {
    const person = PEOPLE[index % PEOPLE.length];
    const action = ctx.actions[index % ctx.actions.length];

    if (level === 'easy') {
      return `${person} ${action}.`;
    }

    if (level === 'normal') {
      return `${person} ${action}. The main point is about ${ctx.topic}.`;
    }

    if (level === 'hard') {
      return `${person} ${action}. The listener should understand the key detail and respond clearly.`;
    }

    return `${person} ${action}. The message connects the project context, clear communication, and the next action.`;
  }

  function questionByLevel(level) {
    if (level === 'easy') return 'What is the main topic?';
    if (level === 'normal') return 'What does the speaker mainly say?';
    if (level === 'hard') return 'What should the listener understand?';
    return 'Which summary best matches the message?';
  }

  function correctByLevel(action, level) {
    if (level === 'easy') return action;
    if (level === 'normal') return `The speaker mainly says that the team ${action}.`;
    if (level === 'hard') return `The listener should understand that the team ${action}.`;
    return `The best summary is that the speaker connects the task with a clear next step: the team ${action}.`;
  }

  function distractorsByLevel(level) {
    if (level === 'easy') {
      return [
        'orders food and checks a menu',
        'talks about a sports activity',
        'plans a holiday trip'
      ];
    }

    if (level === 'normal') {
      return [
        'The speaker mainly talks about buying food after class.',
        'The speaker mainly describes a sports game and practice time.',
        'The speaker mainly explains a travel plan and hotel booking.'
      ];
    }

    if (level === 'hard') {
      return [
        'The listener should prepare a food order and check the price.',
        'The listener should focus on a travel schedule, not the project task.',
        'The listener should report a sports result to the team.'
      ];
    }

    return [
      'The best summary is about a restaurant order with no project decision.',
      'The best summary is about a vacation plan and transport details.',
      'The best summary is about a sports event, not a work or study update.'
    ];
  }

  function buildPool(sid, level) {
    const ctx = ctxForSid(sid);
    const pool = [];

    for (let i = 0; i < 10; i++) {
      const action = ctx.actions[i % ctx.actions.length];
      const audio = makeAudio(ctx, level, i);
      const correct = correctByLevel(action, level);
      const distractors = distractorsByLevel(level);

      const choices = seededShuffle(
        [
          { text: correct, correct: true },
          { text: distractors[0], correct: false },
          { text: distractors[1], correct: false },
          { text: distractors[2], correct: false }
        ],
        `${sid}|${level}|${i}|${audio}`
      );

      pool.push({
        id: `${sid}-${level}-listen-${String(i + 1).padStart(2, '0')}`,
        sid,
        skill: 'listening',
        level,
        cefr: CEFR_BY_LEVEL[level] || 'A2',
        title: ctx.title,
        question: questionByLevel(level),
        audio,
        correctText: correct,
        choices,
        passScore: 70
      });
    }

    return pool;
  }

  function pickItem(sid, level, advance) {
    const key = `${sid}|${level}`;
    const activeKey = `${key}|active`;

    if (!advance && state.cache[activeKey]) return state.cache[activeKey];

    const store = loadIndexStore();
    const current = Number(store[key] || 0);
    const next = advance ? current + 1 : current;
    const pool = buildPool(sid, level);
    const item = pool[Math.abs(next) % pool.length];

    store[key] = next;
    saveIndexStore(store);

    state.cache[activeKey] = item;

    if (typeof state.listened[item.id] === 'undefined') {
      state.listened[item.id] = false;
    }

    return item;
  }

  function getCurrentItem() {
    return pickItem(currentSid(), currentLevel(), false);
  }

  function advanceItem() {
    const sid = currentSid();
    const level = currentLevel();
    delete state.cache[`${sid}|${level}|active`];

    const item = pickItem(sid, level, true);
    state.activeItemId = item.id;
    state.listened[item.id] = false;
    render(true, item);
  }

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return false;

      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.86;
      u.pitch = 1;
      u.volume = 1;

      state.speaking = true;

      u.onend = function () {
        state.speaking = false;
      };

      u.onerror = function () {
        state.speaking = false;
      };

      window.speechSynthesis.speak(u);
      return true;
    } catch (err) {
      state.speaking = false;
      return false;
    }
  }

  function ensureCSS() {
    let style = $('#lesson-listening-quality-css');

    if (!style) {
      style = document.createElement('style');
      style.id = 'lesson-listening-quality-css';
      document.head.appendChild(style);
    }

    style.textContent = `
      #lessonListeningQualityBox {
        margin: 12px 0 0 !important;
        display: grid !important;
        gap: 12px !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      #lessonListeningQualityBox * {
        box-sizing: border-box;
      }

      .lqfix-card {
        border: 1px solid rgba(147,197,253,.55);
        border-radius: 18px;
        background: rgba(239,246,255,.94);
        padding: 14px;
        color: #0f172a;
      }

      .lqfix-title {
        font-weight: 1000;
        color: #1d4ed8;
        margin-bottom: 7px;
      }

      .lqfix-question {
        font-weight: 1000;
        font-size: 18px;
        line-height: 1.35;
      }

      .lqfix-audio-note {
        margin-top: 8px;
        color: #334155;
        font-weight: 850;
        line-height: 1.4;
      }

      .lqfix-transcript {
        margin-top: 8px;
        border-radius: 14px;
        background: rgba(255,255,255,.70);
        padding: 8px 10px;
        color: #334155;
        font-weight: 800;
      }

      .lqfix-actions {
        display: flex !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
      }

      .lqfix-btn {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font-weight: 1000;
        cursor: pointer;
      }

      .lqfix-listen {
        background: #22c55e;
        color: #052e16;
      }

      .lqfix-change {
        background: #fef3c7;
        color: #92400e;
      }

      .lqfix-choices {
        display: grid !important;
        gap: 10px !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      .lqfix-choice {
        width: 100% !important;
        display: grid !important;
        grid-template-columns: 42px 1fr !important;
        gap: 12px !important;
        align-items: center !important;
        border: 0 !important;
        border-radius: 18px !important;
        background: linear-gradient(135deg,#67e8f9,#22d3ee) !important;
        color: #0f172a !important;
        padding: 13px 14px !important;
        text-align: left !important;
        font-weight: 1000 !important;
        cursor: pointer !important;
        box-shadow: 0 10px 24px rgba(14,165,233,.16) !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      .lqfix-choice[disabled] {
        opacity: .45 !important;
        cursor: not-allowed !important;
        pointer-events: none !important;
      }

      .lqfix-choice.force-active {
        opacity: 1 !important;
        cursor: pointer !important;
        pointer-events: auto !important;
      }

      .lqfix-choice.correct {
        background: linear-gradient(135deg,#86efac,#22c55e) !important;
      }

      .lqfix-choice.wrong {
        background: linear-gradient(135deg,#fecaca,#f87171) !important;
      }

      .lqfix-letter {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(255,255,255,.50);
        font-weight: 1000;
      }

      .lqfix-feedback {
        border-radius: 18px;
        padding: 12px 14px;
        background: rgba(248,250,252,.94);
        color: #334155;
        font-weight: 900;
        line-height: 1.45;
      }

      .lqfix-feedback.pass {
        background: rgba(220,252,231,.95);
        color: #166534;
      }

      .lqfix-feedback.fail {
        background: rgba(254,242,242,.95);
        color: #991b1b;
      }
    `;
  }

  function escapeHtml(text) {
    return safe(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function hideLegacyGenericChoices(panel) {
    if (!panel) return;

    $all('button, [role="button"]', panel).forEach((btn) => {
      if (btn.closest('#lessonListeningQualityBox')) return;

      const text = safe(btn.innerText || btn.textContent);

      if (
        /simple study or technology action/i.test(text) ||
        /food order/i.test(text) ||
        /sports/i.test(text) ||
        /travel/i.test(text)
      ) {
        btn.style.display = 'none';
        btn.style.pointerEvents = 'none';
        btn.dataset.lqfixHidden = 'generic-choice';
      }
    });
  }

  function findInsertTarget(panel) {
    return (
      $('.lesson-mission-body', panel) ||
      $('.mission-body', panel) ||
      $('.lesson-panel-body', panel) ||
      panel
    );
  }

  function forceEnableChoices(itemId) {
    const box = $('#lessonListeningQualityBox');
    if (!box) return false;

    const item = itemId ? findItemById(itemId) : getCurrentItem();

    if (!item) return false;
    if (!state.listened[item.id]) return false;

    let count = 0;

    $all('[data-lqfix-choice]', box).forEach((btn) => {
      try {
        btn.disabled = false;
        btn.removeAttribute('disabled');
        btn.removeAttribute('aria-disabled');
        btn.dataset.lqfixActive = 'true';
        btn.classList.add('force-active');
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        count += 1;
      } catch (err) {}
    });

    const fb = $('#lqfixFeedback', box);
    if (fb && count) {
      fb.className = 'lqfix-feedback';
      fb.textContent = 'ฟังแล้ว เลือกคำตอบที่ตรงกับเรื่องที่ได้ยิน';
    }

    console.log('[LessonListeningQualityFix] forceEnableChoices', {
      version: VERSION,
      itemId: item.id,
      count
    });

    return count > 0;
  }

  function findItemById(itemId) {
    const sid = currentSid();
    const level = currentLevel();
    const pool = buildPool(sid, level);

    return pool.find(x => x.id === itemId) || state.cache[`${sid}|${level}|active`] || null;
  }

  function scheduleForceEnable(item) {
    const id = item.id;

    [0, 40, 120, 300, 650, 1200].forEach((ms) => {
      setTimeout(() => {
        state.listened[id] = true;
        forceEnableChoices(id);
      }, ms);
    });
  }

  function render(force, forcedItem) {
    const panel = getPanel();

    if (!panel) return;
    if (!isListeningMission()) return;

    ensureCSS();

    const item = forcedItem || getCurrentItem();
    const listened = !!state.listened[item.id];

    state.activeItemId = item.id;

    hideLegacyGenericChoices(panel);

    let box = $('#lessonListeningQualityBox', panel);

    if (!box) {
      box = document.createElement('section');
      box.id = 'lessonListeningQualityBox';

      const target = findInsertTarget(panel);
      target.appendChild(box);
    }

    box.style.display = 'grid';
    box.style.visibility = 'visible';
    box.style.opacity = '1';

    box.innerHTML = `
      <div class="lqfix-card">
        <div class="lqfix-title">🎧 Listening Mission • ${item.level.toUpperCase()} • ${item.cefr}</div>
        <div class="lqfix-question">${escapeHtml(item.question)}</div>
        <div class="lqfix-audio-note">กด Listen เพื่อฟัง แล้วเลือกคำตอบที่สรุปสาระสำคัญตรงที่สุด</div>
        <details class="lqfix-transcript">
          <summary>ดู transcript สำหรับครู/ทดสอบ</summary>
          ${escapeHtml(item.audio)}
        </details>
      </div>

      <div class="lqfix-actions">
        <button type="button" class="lqfix-btn lqfix-listen" id="lqfixListenBtn">🔊 Listen</button>
        <button type="button" class="lqfix-btn lqfix-change" id="lqfixChangeBtn">↻ เปลี่ยนข้อ</button>
      </div>

      <div class="lqfix-choices" id="lqfixChoices">
        ${item.choices.map((c, idx) => `
          <button type="button" class="lqfix-choice ${listened ? 'force-active' : ''}" data-lqfix-choice="${idx}" ${listened ? '' : 'disabled aria-disabled="true"'}>
            <span class="lqfix-letter">${String.fromCharCode(65 + idx)}</span>
            <span>${escapeHtml(c.text)}</span>
          </button>
        `).join('')}
      </div>

      <div class="lqfix-feedback" id="lqfixFeedback">
        ${listened ? 'ฟังแล้ว เลือกคำตอบที่ตรงกับเรื่องที่ได้ยิน' : 'ต้องกด Listen ก่อน จึงจะเลือกคำตอบได้'}
      </div>
    `;

    $('#lqfixListenBtn', box)?.addEventListener('click', () => {
      listenNow(item);
    });

    $('#lqfixChangeBtn', box)?.addEventListener('click', () => {
      advanceItem();
    });

    $all('[data-lqfix-choice]', box).forEach((btn) => {
      btn.addEventListener('click', () => {
        chooseAnswer(item, btn, box);
      });
    });

    if (listened) {
      scheduleForceEnable(item);
    }

    state.lastRenderAt = Date.now();

    console.log('[LessonListeningQualityFix] render', {
      version: VERSION,
      sid: item.sid,
      level: item.level,
      id: item.id,
      listened,
      choices: item.choices.length,
      correctIndex: item.choices.findIndex(c => c.correct)
    });
  }

  function listenNow(item) {
    item = item || getCurrentItem();

    state.activeItemId = item.id;
    state.listened[item.id] = true;

    speak(item.audio);

    render(true, item);
    scheduleForceEnable(item);
  }

  function chooseAnswer(item, btn, box) {
    if (!state.listened[item.id]) {
      const fb = $('#lqfixFeedback', box);

      if (fb) {
        fb.className = 'lqfix-feedback fail';
        fb.textContent = 'ต้องกด Listen ก่อน จึงจะตอบได้';
      }

      return;
    }

    const idx = Number(btn.dataset.lqfixChoice || 0);
    const choice = item.choices[idx];
    const passed = !!choice.correct;
    const score = passed ? 100 : 0;

    $all('[data-lqfix-choice]', box).forEach((b) => {
      b.disabled = true;
      b.setAttribute('disabled', 'disabled');
      b.setAttribute('aria-disabled', 'true');
      b.classList.remove('force-active');

      const c = item.choices[Number(b.dataset.lqfixChoice || 0)];
      if (c.correct) b.classList.add('correct');
    });

    if (!passed) btn.classList.add('wrong');

    const fb = $('#lqfixFeedback', box);

    if (fb) {
      fb.className = `lqfix-feedback ${passed ? 'pass' : 'fail'}`;
      fb.textContent = passed
        ? '✅ ถูกต้อง ผ่านด่านนี้แล้ว'
        : `❌ ยังไม่ตรง ลองฟังใหม่อีกครั้ง คำตอบที่ถูกคือ: ${item.correctText}`;
    }

    const detail = {
      version: VERSION,
      sid: item.sid,
      itemId: item.id,
      skill: 'listening',
      type: 'listening',
      difficulty: item.level,
      cefr: item.cefr,
      answer: choice.text,
      correctAnswer: item.correctText,
      passed,
      correct: passed,
      isCorrect: passed,
      score,
      passScore: item.passScore,
      audio: item.audio,
      question: item.question
    };

    window.dispatchEvent(new CustomEvent('lesson:item-result', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:item-result', { detail }));

    window.dispatchEvent(new CustomEvent('lesson:listening-result', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:listening-result', { detail }));

    if (passed) {
      window.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
      document.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
    }
  }

  function interceptLegacyListen() {
    document.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest('button');
      if (!btn) return;
      if (btn.closest('#lessonListeningQualityBox')) return;
      if (!isListeningMission()) return;

      const text = safe(btn.innerText || btn.textContent);

      if (/listen/i.test(text) || /ฟัง/i.test(text)) {
        ev.preventDefault();
        ev.stopPropagation();

        if (typeof ev.stopImmediatePropagation === 'function') {
          ev.stopImmediatePropagation();
        }

        listenNow(getCurrentItem());
      }

      if (/เปลี่ยนข้อ|try again|change/i.test(text)) {
        ev.preventDefault();
        ev.stopPropagation();

        if (typeof ev.stopImmediatePropagation === 'function') {
          ev.stopImmediatePropagation();
        }

        advanceItem();
      }
    }, true);
  }

  function observePanelChanges() {
    if (state.observer) return;

    try {
      state.observer = new MutationObserver(() => {
        if (!isListeningMission()) return;

        const item = getCurrentItem();

        if (item && state.listened[item.id]) {
          setTimeout(() => forceEnableChoices(item.id), 50);
          setTimeout(() => forceEnableChoices(item.id), 250);
        }
      });

      state.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'aria-disabled', 'style', 'class']
      });
    } catch (err) {}
  }

  function boot() {
    ensureCSS();
    interceptLegacyListen();
    observePanelChanges();

    [
      'lesson:data-bridge-ready',
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:ai-difficulty-updated',
      'lesson:view-mode-ready'
    ].forEach((name) => {
      window.addEventListener(name, () => setTimeout(() => render(false), 80));
      document.addEventListener(name, () => setTimeout(() => render(false), 80));
    });

    setTimeout(() => render(false), 200);
    setTimeout(() => render(false), 700);
    setTimeout(() => render(false), 1400);
    setTimeout(() => render(false), 2600);

    window.LESSON_LISTENING_QUALITY_FIX = {
      version: VERSION,
      render,
      listenNow,
      forceEnableChoices,
      advanceItem,
      buildPool,
      pickItem,
      state,
      debug() {
        render(true);
        const item = getCurrentItem();
        if (state.listened[item.id]) forceEnableChoices(item.id);

        return {
          version: VERSION,
          sid: currentSid(),
          level: currentLevel(),
          item,
          listened: !!state.listened[item.id],
          activeItemId: state.activeItemId,
          panelFound: !!getPanel(),
          isListening: isListeningMission()
        };
      }
    };

    console.log('[LessonListeningQualityFix]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
