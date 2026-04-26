// === /english/js/lesson-canonical-skill-flow-fix.js ===
// PATCH v20260426a-TECHPATH-CANONICAL-SKILL-FLOW
// ✅ Single source of truth for S1-S15
// ✅ One skill per S
// ✅ Boss every 3 sessions
// ✅ 4 levels: easy(A2), normal(A2+), hard(B1), challenge(B1+)
// ✅ 10 items per level per session
// ✅ No repeated fallback prompts
// ✅ Adaptive global AI difficulty across sessions
// ✅ Handles Listening / Speaking / Reading / Writing / Boss
// ✅ Dispatches lesson:item-result and lesson:mission-pass

(function () {
  'use strict';

  const VERSION = 'v20260426a-TECHPATH-CANONICAL-SKILL-FLOW';
  const ACTIVE_KEY = 'TECHPATH_CANON_ACTIVE_ITEM_V1';
  const INDEX_KEY = 'TECHPATH_CANON_ITEM_INDEX_V1';
  const AI_KEY = 'TECHPATH_CANON_AI_LEVEL_V1';

  const LEVELS = ['easy', 'normal', 'hard', 'challenge'];

  const LEVEL_META = {
    easy: { cefr: 'A2', label: 'EASY', support: 'Full Support', minWords: 5, keywordNeed: 1 },
    normal: { cefr: 'A2+', label: 'NORMAL', support: 'Guided', minWords: 7, keywordNeed: 1 },
    hard: { cefr: 'B1', label: 'HARD', support: 'Less Guide', minWords: 10, keywordNeed: 2 },
    challenge: { cefr: 'B1+', label: 'CHALLENGE', support: 'Independent', minWords: 12, keywordNeed: 2 }
  };

  const SESSIONS = [
    { sid: 'S1', title: 'Self Introduction in Tech', skill: 'speaking', topic: 'self introduction in computer science', keywords: ['name', 'student', 'computer', 'science', 'AI', 'project'], boss: false },
    { sid: 'S2', title: 'Academic Background', skill: 'listening', topic: 'academic background and study project', keywords: ['study', 'computer', 'AI', 'project', 'class', 'app'], boss: false },
    { sid: 'S3', title: 'Boss 1 — Intro + Background', skill: 'reading', topic: 'introduction and academic background', keywords: ['student', 'background', 'skill', 'project', 'team', 'AI'], boss: true },

    { sid: 'S4', title: 'Tech Jobs and Roles', skill: 'reading', topic: 'technology jobs and roles', keywords: ['developer', 'tester', 'designer', 'data', 'system', 'role'], boss: false },
    { sid: 'S5', title: 'Emails and Chat', skill: 'writing', topic: 'email and workplace chat', keywords: ['email', 'message', 'meeting', 'reply', 'task', 'bug'], boss: false },
    { sid: 'S6', title: 'Boss 2 — Workplace Basics', skill: 'writing', topic: 'workplace communication', keywords: ['deadline', 'meeting', 'update', 'team', 'email', 'task'], boss: true },

    { sid: 'S7', title: 'Explaining a System', skill: 'speaking', topic: 'explaining a simple system', keywords: ['system', 'user', 'button', 'data', 'screen', 'feature'], boss: false },
    { sid: 'S8', title: 'Problems and Bugs', skill: 'reading', topic: 'problems and bugs', keywords: ['bug', 'error', 'login', 'fix', 'test', 'problem'], boss: false },
    { sid: 'S9', title: 'Boss 3 — Team Stand-up', skill: 'listening', topic: 'team stand-up update', keywords: ['progress', 'blocker', 'bug', 'task', 'dashboard', 'team'], boss: true },

    { sid: 'S10', title: 'Client Communication', skill: 'listening', topic: 'client communication', keywords: ['client', 'requirement', 'feedback', 'prototype', 'timeline', 'meeting'], boss: false },
    { sid: 'S11', title: 'Data and AI Communication', skill: 'writing', topic: 'data and AI communication', keywords: ['data', 'AI', 'model', 'result', 'user', 'decision'], boss: false },
    { sid: 'S12', title: 'Boss 4 — Client + AI', skill: 'reading', topic: 'client and AI project', keywords: ['client', 'AI', 'data', 'feedback', 'feature', 'improve'], boss: true },

    { sid: 'S13', title: 'Job Interview', skill: 'speaking', topic: 'job interview for tech role', keywords: ['interview', 'skill', 'team', 'project', 'strength', 'developer'], boss: false },
    { sid: 'S14', title: 'Project Pitch', skill: 'speaking', topic: 'project pitch and user value', keywords: ['project', 'solve', 'user', 'value', 'feature', 'feedback'], boss: false },
    { sid: 'S15', title: 'Final Boss — Career Mission', skill: 'writing', topic: 'career mission and portfolio', keywords: ['portfolio', 'career', 'project', 'skill', 'team', 'future'], boss: true }
  ];

  const ACTIONS = {
    speaking: [
      'introduce yourself as a computer science student',
      'explain one useful project you made',
      'describe your role in a team project',
      'talk about one skill you want to improve',
      'explain how your app helps users',
      'answer a short interview question',
      'describe a bug and how you fixed it',
      'present your project goal clearly',
      'explain one AI feature in simple words',
      'give a short update about your progress'
    ],
    listening: [
      'Anna studies computer science and builds a small app for students',
      'Ben explains that the team fixed a login bug today',
      'Maya asks the client to confirm the main requirement',
      'Ken reports that the dashboard is ready for testing',
      'Lina says the prototype needs clearer user feedback',
      'Tom updates the task board before the meeting',
      'Nina summarizes the client feedback after the call',
      'Sara explains that the AI feature should support users',
      'Leo says the project timeline needs one more week',
      'Maya shares progress, blockers, and the next task'
    ],
    reading: [
      'A software developer writes and tests programs for users.',
      'A project team should record decisions after a meeting.',
      'A login bug can stop users from entering the system.',
      'A dashboard helps a team see data and project progress.',
      'Client feedback helps developers improve the next version.',
      'A tester checks if each feature works correctly.',
      'Clear documentation helps new team members understand a system.',
      'A prototype shows the main idea before the final product.',
      'A data report can support better decisions.',
      'A team stand-up usually includes progress, blockers, and next tasks.'
    ],
    writing: [
      'Write one simple sentence about your study.',
      'Write one sentence about an app you use.',
      'Write a short message to update your team.',
      'Write one sentence about a bug.',
      'Write a polite sentence to a client.',
      'Write one sentence about your project goal.',
      'Write a short sentence about data or AI.',
      'Write one sentence about your teamwork skill.',
      'Write one sentence about your future tech job.',
      'Write one sentence about how your project helps users.'
    ]
  };

  const DISTRACTORS = [
    'food order and restaurant menu',
    'sports practice and game result',
    'travel plan and hotel booking',
    'shopping list and product price',
    'movie story and actor name',
    'weather report and holiday plan',
    'music concert and ticket price',
    'family dinner and recipe',
    'pet care and animal food',
    'bus route and city map'
  ];

  const state = {
    activeItem: null,
    observer: null,
    speechText: ''
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
      const st = window.LESSON_MISSION_PANEL_FIX?.getState?.();
      if (st?.sid) return normalizeSid(st.sid);
    } catch (err) {}

    try {
      if (window.LESSON_CURRENT_STATE?.sid) return normalizeSid(window.LESSON_CURRENT_STATE.sid);
    } catch (err) {}

    return normalizeSid(q().get('s') || q().get('sid') || q().get('session') || '1');
  }

  function sessionOf(sid) {
    sid = normalizeSid(sid);
    return SESSIONS.find(s => s.sid === sid) || SESSIONS[0];
  }

  function normalizeLevel(level) {
    const raw = safe(level).toLowerCase();

    if (['easy', 'a2', 'e'].includes(raw)) return 'easy';
    if (['normal', 'a2+', 'medium', 'n'].includes(raw)) return 'normal';
    if (['hard', 'b1', 'h'].includes(raw)) return 'hard';
    if (['challenge', 'b1+', 'expert', 'x'].includes(raw)) return 'challenge';

    return 'easy';
  }

  function loadJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (err) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {}
  }

  function getGlobalAI() {
    const data = loadJSON(AI_KEY, {
      level: 'easy',
      correctStreak: 0,
      wrongStreak: 0,
      attempts: 0,
      updatedAt: ''
    });

    data.level = normalizeLevel(data.level);
    return data;
  }

  function getLevel() {
    const urlLevel = q().get('difficulty') || q().get('diff') || q().get('level');
    if (urlLevel) return normalizeLevel(urlLevel);

    try {
      const sid = currentSid();
      const ai = window.LESSON_AI_DIFFICULTY?.getRecommendedDifficulty?.(sid);
      if (ai && normalizeLevel(ai) !== 'easy') return normalizeLevel(ai);
    } catch (err) {}

    return getGlobalAI().level;
  }

  function promote(level) {
    const i = LEVELS.indexOf(normalizeLevel(level));
    return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i) + 1)];
  }

  function demote(level) {
    const i = LEVELS.indexOf(normalizeLevel(level));
    return LEVELS[Math.max(0, Math.max(0, i) - 1)];
  }

  function updateAI(passed) {
    const ai = getGlobalAI();
    ai.attempts = Number(ai.attempts || 0) + 1;

    if (passed) {
      ai.correctStreak = Number(ai.correctStreak || 0) + 1;
      ai.wrongStreak = 0;

      if (ai.correctStreak >= 2) {
        ai.level = promote(ai.level);
        ai.correctStreak = 0;
      }
    } else {
      ai.wrongStreak = Number(ai.wrongStreak || 0) + 1;
      ai.correctStreak = 0;
      ai.level = demote(ai.level);
    }

    ai.updatedAt = new Date().toISOString();
    saveJSON(AI_KEY, ai);

    const detail = {
      version: VERSION,
      difficulty: ai.level,
      level: ai.level,
      correctStreak: ai.correctStreak,
      wrongStreak: ai.wrongStreak,
      attempts: ai.attempts,
      reason: passed ? 'canonical_pass' : 'canonical_fail'
    };

    window.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));

    return ai;
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

  function levelInstruction(level, skill) {
    const meta = LEVEL_META[level] || LEVEL_META.easy;

    if (skill === 'listening') {
      if (level === 'easy') return 'ฟังประโยคสั้น ๆ แล้วเลือกใจความหลัก';
      if (level === 'normal') return 'ฟังรายละเอียดหลัก แล้วเลือกสรุปที่ตรงที่สุด';
      if (level === 'hard') return 'ฟังแล้วจับเจตนาและ next action';
      return 'ฟังข้อความยาวขึ้น แล้วเลือก summary ที่แม่นที่สุด';
    }

    if (skill === 'reading') {
      if (level === 'easy') return 'อ่านข้อความสั้น ๆ แล้วเลือกหัวข้อหลัก';
      if (level === 'normal') return 'อ่านแล้วเลือกใจความสำคัญ';
      if (level === 'hard') return 'อ่านแล้วตีความรายละเอียดและผลลัพธ์';
      return 'อ่านแล้วเลือก inference/summary ที่เหมาะที่สุด';
    }

    if (skill === 'writing') {
      return `เขียนอย่างน้อย ${meta.minWords} คำ และใช้ keyword อย่างน้อย ${meta.keywordNeed} คำ`;
    }

    if (skill === 'speaking') {
      return `พูด/พิมพ์คำตอบอย่างน้อย ${meta.minWords} คำ และใช้ keyword อย่างน้อย ${meta.keywordNeed} คำ`;
    }

    return 'ทำภารกิจให้ผ่านตามระดับภาษา';
  }

  function makeTextForSession(session, skill, i, level) {
    const actions = ACTIONS[skill] || ACTIONS.reading;
    const base = actions[i % actions.length];

    if (skill === 'listening') {
      if (level === 'easy') return base + '.';
      if (level === 'normal') return base + '. The main point is about ' + session.topic + '.';
      if (level === 'hard') return base + '. The listener should understand the key detail and respond clearly.';
      return base + '. The message connects the project context, clear communication, and the next action.';
    }

    if (skill === 'reading') {
      if (level === 'easy') return base;
      if (level === 'normal') return base + ' This helps the team communicate more clearly.';
      if (level === 'hard') return base + ' If the team records the result, the next member can continue the work without confusion.';
      return base + ' This means effective communication is not only about giving information, but also about making the next decision clear.';
    }

    return base;
  }

  function makeCorrect(session, skill, text, i, level) {
    if (skill === 'listening') {
      if (level === 'easy') return text.replace(/\.$/, '');
      if (level === 'normal') return 'The main message is about ' + session.topic + '.';
      if (level === 'hard') return 'The listener should understand the key detail and next action.';
      return 'The best summary connects the project context with clear next action.';
    }

    if (skill === 'reading') {
      if (level === 'easy') return session.topic;
      if (level === 'normal') return 'clear work or study communication';
      if (level === 'hard') return 'the team can continue the work with less confusion';
      return 'communication should support both understanding and decision-making';
    }

    return '';
  }

  function makeChoices(session, skill, correct, i, level) {
    const distractors = seededShuffle(DISTRACTORS, `${session.sid}|${skill}|${level}|${i}|d`);
    return seededShuffle([
      { text: correct, correct: true },
      { text: distractors[0], correct: false },
      { text: distractors[1], correct: false },
      { text: distractors[2], correct: false }
    ], `${session.sid}|${skill}|${level}|${i}|choices`);
  }

  function buildItem(session, level, i) {
    const skill = session.skill;
    const meta = LEVEL_META[level] || LEVEL_META.easy;
    const text = makeTextForSession(session, skill === 'speaking' ? 'speaking' : skill, i, level);
    const correct = makeCorrect(session, skill, text, i, level);

    const id = `${session.sid}-${skill}-${level}-${String(i + 1).padStart(2, '0')}`;

    const item = {
      id,
      no: i + 1,
      sid: session.sid,
      title: session.title,
      skill,
      boss: !!session.boss,
      level,
      cefr: meta.cefr,
      support: meta.support,
      topic: session.topic,
      keywords: session.keywords.slice(0, 6),
      instruction: levelInstruction(level, skill),
      prompt: text,
      question: '',
      choices: [],
      correctText: correct,
      passScore: 70
    };

    if (skill === 'listening') {
      item.question = level === 'easy'
        ? 'What is the main topic?'
        : level === 'normal'
          ? 'What does the speaker mainly say?'
          : level === 'hard'
            ? 'What should the listener understand?'
            : 'Which summary best matches the message?';
      item.audio = text;
      item.choices = makeChoices(session, skill, correct, i, level);
    }

    if (skill === 'reading') {
      item.question = level === 'easy'
        ? 'What is the passage mainly about?'
        : level === 'normal'
          ? 'What is the best summary?'
          : level === 'hard'
            ? 'What can we understand from the passage?'
            : 'Which inference is most appropriate?';
      item.passage = text;
      item.choices = makeChoices(session, skill, correct, i, level);
    }

    if (skill === 'writing') {
      item.question = 'Write your answer.';
      item.frame = level === 'easy'
        ? 'I study _____. I can _____.'
        : level === 'normal'
          ? 'My project is about _____. It helps _____.'
          : level === 'hard'
            ? 'This system helps users because _____. The next step is _____.'
            : 'My project solves _____ by using _____. It gives value because _____.';
      item.starter = level === 'easy'
        ? 'I study computer science. I can build an app.'
        : level === 'normal'
          ? 'My project is about a study planner. It helps students.'
          : level === 'hard'
            ? 'This system helps users manage tasks. The next step is testing.'
            : 'My project solves a communication problem by using data and feedback.';
    }

    if (skill === 'speaking') {
      item.question = 'Say clearly.';
      item.target = level === 'easy'
        ? `I am a computer science student. I can build a simple app.`
        : level === 'normal'
          ? `My project is about ${session.topic}. It helps users.`
          : level === 'hard'
            ? `This system helps users because it gives clear information and useful feedback.`
            : `My project solves a real user problem by using clear design, data, and teamwork.`;
      item.starter = item.target;
    }

    return item;
  }

  function buildPool(sid, level) {
    const session = sessionOf(sid);
    const pool = [];
    for (let i = 0; i < 10; i++) {
      pool.push(buildItem(session, level, i));
    }
    return pool;
  }

  function getActiveItem() {
    const sid = currentSid();
    const level = getLevel();
    const session = sessionOf(sid);
    const activeStore = loadJSON(ACTIVE_KEY, {});
    const indexStore = loadJSON(INDEX_KEY, {});

    const activeKey = `${sid}|${level}|${location.search}`;
    const pool = buildPool(sid, level);

    if (activeStore[activeKey] && pool[activeStore[activeKey]]) {
      state.activeItem = pool[activeStore[activeKey]];
      return state.activeItem;
    }

    const indexKey = `${sid}|${level}`;
    const idx = Number(indexStore[indexKey] || 0) % 10;

    indexStore[indexKey] = (idx + 1) % 10;
    activeStore[activeKey] = idx;

    saveJSON(INDEX_KEY, indexStore);
    saveJSON(ACTIVE_KEY, activeStore);

    state.activeItem = pool[idx];
    return state.activeItem;
  }

  function nextItemSameSession() {
    const sid = currentSid();
    const level = getLevel();
    const activeStore = loadJSON(ACTIVE_KEY, {});
    const indexStore = loadJSON(INDEX_KEY, {});
    const activeKey = `${sid}|${level}|${location.search}`;
    const indexKey = `${sid}|${level}`;
    const idx = Number(indexStore[indexKey] || 0) % 10;

    indexStore[indexKey] = (idx + 1) % 10;
    activeStore[activeKey] = idx;

    saveJSON(INDEX_KEY, indexStore);
    saveJSON(ACTIVE_KEY, activeStore);

    state.activeItem = buildPool(sid, level)[idx];
    render(true);
  }

  function getPanel() {
    return $('#lessonMissionPanel') || $('.lesson-mission-panel') || $('[data-lesson-mission-panel]') || null;
  }

  function ensureCSS() {
    if ($('#lesson-canonical-skill-flow-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-canonical-skill-flow-css';
    style.textContent = `
      #lessonCanonBox{
        display:grid;
        gap:12px;
        margin:12px 0 0;
        color:#0f172a;
      }
      #lessonCanonBox *{ box-sizing:border-box; }
      .canon-card{
        border:1px solid rgba(147,197,253,.55);
        border-radius:18px;
        background:rgba(239,246,255,.95);
        padding:14px;
      }
      .canon-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        color:#1d4ed8;
        font-weight:1000;
        margin-bottom:8px;
      }
      .canon-badge{
        border-radius:999px;
        background:#dbeafe;
        color:#1d4ed8;
        padding:6px 9px;
        font-size:12px;
        font-weight:1000;
      }
      .canon-question{
        font-size:18px;
        line-height:1.35;
        font-weight:1000;
        color:#0f172a;
      }
      .canon-text{
        margin-top:10px;
        border-radius:15px;
        background:#fff;
        border:1px solid rgba(148,163,184,.45);
        padding:12px;
        font-weight:850;
        line-height:1.45;
        color:#1e293b;
      }
      .canon-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .canon-btn{
        border:0;
        border-radius:999px;
        padding:12px 16px;
        font-weight:1000;
        cursor:pointer;
      }
      .canon-primary{ background:#22c55e; color:#052e16; }
      .canon-warn{ background:#fef3c7; color:#92400e; }
      .canon-blue{ background:#dbeafe; color:#1d4ed8; }
      .canon-choices{
        display:grid;
        gap:10px;
      }
      .canon-choice{
        display:grid;
        grid-template-columns:42px 1fr;
        gap:12px;
        align-items:center;
        width:100%;
        border:0;
        border-radius:18px;
        padding:13px 14px;
        background:linear-gradient(135deg,#67e8f9,#22d3ee);
        color:#0f172a;
        text-align:left;
        font-weight:1000;
        cursor:pointer;
      }
      .canon-choice[disabled]{
        opacity:.48;
        cursor:not-allowed;
      }
      .canon-choice.correct{
        background:linear-gradient(135deg,#86efac,#22c55e);
      }
      .canon-choice.wrong{
        background:linear-gradient(135deg,#fecaca,#f87171);
      }
      .canon-letter{
        width:34px;
        height:34px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:rgba(255,255,255,.55);
      }
      .canon-input{
        width:100%;
        min-height:115px;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.55);
        padding:12px;
        font-weight:850;
        font-size:16px;
        line-height:1.45;
        color:#0f172a;
        background:#fff;
        resize:vertical;
      }
      .canon-guide{
        display:grid;
        gap:8px;
        border-radius:18px;
        background:#f8fafc;
        border:1px solid rgba(148,163,184,.35);
        padding:12px;
        color:#334155;
        font-weight:850;
      }
      .canon-keywords{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
      }
      .canon-key{
        border-radius:999px;
        background:#fee2e2;
        color:#991b1b;
        padding:5px 8px;
        font-weight:1000;
        font-size:12px;
      }
      .canon-feedback{
        border-radius:18px;
        padding:12px 14px;
        background:#f8fafc;
        color:#334155;
        font-weight:900;
        line-height:1.45;
      }
      .canon-feedback.pass{ background:#dcfce7; color:#166534; }
      .canon-feedback.fail{ background:#fee2e2; color:#991b1b; }
      #lessonListeningQualityBox,
      #lessonWritingAiGuide{
        display:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(text) {
    return safe(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function icon(skill) {
    if (skill === 'listening') return '🎧';
    if (skill === 'speaking') return '🎤';
    if (skill === 'reading') return '📖';
    if (skill === 'writing') return '✍️';
    return '⭐';
  }

  function hideOldFallback(panel) {
    if (!panel) return;

    $all('button, [role="button"]', panel).forEach(btn => {
      if (btn.closest('#lessonCanonBox')) return;
      const t = safe(btn.innerText || btn.textContent);
      if (/simple study|food order|sports|travel|Check Writing|Check Speaking|Listen|เปลี่ยนข้อ/i.test(t)) {
        btn.style.display = 'none';
        btn.style.pointerEvents = 'none';
      }
    });
  }

  function render(force) {
    const panel = getPanel();
    if (!panel) return;

    ensureCSS();

    const item = getActiveItem();
    const meta = LEVEL_META[item.level] || LEVEL_META.easy;

    hideOldFallback(panel);

    let box = $('#lessonCanonBox', panel);
    if (!box) {
      box = document.createElement('section');
      box.id = 'lessonCanonBox';
      panel.appendChild(box);
    }

    panel.dataset.canonicalSkillFlow = 'on';

    if (item.skill === 'listening') renderListening(box, item, meta);
    else if (item.skill === 'reading') renderReading(box, item, meta);
    else if (item.skill === 'writing') renderWriting(box, item, meta);
    else if (item.skill === 'speaking') renderSpeaking(box, item, meta);

    updateTopDifficulty(item.level);

    console.log('[TechPathCanonicalSkillFlow] render', {
      version: VERSION,
      sid: item.sid,
      skill: item.skill,
      level: item.level,
      cefr: item.cefr,
      itemNo: item.no,
      id: item.id
    });
  }

  function headerHTML(item, meta) {
    return `
      <div class="canon-card">
        <div class="canon-title">
          <span>${item.boss ? '👑 ' : ''}${icon(item.skill)} ${item.sid} • ${item.title}</span>
          <span class="canon-badge">${meta.label} • ${meta.cefr} • Q${item.no}/10</span>
        </div>
        <div class="canon-question">${escapeHtml(item.instruction)}</div>
      </div>
    `;
  }

  function renderListening(box, item, meta) {
    box.innerHTML = `
      ${headerHTML(item, meta)}
      <div class="canon-card">
        <div class="canon-question">${escapeHtml(item.question)}</div>
        <div class="canon-text">กด Listen ก่อน แล้วเลือกคำตอบที่ตรงกับเสียงที่ได้ยิน</div>
        <details class="canon-text">
          <summary>Transcript สำหรับครู/ทดสอบ</summary>
          ${escapeHtml(item.audio)}
        </details>
      </div>
      <div class="canon-actions">
        <button class="canon-btn canon-primary" id="canonListenBtn">🔊 Listen</button>
        <button class="canon-btn canon-warn" id="canonChangeBtn">↻ เปลี่ยนข้อ</button>
      </div>
      <div class="canon-choices" id="canonChoices">
        ${item.choices.map((c, idx) => `
          <button class="canon-choice" data-choice="${idx}" disabled>
            <span class="canon-letter">${String.fromCharCode(65 + idx)}</span>
            <span>${escapeHtml(c.text)}</span>
          </button>
        `).join('')}
      </div>
      <div class="canon-feedback" id="canonFeedback">ต้องกด Listen ก่อน จึงจะตอบได้</div>
    `;

    $('#canonListenBtn', box)?.addEventListener('click', () => {
      speak(item.audio);
      $all('[data-choice]', box).forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('disabled');
      });
      $('#canonFeedback', box).textContent = 'ฟังแล้ว เลือกคำตอบที่ตรงที่สุด';
    });

    bindChoiceEvents(box, item);
    $('#canonChangeBtn', box)?.addEventListener('click', nextItemSameSession);
  }

  function renderReading(box, item, meta) {
    box.innerHTML = `
      ${headerHTML(item, meta)}
      <div class="canon-card">
        <div class="canon-question">${escapeHtml(item.question)}</div>
        <div class="canon-text">${escapeHtml(item.passage)}</div>
      </div>
      <div class="canon-actions">
        <button class="canon-btn canon-warn" id="canonChangeBtn">↻ เปลี่ยนข้อ</button>
      </div>
      <div class="canon-choices" id="canonChoices">
        ${item.choices.map((c, idx) => `
          <button class="canon-choice" data-choice="${idx}">
            <span class="canon-letter">${String.fromCharCode(65 + idx)}</span>
            <span>${escapeHtml(c.text)}</span>
          </button>
        `).join('')}
      </div>
      <div class="canon-feedback" id="canonFeedback">อ่านแล้วเลือกคำตอบที่ดีที่สุด</div>
    `;

    bindChoiceEvents(box, item);
    $('#canonChangeBtn', box)?.addEventListener('click', nextItemSameSession);
  }

  function renderWriting(box, item, meta) {
    box.innerHTML = `
      ${headerHTML(item, meta)}
      <div class="canon-card">
        <div class="canon-question">${escapeHtml(item.question)}</div>
        <div class="canon-text">SYSTEM: ${escapeHtml(item.prompt)}</div>
        <div class="canon-text">Starter: ${escapeHtml(item.starter)}</div>
      </div>
      <div class="canon-guide">
        <b>AI Writing Guide • ${meta.cefr} • ${meta.support}</b>
        <div>Sentence frame: ${escapeHtml(item.frame)}</div>
        <div>Target: อย่างน้อย ${meta.minWords} คำ และใช้ keyword อย่างน้อย ${meta.keywordNeed} คำ</div>
        <div class="canon-keywords">
          ${item.keywords.map(k => `<span class="canon-key">+ ${escapeHtml(k)}</span>`).join('')}
        </div>
      </div>
      <textarea class="canon-input" id="canonTextInput" placeholder="พิมพ์คำตอบภาษาอังกฤษที่นี่..."></textarea>
      <div class="canon-actions">
        <button class="canon-btn canon-primary" id="canonCheckBtn">✅ Check Writing</button>
        <button class="canon-btn canon-warn" id="canonChangeBtn">↻ เปลี่ยนข้อ</button>
      </div>
      <div class="canon-feedback" id="canonFeedback">เขียนให้ครบตาม guide แล้วกด Check Writing</div>
    `;

    $('#canonCheckBtn', box)?.addEventListener('click', () => {
      const text = safe($('#canonTextInput', box)?.value);
      const result = validateTextAnswer(text, item, meta);
      finishOpenAnswer(box, item, result, text);
    });

    $('#canonChangeBtn', box)?.addEventListener('click', nextItemSameSession);
  }

  function renderSpeaking(box, item, meta) {
    box.innerHTML = `
      ${headerHTML(item, meta)}
      <div class="canon-card">
        <div class="canon-question">${escapeHtml(item.question)}</div>
        <div class="canon-text">${escapeHtml(item.target)}</div>
      </div>
      <div class="canon-guide">
        <b>Speaking Guide • ${meta.cefr} • ${meta.support}</b>
        <div>พูดหรือพิมพ์คำตอบให้ครบอย่างน้อย ${meta.minWords} คำ</div>
        <div class="canon-keywords">
          ${item.keywords.map(k => `<span class="canon-key">+ ${escapeHtml(k)}</span>`).join('')}
        </div>
      </div>
      <div class="canon-actions">
        <button class="canon-btn canon-blue" id="canonSampleBtn">🔊 Listen Sample</button>
        <button class="canon-btn canon-primary" id="canonSpeakBtn">🎤 Start Speaking</button>
        <button class="canon-btn canon-warn" id="canonChangeBtn">↻ เปลี่ยนข้อ</button>
      </div>
      <textarea class="canon-input" id="canonTextInput" placeholder="ถ้าไมค์ใช้ไม่ได้ พิมพ์ประโยคที่พูดที่นี่..."></textarea>
      <div class="canon-actions">
        <button class="canon-btn canon-primary" id="canonCheckBtn">✅ Check Speaking Text</button>
      </div>
      <div class="canon-feedback" id="canonFeedback">ฟังตัวอย่าง แล้วพูด/พิมพ์ให้ตรงประเด็น</div>
    `;

    $('#canonSampleBtn', box)?.addEventListener('click', () => speak(item.target));
    $('#canonSpeakBtn', box)?.addEventListener('click', () => startSpeechToText(box));
    $('#canonCheckBtn', box)?.addEventListener('click', () => {
      const text = safe($('#canonTextInput', box)?.value || state.speechText);
      const result = validateTextAnswer(text, item, meta);
      finishOpenAnswer(box, item, result, text);
    });

    $('#canonChangeBtn', box)?.addEventListener('click', nextItemSameSession);
  }

  function bindChoiceEvents(box, item) {
    $all('[data-choice]', box).forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.choice || 0);
        const choice = item.choices[idx];
        const passed = !!choice.correct;

        $all('[data-choice]', box).forEach(b => {
          b.disabled = true;
          b.setAttribute('disabled', 'disabled');
          const c = item.choices[Number(b.dataset.choice || 0)];
          if (c.correct) b.classList.add('correct');
        });

        if (!passed) btn.classList.add('wrong');

        const fb = $('#canonFeedback', box);
        if (fb) {
          fb.className = `canon-feedback ${passed ? 'pass' : 'fail'}`;
          fb.textContent = passed
            ? '✅ ถูกต้อง ผ่านด่านนี้แล้ว'
            : `❌ ยังไม่ตรง คำตอบที่ถูกคือ: ${item.correctText}`;
        }

        finishResult(item, passed, choice.text, item.correctText);
      });
    });
  }

  function countWords(text) {
    return safe(text).split(/\s+/).filter(Boolean).length;
  }

  function validateTextAnswer(text, item, meta) {
    const lower = text.toLowerCase();
    const words = countWords(text);
    const hitKeywords = item.keywords.filter(k => lower.includes(k.toLowerCase()));
    const hasVerb = /\b(am|is|are|study|use|build|make|test|fix|help|explain|design|develop|learn|work|solve|improve)\b/i.test(text);
    const passed = words >= meta.minWords && hitKeywords.length >= meta.keywordNeed && hasVerb;

    return {
      passed,
      score: passed ? 100 : Math.max(0, Math.min(60, words * 6 + hitKeywords.length * 10 + (hasVerb ? 10 : 0))),
      words,
      hitKeywords,
      message: passed
        ? '✅ ถูกต้อง ผ่านด่านนี้แล้ว'
        : `ยังไม่ผ่าน: ตอนนี้ ${words}/${meta.minWords} คำ, keyword ${hitKeywords.length}/${meta.keywordNeed}, ต้องมี verb ชัดเจน`
    };
  }

  function finishOpenAnswer(box, item, result, answer) {
    const fb = $('#canonFeedback', box);
    if (fb) {
      fb.className = `canon-feedback ${result.passed ? 'pass' : 'fail'}`;
      fb.textContent = result.message;
    }

    finishResult(item, result.passed, answer, item.target || item.starter || item.correctText, result.score);
  }

  function finishResult(item, passed, answer, correctAnswer, score) {
    const finalScore = typeof score === 'number' ? score : (passed ? 100 : 0);

    updateAI(passed);

    const detail = {
      version: VERSION,
      sid: item.sid,
      itemId: item.id,
      itemNo: item.no,
      skill: item.skill,
      type: item.skill,
      boss: item.boss,
      difficulty: item.level,
      cefr: item.cefr,
      answer,
      correctAnswer,
      passed,
      correct: passed,
      isCorrect: passed,
      score: finalScore,
      passScore: item.passScore,
      question: item.question || item.prompt,
      topic: item.topic
    };

    window.dispatchEvent(new CustomEvent('lesson:item-result', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:item-result', { detail }));

    window.dispatchEvent(new CustomEvent(`lesson:${item.skill}-result`, { detail }));
    document.dispatchEvent(new CustomEvent(`lesson:${item.skill}-result`, { detail }));

    if (passed) {
      window.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
      document.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
    }
  }

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.88;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
      return true;
    } catch (err) {
      return false;
    }
  }

  function startSpeechToText(box) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const fb = $('#canonFeedback', box);

    if (!SpeechRecognition) {
      if (fb) {
        fb.className = 'canon-feedback fail';
        fb.textContent = 'ไมค์/ระบบ speech ใช้ไม่ได้ใน browser นี้ ให้พิมพ์คำตอบแทน';
      }
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      if (fb) {
        fb.className = 'canon-feedback';
        fb.textContent = 'กำลังฟัง... พูดภาษาอังกฤษได้เลย';
      }

      rec.onresult = ev => {
        const text = safe(ev.results?.[0]?.[0]?.transcript || '');
        state.speechText = text;
        const input = $('#canonTextInput', box);
        if (input) input.value = text;

        if (fb) {
          fb.className = 'canon-feedback';
          fb.textContent = `ระบบได้ยินว่า: ${text}`;
        }
      };

      rec.onerror = () => {
        if (fb) {
          fb.className = 'canon-feedback fail';
          fb.textContent = 'ไมค์ไม่ทำงาน ให้พิมพ์คำตอบแทนได้';
        }
      };

      rec.start();
    } catch (err) {
      if (fb) {
        fb.className = 'canon-feedback fail';
        fb.textContent = 'เปิดไมค์ไม่สำเร็จ ให้พิมพ์คำตอบแทนได้';
      }
    }
  }

  function updateTopDifficulty(level) {
    const pill = $('#lessonDifficultyPill');
    if (pill) pill.textContent = `Q: ${String(level || 'easy').toUpperCase()}`;
  }

  function patchSessionBoardLabels() {
    try {
      window.LESSON_CANONICAL_SESSIONS = SESSIONS;
      window.LESSON_CANONICAL_BANK_FIX = {
        version: VERSION,
        sessions: SESSIONS,
        levels: LEVELS,
        buildPool,
        getActiveItem,
        nextItemSameSession,
        render,
        getAI: getGlobalAI,
        resetAI() {
          localStorage.removeItem(AI_KEY);
        },
        resetIndexes() {
          localStorage.removeItem(INDEX_KEY);
          sessionStorage.removeItem(ACTIVE_KEY);
        }
      };
    } catch (err) {}
  }

  function boot() {
    ensureCSS();
    patchSessionBoardLabels();

    const events = [
      'lesson:data-bridge-ready',
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:view-mode-ready',
      'lesson:ai-difficulty-updated'
    ];

    events.forEach(name => {
      window.addEventListener(name, () => setTimeout(() => render(false), 80));
      document.addEventListener(name, () => setTimeout(() => render(false), 80));
    });

    setTimeout(() => render(false), 250);
    setTimeout(() => render(false), 900);
    setTimeout(() => render(false), 1800);

    console.log('[TechPathCanonicalSkillFlow]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
