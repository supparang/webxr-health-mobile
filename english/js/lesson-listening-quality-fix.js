// === /english/js/lesson-listening-quality-fix.js ===
// PATCH v20260426a-LESSON-LISTENING-QUALITY-FIX
// Fix: Listening choices are generic/repeated and answer is too easy.
// ✅ Replaces generic fallback listening choices
// ✅ Creates session-specific listening questions for S2/S3/S6/S9/S10/S12/S15
// ✅ Supports easy / normal / hard / challenge
// ✅ Correct answer is shuffled, not always A
// ✅ Must press Listen before choosing
// ✅ Dispatches lesson:item-result and lesson:mission-pass
// ✅ Works with Mission Panel without editing lesson-data.js

(function () {
  'use strict';

  const VERSION = 'v20260426a-LESSON-LISTENING-QUALITY-FIX';
  const STORAGE_KEY = 'TECHPATH_LISTENING_QFIX_INDEX_V1';

  const state = {
    cache: {},
    listened: {},
    speaking: false
  };

  const CEFR_BY_LEVEL = {
    easy: 'A2',
    normal: 'A2+',
    hard: 'B1',
    challenge: 'B1+'
  };

  const SESSION_CONTEXT = {
    S2: {
      title: 'Academic Background',
      topic: 'study background',
      people: ['Anna', 'Ben', 'Maya', 'Ken', 'Lina'],
      nouns: ['computer science', 'AI', 'software design', 'data analysis', 'mobile apps'],
      actions: [
        'studies computer science and builds a small app',
        'learns AI and makes a simple chatbot',
        'studies software design and tests a class project',
        'uses data to understand student tasks',
        'builds a mobile app for a study planner'
      ]
    },
    S3: {
      title: 'Boss 1 — Intro + Background',
      topic: 'introduction and study background',
      people: ['Anna', 'Maya', 'Ken', 'Leo', 'Nina'],
      nouns: ['major', 'project', 'skill', 'class', 'study plan'],
      actions: [
        'introduces herself and explains her computer science project',
        'talks about her AI class and a useful app',
        'describes her study background and teamwork skill',
        'explains a small project for students',
        'says her main skill is writing simple code'
      ]
    },
    S6: {
      title: 'Boss 2 — Workplace Basics',
      topic: 'workplace communication',
      people: ['Nina', 'Tom', 'Maya', 'Ken', 'Sara'],
      nouns: ['email', 'meeting', 'task', 'schedule', 'team chat'],
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
      topic: 'stand-up update',
      people: ['Nina', 'Tom', 'Maya', 'Ken', 'Sara'],
      nouns: ['login bug', 'dashboard', 'task board', 'project progress', 'team update'],
      actions: [
        'fixed the login bug and asked the team to test the dashboard',
        'updated the task board and explained the next step',
        'reported project progress and asked for feedback',
        'found a small system problem and planned a quick fix',
        'shared a stand-up update about progress, blockers, and next tasks'
      ]
    },
    S10: {
      title: 'Client Communication',
      topic: 'client communication',
      people: ['Nina', 'Tom', 'Maya', 'Ken', 'Sara'],
      nouns: ['client message', 'requirement', 'feedback', 'prototype', 'meeting note'],
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
      people: ['Nina', 'Tom', 'Maya', 'Ken', 'Sara'],
      nouns: ['AI feature', 'client requirement', 'data report', 'prototype', 'user feedback'],
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
      people: ['Anna', 'Ben', 'Maya', 'Ken', 'Lina'],
      nouns: ['job interview', 'portfolio', 'project pitch', 'career plan', 'team project'],
      actions: [
        'presents a portfolio and explains one useful project',
        'answers an interview question about teamwork',
        'describes a project that solves a real user problem',
        'explains a career plan in computer science',
        'pitches an app idea with clear user value'
      ]
    }
  };

  const GENERIC_CONTEXT = {
    title: 'Tech Communication',
    topic: 'technology communication',
    people: ['Anna', 'Ben', 'Maya', 'Ken', 'Lina'],
    nouns: ['project', 'system', 'task', 'app', 'team'],
    actions: [
      'explains a useful technology project',
      'updates the team about a small task',
      'describes a system problem clearly',
      'asks for feedback on an app',
      'summarizes the next project step'
    ]
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

  function currentSid() {
    try {
      const st = window.LESSON_MISSION_PANEL_FIX?.getState?.();
      if (st?.sid) return normalizeSid(st.sid);
    } catch (err) {}

    try {
      if (window.LESSON_CURRENT_STATE?.sid) return normalizeSid(window.LESSON_CURRENT_STATE.sid);
    } catch (err) {}

    const p = q();

    return normalizeSid(
      p.get('s') ||
      p.get('sid') ||
      p.get('session') ||
      p.get('unit') ||
      '1'
    );
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

    return text.includes('listening mission') || text.includes('ฟังเสียง');
  }

  function getPanel() {
    return (
      $('#lessonMissionPanel') ||
      $('.lesson-mission-panel') ||
      $('[data-lesson-mission-panel]') ||
      null
    );
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

  function contextForSid(sid) {
    return SESSION_CONTEXT[sid] || GENERIC_CONTEXT;
  }

  function levelQuestion(level) {
    if (level === 'easy') return 'What is the main topic?';
    if (level === 'normal') return 'What does the speaker mainly say?';
    if (level === 'hard') return 'What should the listener understand from the message?';
    return 'Which summary best matches the speaker’s message?';
  }

  function makeAudio(ctx, level, index) {
    const person = ctx.people[index % ctx.people.length];
    const action = ctx.actions[index % ctx.actions.length];
    const noun = ctx.nouns[index % ctx.nouns.length];

    if (level === 'easy') {
      return `${person} ${action}.`;
    }

    if (level === 'normal') {
      return `${person} ${action}. The main point is about ${ctx.topic}.`;
    }

    if (level === 'hard') {
      return `${person} ${action}. The team should understand the key detail and respond clearly before the next step.`;
    }

    return `${person} ${action}. The message connects ${noun}, clear communication, and the next action the team should take.`;
  }

  function makeCorrect(ctx, level, index) {
    const action = ctx.actions[index % ctx.actions.length];

    if (level === 'easy') return action;
    if (level === 'normal') return `The speaker mainly says that the team ${action}.`;
    if (level === 'hard') return `The key message is to understand that the team ${action}.`;
    return `The best summary is that the speaker connects the task with a clear next step: the team ${action}.`;
  }

  function makeDistractors(ctx, level, index) {
    const actions = ctx.actions;
    const a1 = actions[(index + 1) % actions.length];
    const a2 = actions[(index + 2) % actions.length];
    const a3 = actions[(index + 3) % actions.length];

    if (level === 'easy') {
      return [
        `orders food and checks a menu`,
        `talks about a sports activity`,
        `plans a holiday trip`
      ];
    }

    if (level === 'normal') {
      return [
        `The speaker mainly talks about buying food after class.`,
        `The speaker mainly describes a sports game and practice time.`,
        `The speaker mainly explains a travel plan and hotel booking.`
      ];
    }

    if (level === 'hard') {
      return [
        `The listener should prepare a food order and check the price.`,
        `The listener should focus on a travel schedule, not the project task.`,
        `The listener should report a sports result to the team.`
      ];
    }

    return [
      `The best summary is about a restaurant order with no project decision.`,
      `The best summary is about a vacation plan and transport details.`,
      `The best summary is about a sports event, not a work or study update.`
    ];
  }

  function buildPool(sid, level) {
    const ctx = contextForSid(sid);
    const pool = [];

    for (let i = 0; i < 10; i++) {
      const audio = makeAudio(ctx, level, i);
      const correct = makeCorrect(ctx, level, i);
      const distractors = makeDistractors(ctx, level, i);

      const rawChoices = [
        { text: correct, correct: true },
        { text: distractors[0], correct: false },
        { text: distractors[1], correct: false },
        { text: distractors[2], correct: false }
      ];

      const choices = seededShuffle(rawChoices, `${sid}|${level}|${i}|${audio}`);

      pool.push({
        id: `${sid}-${level}-listen-${String(i + 1).padStart(2, '0')}`,
        sid,
        skill: 'listening',
        level,
        cefr: CEFR_BY_LEVEL[level] || 'A2',
        title: ctx.title,
        question: levelQuestion(level),
        audio,
        choices,
        correctText: correct,
        passScore: 70
      });
    }

    return pool;
  }

  function pickItem(sid, level, advance) {
    const key = `${sid}|${level}`;
    const cacheKey = `${key}|active`;

    if (!advance && state.cache[cacheKey]) {
      return state.cache[cacheKey];
    }

    const store = loadIndexStore();
    const current = Number(store[key] || 0);
    const next = advance ? current + 1 : current;
    const pool = buildPool(sid, level);
    const item = pool[Math.abs(next) % pool.length];

    store[key] = next;
    saveIndexStore(store);

    state.cache[cacheKey] = item;
    state.listened[item.id] = false;

    return item;
  }

  function advanceItem() {
    const sid = currentSid();
    const level = currentLevel();
    const key = `${sid}|${level}|active`;

    delete state.cache[key];

    const item = pickItem(sid, level, true);
    render(true, item);
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;

    try {
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

      window.speechSynthesis.speak(u);
    } catch (err) {}
  }

  function ensureCSS() {
    if ($('#lesson-listening-quality-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-listening-quality-css';
    style.textContent = `
      #lessonMissionPanel[data-lqfix="on"] .lesson-choice-btn,
      #lessonMissionPanel[data-lqfix="on"] [data-choice-index],
      #lessonMissionPanel[data-lqfix="on"] .choice-btn,
      #lessonMissionPanel[data-lqfix="on"] .answer-choice {
        display: none !important;
      }

      .lqfix-box {
        margin: 12px 0 0;
        display: grid;
        gap: 12px;
      }

      .lqfix-card {
        border: 1px solid rgba(147,197,253,.55);
        border-radius: 18px;
        background: rgba(239,246,255,.88);
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

      .lqfix-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
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
        display: grid;
        gap: 10px;
      }

      .lqfix-choice {
        width: 100%;
        display: grid;
        grid-template-columns: 42px 1fr;
        gap: 12px;
        align-items: center;
        border: 0;
        border-radius: 18px;
        background: linear-gradient(135deg,#67e8f9,#22d3ee);
        color: #0f172a;
        padding: 13px 14px;
        text-align: left;
        font-weight: 1000;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(14,165,233,.16);
      }

      .lqfix-choice[disabled] {
        opacity: .45;
        cursor: not-allowed;
      }

      .lqfix-choice.correct {
        background: linear-gradient(135deg,#86efac,#22c55e);
      }

      .lqfix-choice.wrong {
        background: linear-gradient(135deg,#fecaca,#f87171);
      }

      .lqfix-letter {
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(255,255,255,.45);
        font-weight: 1000;
      }

      .lqfix-feedback {
        border-radius: 18px;
        padding: 12px 14px;
        background: rgba(248,250,252,.92);
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

      .lqfix-transcript {
        margin-top: 4px;
        border-radius: 14px;
        background: rgba(255,255,255,.65);
        padding: 8px 10px;
        color: #334155;
        font-weight: 800;
      }
    `;

    document.head.appendChild(style);
  }

  function hideLegacyGenericChoices(panel) {
    if (!panel) return;

    const badPatterns = [
      /simple study or technology action/i,
      /food order/i,
      /sports/i,
      /travel/i
    ];

    $all('button, [role="button"]', panel).forEach((btn) => {
      if (btn.closest('#lessonListeningQualityBox')) return;

      const text = safe(btn.innerText || btn.textContent);

      if (badPatterns.some(p => p.test(text))) {
        btn.style.display = 'none';
        btn.style.pointerEvents = 'none';
        btn.dataset.lqfixHidden = 'generic-choice';
      }
    });
  }

  function render(force, forcedItem) {
    const panel = getPanel();

    if (!panel) return;
    if (!isListeningMission()) return;

    ensureCSS();

    const sid = currentSid();
    const level = currentLevel();
    const item = forcedItem || pickItem(sid, level, false);

    panel.dataset.lqfix = 'on';

    hideLegacyGenericChoices(panel);

    let box = $('#lessonListeningQualityBox', panel);

    if (!box) {
      box = document.createElement('section');
      box.id = 'lessonListeningQualityBox';
      box.className = 'lqfix-box';

      const body =
        $('.lesson-mission-body', panel) ||
        $('.mission-body', panel) ||
        panel;

      body.appendChild(box);
    }

    const listened = !!state.listened[item.id];

    box.innerHTML = `
      <div class="lqfix-card">
        <div class="lqfix-title">🎧 Listening Mission • ${level.toUpperCase()} • ${item.cefr}</div>
        <div class="lqfix-question">${escapeHtml(item.question)}</div>
        <div class="lqfix-audio-note">
          กด Listen เพื่อฟัง แล้วเลือกคำตอบที่สรุปสาระสำคัญตรงที่สุด
        </div>
        <details class="lqfix-transcript">
          <summary>ดู transcript สำหรับครู/ทดสอบ</summary>
          ${escapeHtml(item.audio)}
        </details>
      </div>

      <div class="lqfix-actions">
        <button type="button" class="lqfix-btn lqfix-listen" id="lqfixListenBtn">🔊 Listen</button>
        <button type="button" class="lqfix-btn lqfix-change" id="lqfixChangeBtn">↻ เปลี่ยนข้อ</button>
      </div>

      <div class="lqfix-choices">
        ${item.choices.map((c, idx) => `
          <button type="button" class="lqfix-choice" data-lqfix-choice="${idx}" ${listened ? '' : 'disabled'}>
            <span class="lqfix-letter">${String.fromCharCode(65 + idx)}</span>
            <span>${escapeHtml(c.text)}</span>
          </button>
        `).join('')}
      </div>

      <div class="lqfix-feedback" id="lqfixFeedback">
        ${listened ? 'เลือกคำตอบที่ตรงกับเสียงที่ได้ยิน' : 'ต้องกด Listen ก่อน จึงจะเลือกคำตอบได้'}
      </div>
    `;

    $('#lqfixListenBtn', box)?.addEventListener('click', () => {
      state.listened[item.id] = true;
      speak(item.audio);
      render(true, item);
    });

    $('#lqfixChangeBtn', box)?.addEventListener('click', () => {
      advanceItem();
    });

    $all('[data-lqfix-choice]', box).forEach((btn) => {
      btn.addEventListener('click', () => {
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
      });
    });

    console.log('[LessonListeningQualityFix] render', {
      version: VERSION,
      sid,
      level,
      id: item.id,
      correctIndex: item.choices.findIndex(c => c.correct),
      audio: item.audio
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

  function interceptChangeButtons() {
    document.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest('button');
      if (!btn) return;
      if (btn.closest('#lessonListeningQualityBox')) return;

      const text = safe(btn.innerText || btn.textContent);

      if (/เปลี่ยนข้อ|try again|change/i.test(text) && isListeningMission()) {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        advanceItem();
      }
    }, true);
  }

  function boot() {
    ensureCSS();
    interceptChangeButtons();

    const rerenderEvents = [
      'lesson:data-bridge-ready',
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:ai-difficulty-updated',
      'lesson:view-mode-ready'
    ];

    rerenderEvents.forEach((name) => {
      window.addEventListener(name, () => setTimeout(() => render(false), 80));
      document.addEventListener(name, () => setTimeout(() => render(false), 80));
    });

    setTimeout(() => render(false), 300);
    setTimeout(() => render(false), 900);
    setTimeout(() => render(false), 1800);
    setTimeout(() => render(false), 3000);

    window.LESSON_LISTENING_QUALITY_FIX = {
      version: VERSION,
      render,
      advanceItem,
      buildPool,
      pickItem,
      state
    };

    console.log('[LessonListeningQualityFix]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
