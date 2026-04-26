// === /english/lesson-skill-router.js ===
// PATCH v20260424c-LESSON-SKILL-ROUTER-A2B1PLUS
// Core system for English Quest A2-B1+
// S1-S15 + Boss every 3 sessions + 4 difficulty levels + 10 items/level

(function () {
  'use strict';

  const VERSION = 'v20260424c-LESSON-SKILL-ROUTER-A2B1PLUS';

  const STORAGE_PROFILE = 'ENGLISH_QUEST_AI_PROFILE_V1';
  const STORAGE_LAST_ITEM = 'ENGLISH_QUEST_LAST_ITEM_V1';

  const DIFF_ORDER = ['easy', 'normal', 'hard', 'expert'];

  const DIFFICULTY_LEVELS = {
    easy: {
      key: 'easy',
      label: 'Easy',
      cefr: 'A2',
      order: 0,
      itemCount: 10,
      passScore: 65,
      description: 'Short sentence, simple vocabulary, one-step task'
    },
    normal: {
      key: 'normal',
      label: 'Normal',
      cefr: 'A2+',
      order: 1,
      itemCount: 10,
      passScore: 72,
      description: 'Simple CS/AI context, 1-2 sentence task'
    },
    hard: {
      key: 'hard',
      label: 'Hard',
      cefr: 'B1',
      order: 2,
      itemCount: 10,
      passScore: 78,
      description: 'Reason, problem description, short explanation'
    },
    expert: {
      key: 'expert',
      label: 'Expert',
      cefr: 'B1+',
      order: 3,
      itemCount: 10,
      passScore: 84,
      description: 'Challenge task, mini presentation, boss-level response'
    }
  };

  const LESSON_ROUTE = {
    S1: {
      sid: 'S1',
      no: 1,
      skill: 'speaking',
      boss: false,
      title: 'Self-Introduction in Tech',
      theme: 'introducing yourself as a CS/AI student'
    },
    S2: {
      sid: 'S2',
      no: 2,
      skill: 'listening',
      boss: false,
      title: 'Academic Background and Projects',
      theme: 'listening to academic background and project information'
    },
    S3: {
      sid: 'S3',
      no: 3,
      skill: 'boss',
      boss: true,
      bossNo: 1,
      title: 'Boss 1: Intro + Academic Challenge',
      theme: 'introductions, academic background, and tech roles'
    },

    S4: {
      sid: 'S4',
      no: 4,
      skill: 'reading',
      boss: false,
      title: 'Tech Jobs and Roles',
      theme: 'reading about jobs and roles in technology'
    },
    S5: {
      sid: 'S5',
      no: 5,
      skill: 'writing',
      boss: false,
      title: 'Emails and Chat',
      theme: 'writing simple emails and workplace chat messages'
    },
    S6: {
      sid: 'S6',
      no: 6,
      skill: 'boss',
      boss: true,
      bossNo: 2,
      title: 'Boss 2: Workplace Communication',
      theme: 'emails, chat, meetings, and workplace communication'
    },

    S7: {
      sid: 'S7',
      no: 7,
      skill: 'speaking',
      boss: false,
      title: 'Explaining a System',
      theme: 'speaking about how a system works'
    },
    S8: {
      sid: 'S8',
      no: 8,
      skill: 'reading',
      boss: false,
      title: 'Describing Problems and Bugs',
      theme: 'reading bug reports and problem descriptions'
    },
    S9: {
      sid: 'S9',
      no: 9,
      skill: 'boss',
      boss: true,
      bossNo: 3,
      title: 'Boss 3: Team Stand-up Mission',
      theme: 'system explanation, bugs, and team stand-up'
    },

    S10: {
      sid: 'S10',
      no: 10,
      skill: 'listening',
      boss: false,
      title: 'Client Communication',
      theme: 'listening to client requests and project updates'
    },
    S11: {
      sid: 'S11',
      no: 11,
      skill: 'writing',
      boss: false,
      title: 'Data and AI Communication',
      theme: 'writing short AI and data explanations'
    },
    S12: {
      sid: 'S12',
      no: 12,
      skill: 'boss',
      boss: true,
      bossNo: 4,
      title: 'Boss 4: Portfolio + AI Mission',
      theme: 'client communication, data, AI, and portfolio skills'
    },

    S13: {
      sid: 'S13',
      no: 13,
      skill: 'speaking',
      boss: false,
      title: 'Job Interview',
      theme: 'speaking in a job interview'
    },
    S14: {
      sid: 'S14',
      no: 14,
      skill: 'speaking',
      boss: false,
      title: 'Project Pitch',
      theme: 'speaking to pitch a project'
    },
    S15: {
      sid: 'S15',
      no: 15,
      skill: 'finalBoss',
      boss: true,
      bossNo: 5,
      title: 'Final Boss: Capstone Career Mission',
      theme: 'final career mission using CS/AI English'
    }
  };

  const SKILL_LABELS = {
    listening: 'Listening',
    speaking: 'Speaking',
    reading: 'Reading',
    writing: 'Writing',
    boss: 'Boss',
    finalBoss: 'Final Boss'
  };

  const BOSS_SKILL_CYCLE = [
    'listening',
    'speaking',
    'reading',
    'writing',
    'speaking',
    'listening',
    'reading',
    'writing',
    'speaking',
    'writing'
  ];

  const NAMES = [
    'Anna',
    'Ben',
    'Mina',
    'Krit',
    'Nina',
    'Mark',
    'Ploy',
    'Jay',
    'Emma',
    'Leo'
  ];

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function safeText(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizeSid(v) {
    const raw = safeText(v || '').toUpperCase();

    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(15, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }

    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function normalizeDifficulty(v) {
    const raw = safeText(v || '').toLowerCase();

    if (['easy', 'e', 'a2'].includes(raw)) return 'easy';
    if (['normal', 'medium', 'n', 'a2+'].includes(raw)) return 'normal';
    if (['hard', 'h', 'b1'].includes(raw)) return 'hard';
    if (['expert', 'challenge', 'x', 'b1+'].includes(raw)) return 'expert';

    return 'normal';
  }

  function getQuery() {
    return new URLSearchParams(location.search || '');
  }

  function getStateFromUrl() {
    const q = getQuery();

    const sid = normalizeSid(
      q.get('s') ||
      q.get('sid') ||
      q.get('session') ||
      q.get('unit') ||
      q.get('lesson') ||
      q.get('lessonId') ||
      '1'
    );

    const route = LESSON_ROUTE[sid] || LESSON_ROUTE.S1;

    const urlDiff = q.get('diff') || q.get('difficulty') || q.get('level') || '';
    const profileDiff = getRecommendedDifficulty(sid);
    const difficulty = normalizeDifficulty(urlDiff || profileDiff || 'normal');

    const seed = safeText(q.get('seed') || Date.now());
    const view = safeText(q.get('view') || 'mobile');
    const run = safeText(q.get('run') || 'play');
    const mode = safeText(q.get('mode') || route.skill);

    return {
      sid,
      sessionNo: route.no,
      route,
      skill: route.skill,
      boss: !!route.boss,
      bossNo: route.bossNo || 0,
      difficulty,
      cefr: DIFFICULTY_LEVELS[difficulty].cefr,
      seed,
      view,
      run,
      mode
    };
  }

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PROFILE) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
    } catch (err) {}
  }

  function getSessionProfile(sid) {
    sid = normalizeSid(sid);

    const profile = loadProfile();

    if (!profile.sessions) profile.sessions = {};

    if (!profile.sessions[sid]) {
      profile.sessions[sid] = {
        sid,
        currentDifficulty: 'normal',
        attempts: 0,
        correct: 0,
        wrong: 0,
        correctStreak: 0,
        wrongStreak: 0,
        accuracy: 0,
        nextIndexByDifficulty: {
          easy: 0,
          normal: 0,
          hard: 0,
          expert: 0
        },
        lastScore: 0,
        updatedAt: null
      };
    }

    saveProfile(profile);

    return profile.sessions[sid];
  }

  function getRecommendedDifficulty(sid) {
    const sp = getSessionProfile(sid);
    return normalizeDifficulty(sp.currentDifficulty || 'normal');
  }

  function nextDifficulty(current, result) {
    current = normalizeDifficulty(current);

    const i = DIFF_ORDER.indexOf(current);
    const accuracy = Number(result.accuracy || 0);
    const score = Number(result.score || 0);
    const correctStreak = Number(result.correctStreak || 0);
    const wrongStreak = Number(result.wrongStreak || 0);

    const good = accuracy >= 88 || score >= 88 || correctStreak >= 3;
    const weak = accuracy < 60 || score < 60 || wrongStreak >= 2;

    if (good) {
      return DIFF_ORDER[Math.min(i + 1, DIFF_ORDER.length - 1)];
    }

    if (weak) {
      return DIFF_ORDER[Math.max(i - 1, 0)];
    }

    return current;
  }

  function reportResult(result) {
    const sid = normalizeSid(result.sid || CURRENT_STATE.sid || 'S1');
    const difficulty = normalizeDifficulty(result.difficulty || CURRENT_STATE.difficulty || 'normal');

    const profile = loadProfile();
    if (!profile.sessions) profile.sessions = {};

    const sp = profile.sessions[sid] || getSessionProfile(sid);

    const score = Number(result.score || 0);
    const threshold = Number(result.passScore || DIFFICULTY_LEVELS[difficulty].passScore || 72);

    const passed =
      typeof result.passed === 'boolean'
        ? result.passed
        : typeof result.correct === 'boolean'
          ? result.correct
          : score >= threshold;

    sp.attempts = Number(sp.attempts || 0) + 1;
    sp.lastScore = score;

    if (passed) {
      sp.correct = Number(sp.correct || 0) + 1;
      sp.correctStreak = Number(sp.correctStreak || 0) + 1;
      sp.wrongStreak = 0;
    } else {
      sp.wrong = Number(sp.wrong || 0) + 1;
      sp.wrongStreak = Number(sp.wrongStreak || 0) + 1;
      sp.correctStreak = 0;
    }

    const total = Math.max(1, Number(sp.correct || 0) + Number(sp.wrong || 0));
    sp.accuracy = Math.round((Number(sp.correct || 0) / total) * 100);

    const recommended = nextDifficulty(difficulty, {
      score,
      accuracy: sp.accuracy,
      correctStreak: sp.correctStreak,
      wrongStreak: sp.wrongStreak
    });

    sp.currentDifficulty = recommended;
    sp.updatedAt = new Date().toISOString();

    profile.sessions[sid] = sp;
    profile.last = {
      sid,
      difficulty,
      recommendedDifficulty: recommended,
      score,
      passed,
      at: sp.updatedAt
    };

    saveProfile(profile);

    const detail = {
      version: VERSION,
      sid,
      difficulty,
      recommendedDifficulty: recommended,
      score,
      passed,
      profile: sp
    };

    window.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:ai-difficulty-updated', { detail }));

    return detail;
  }

  function textForSpeaking(sid, diff, idx, route) {
    const name = NAMES[(idx - 1) % NAMES.length];

    const map = {
      easy: [
        `My name is ${name} and I am a student.`,
        `I study computer science.`,
        `I can write simple code.`,
        `I like technology.`,
        `I use a computer every day.`,
        `I want to learn English for technology.`,
        `I am interested in AI.`,
        `I can work with my team.`,
        `I want to build useful apps.`,
        `I am ready to learn.`
      ],
      normal: [
        `My name is ${name}. I study computer science and artificial intelligence.`,
        `I can write simple programs and test them.`,
        `My project is a small web application for students.`,
        `I use English to explain my technology project.`,
        `I want to improve my speaking for job interviews.`,
        `I can describe my skills in simple English.`,
        `I am learning AI because it is useful for many applications.`,
        `I can work with a team and share ideas.`,
        `My goal is to become a software developer.`,
        `I can present my project clearly.`
      ],
      hard: [
        `My name is ${name}. I study AI because I want to solve real problems with technology.`,
        `I can explain my project, describe the main feature, and give a simple reason.`,
        `A good developer should write clear code, test it, and communicate with the team.`,
        `I want to improve my English because many technology documents are written in English.`,
        `My application helps users save time by organizing information clearly.`,
        `I can describe a bug, explain the problem, and suggest a possible solution.`,
        `Artificial intelligence can help users make better decisions from data.`,
        `I am interested in this career because I like building useful digital tools.`,
        `In my project, users can log in, save data, and view a simple dashboard.`,
        `I can present my skills, my project, and my learning goal in English.`
      ],
      expert: [
        `My name is ${name}. I am a CS and AI student, and I want to build applications that support real users.`,
        `My project solves a simple but important problem by using data, a clear interface, and useful feedback.`,
        `I think communication is important for developers because a good idea must be explained clearly to users and teammates.`,
        `In my future job, I want to design AI tools that are helpful, safe, and easy for people to understand.`,
        `When I find a bug, I check the steps, test the feature, and explain the issue to my team clearly.`,
        `This system collects user input, processes the data, and shows results in a dashboard for decision making.`,
        `I chose this project because it connects programming skills with a real need in education or business.`,
        `A strong portfolio should show the problem, the solution, the technology, and the result of the project.`,
        `During a project pitch, I should explain the user problem, the main feature, and the value of the solution.`,
        `I can introduce myself, explain my skills, and present my final project with confidence.`
      ]
    };

    return map[diff][idx - 1] || map.normal[0];
  }

  function makeListeningItem(sid, diff, idx, route, skill) {
    const level = DIFFICULTY_LEVELS[diff];
    const actor = NAMES[(idx - 1) % NAMES.length];

    const scripts = {
      easy: `${actor} is a computer science student. ${actor} likes coding and simple web apps.`,
      normal: `${actor} studies computer science and AI. The project is a small app that helps students manage tasks.`,
      hard: `${actor} is explaining a project to a teacher. The app helps users organize data, check progress, and solve a small problem.`,
      expert: `${actor} is presenting a CS and AI project. The system collects user input, analyzes simple data, and shows useful feedback on a dashboard.`
    };

    return {
      id: `${sid}-LI-${diff.toUpperCase()}-${String(idx).padStart(2, '0')}`,
      sid,
      sessionNo: route.no,
      skill,
      difficulty: diff,
      cefr: level.cefr,
      boss: !!route.boss,
      bossNo: route.bossNo || 0,
      title: route.title,
      prompt: 'Listen to the short audio/script and choose the best answer.',
      audioText: scripts[diff],
      question: 'What is the main topic?',
      choices: [
        'A technology or study project',
        'A food order',
        'A sports game',
        'A travel plan'
      ],
      answer: 'A technology or study project',
      passScore: level.passScore,
      points: 10
    };
  }

  function makeSpeakingItem(sid, diff, idx, route, skill) {
    const level = DIFFICULTY_LEVELS[diff];
    const target = textForSpeaking(sid, diff, idx, route);

    return {
      id: `${sid}-SP-${diff.toUpperCase()}-${String(idx).padStart(2, '0')}`,
      sid,
      sessionNo: route.no,
      skill,
      difficulty: diff,
      cefr: level.cefr,
      boss: !!route.boss,
      bossNo: route.bossNo || 0,
      title: route.title,
      prompt: 'Say the sentence clearly.',
      target,
      passScore: level.passScore,
      points: 10
    };
  }

  function makeReadingItem(sid, diff, idx, route, skill) {
    const level = DIFFICULTY_LEVELS[diff];

    const passages = {
      easy: `A student is learning coding. The student uses a computer and writes simple programs.`,
      normal: `Mina is a CS student. She is building a web app for her class project. The app helps students save notes and check tasks.`,
      hard: `A software team is testing a new feature. The login button works on a computer, but it does not work well on a mobile phone. The team needs to check the design and fix the bug.`,
      expert: `An AI project can help users find information faster. The system receives a question, searches the data, and gives a short answer. However, the developer must test the answer carefully because AI can make mistakes.`
    };

    return {
      id: `${sid}-RE-${diff.toUpperCase()}-${String(idx).padStart(2, '0')}`,
      sid,
      sessionNo: route.no,
      skill,
      difficulty: diff,
      cefr: level.cefr,
      boss: !!route.boss,
      bossNo: route.bossNo || 0,
      title: route.title,
      prompt: 'Read the passage and answer the question.',
      passage: passages[diff],
      question: 'What is the passage mainly about?',
      choices: [
        'A technology task or project',
        'A music concert',
        'A restaurant menu',
        'A holiday trip'
      ],
      answer: 'A technology task or project',
      passScore: level.passScore,
      points: 10
    };
  }

  function makeWritingItem(sid, diff, idx, route, skill) {
    const level = DIFFICULTY_LEVELS[diff];

    const prompts = {
      easy: 'Write one simple sentence about your study or skill.',
      normal: 'Write two sentences about your CS/AI project.',
      hard: 'Write a short message explaining a problem in an app.',
      expert: 'Write a short project explanation with a problem, solution, and benefit.'
    };

    const models = {
      easy: 'I study computer science.',
      normal: 'I am building a web app. It helps students manage their tasks.',
      hard: 'The login button does not work on mobile. I will check the code and test it again.',
      expert: 'Our project helps students organize learning tasks. It solves the problem of missed deadlines and gives users a clear progress view.'
    };

    return {
      id: `${sid}-WR-${diff.toUpperCase()}-${String(idx).padStart(2, '0')}`,
      sid,
      sessionNo: route.no,
      skill,
      difficulty: diff,
      cefr: level.cefr,
      boss: !!route.boss,
      bossNo: route.bossNo || 0,
      title: route.title,
      prompt: prompts[diff],
      modelAnswer: models[diff],
      keywords: ['project', 'app', 'student', 'system', 'data', 'AI', 'problem', 'solution'],
      minWords: diff === 'easy' ? 5 : diff === 'normal' ? 10 : diff === 'hard' ? 18 : 25,
      passScore: level.passScore,
      points: 10
    };
  }

  function makeBossMeta(item, idx, route) {
    if (!route.boss) return item;

    return {
      ...item,
      boss: true,
      bossNo: route.bossNo || 0,
      bossLabel:
        route.skill === 'finalBoss'
          ? 'Final Boss'
          : `Boss ${route.bossNo || ''}`.trim(),
      bossPhase: idx <= 3 ? 'warmup' : idx <= 7 ? 'battle' : 'finish',
      comboRequired: idx >= 8
    };
  }

  function makeItem(sid, diff, idx) {
    const route = LESSON_ROUTE[sid] || LESSON_ROUTE.S1;
    let skill = route.skill;

    if (skill === 'boss' || skill === 'finalBoss') {
      skill = BOSS_SKILL_CYCLE[(idx - 1) % BOSS_SKILL_CYCLE.length];
    }

    let item;

    if (skill === 'listening') {
      item = makeListeningItem(sid, diff, idx, route, skill);
    } else if (skill === 'speaking') {
      item = makeSpeakingItem(sid, diff, idx, route, skill);
    } else if (skill === 'reading') {
      item = makeReadingItem(sid, diff, idx, route, skill);
    } else if (skill === 'writing') {
      item = makeWritingItem(sid, diff, idx, route, skill);
    } else {
      item = makeReadingItem(sid, diff, idx, route, 'reading');
    }

    item.index = idx;
    item.skillLabel = SKILL_LABELS[item.skill] || item.skill;
    item.routeSkill = route.skill;
    item.routeTitle = route.title;
    item.theme = route.theme;
    item.version = VERSION;

    return makeBossMeta(item, idx, route);
  }

  function buildBanks() {
    const banks = {};

    Object.keys(LESSON_ROUTE).forEach((sid) => {
      banks[sid] = {};

      DIFF_ORDER.forEach((diff) => {
        banks[sid][diff] = [];

        for (let i = 1; i <= 10; i++) {
          banks[sid][diff].push(makeItem(sid, diff, i));
        }
      });
    });

    return banks;
  }

  const LESSON_BANKS = buildBanks();

  let CURRENT_STATE = getStateFromUrl();
  let CURRENT_ITEM = null;

  function getRoute(sid) {
    sid = normalizeSid(sid);
    return LESSON_ROUTE[sid] || LESSON_ROUTE.S1;
  }

  function getBank(sid, difficulty) {
    sid = normalizeSid(sid);
    difficulty = normalizeDifficulty(difficulty);

    return LESSON_BANKS[sid]?.[difficulty] || LESSON_BANKS.S1.normal;
  }

  function pickItem(options = {}) {
    const sid = normalizeSid(options.sid || CURRENT_STATE.sid || 'S1');
    const route = getRoute(sid);

    const difficulty = normalizeDifficulty(
      options.difficulty ||
      options.diff ||
      CURRENT_STATE.difficulty ||
      getRecommendedDifficulty(sid) ||
      'normal'
    );

    const bank = getBank(sid, difficulty);
    const sp = getSessionProfile(sid);

    let index;

    if (Number.isFinite(Number(options.index))) {
      index = Math.max(0, Math.min(9, Number(options.index)));
    } else {
      const idxMap = sp.nextIndexByDifficulty || {};
      index = Number(idxMap[difficulty] || 0);
      index = Math.max(0, Math.min(9, index));
    }

    const item = bank[index] || bank[0];

    if (options.advance !== false) {
      const profile = loadProfile();
      const session = profile.sessions?.[sid] || sp;

      if (!session.nextIndexByDifficulty) {
        session.nextIndexByDifficulty = {
          easy: 0,
          normal: 0,
          hard: 0,
          expert: 0
        };
      }

      session.nextIndexByDifficulty[difficulty] = (index + 1) % 10;
      session.updatedAt = new Date().toISOString();

      if (!profile.sessions) profile.sessions = {};
      profile.sessions[sid] = session;
      saveProfile(profile);
    }

    CURRENT_STATE = {
      ...CURRENT_STATE,
      sid,
      sessionNo: route.no,
      route,
      skill: route.skill,
      boss: !!route.boss,
      bossNo: route.bossNo || 0,
      difficulty,
      cefr: DIFFICULTY_LEVELS[difficulty].cefr
    };

    CURRENT_ITEM = item;

    try {
      localStorage.setItem(
        STORAGE_LAST_ITEM,
        JSON.stringify({
          at: new Date().toISOString(),
          state: CURRENT_STATE,
          item
        })
      );
    } catch (err) {}

    window.LESSON_CURRENT_STATE = CURRENT_STATE;
    window.LESSON_CURRENT_ITEM = CURRENT_ITEM;

    const detail = {
      version: VERSION,
      state: CURRENT_STATE,
      item: CURRENT_ITEM
    };

    window.dispatchEvent(new CustomEvent('lesson:item-ready', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:item-ready', { detail }));

    return item;
  }

  function getCurrentItem() {
    if (!CURRENT_ITEM) {
      return pickItem({ advance: false });
    }

    return CURRENT_ITEM;
  }

  function getCurrentSkill() {
    const item = getCurrentItem();

    if (item && item.skill) return item.skill;

    const state = CURRENT_STATE || getStateFromUrl();
    return state.skill || 'unknown';
  }

  function validateBanks() {
    const issues = [];
    let total = 0;

    Object.keys(LESSON_ROUTE).forEach((sid) => {
      DIFF_ORDER.forEach((diff) => {
        const bank = getBank(sid, diff);
        total += bank.length;

        if (bank.length !== 10) {
          issues.push(`${sid}.${diff} has ${bank.length} items, expected 10`);
        }

        bank.forEach((item, i) => {
          if (!item.id) issues.push(`${sid}.${diff}[${i}] missing id`);
          if (!item.skill) issues.push(`${sid}.${diff}[${i}] missing skill`);
          if (!item.cefr) issues.push(`${sid}.${diff}[${i}] missing CEFR`);
        });
      });
    });

    return {
      ok: issues.length === 0,
      version: VERSION,
      sessions: Object.keys(LESSON_ROUTE).length,
      difficultyLevels: DIFF_ORDER.length,
      itemsPerLevel: 10,
      expectedTotal: 15 * 4 * 10,
      total,
      issues
    };
  }

  function setDomDataset() {
    try {
      const state = CURRENT_STATE || getStateFromUrl();
      const item = CURRENT_ITEM || getCurrentItem();

      document.documentElement.dataset.lessonVersion = VERSION;
      document.documentElement.dataset.lessonSid = state.sid;
      document.documentElement.dataset.lessonSkill = item.skill || state.skill;
      document.documentElement.dataset.lessonRouteSkill = state.skill;
      document.documentElement.dataset.lessonDifficulty = state.difficulty;
      document.documentElement.dataset.lessonCefr = state.cefr;
      document.documentElement.dataset.lessonBoss = state.boss ? '1' : '0';
    } catch (err) {}
  }

  function boot() {
    CURRENT_STATE = getStateFromUrl();
    CURRENT_ITEM = pickItem({
      sid: CURRENT_STATE.sid,
      difficulty: CURRENT_STATE.difficulty,
      advance: false
    });

    setDomDataset();

    const validation = validateBanks();

    window.LESSON_ROUTE = LESSON_ROUTE;
    window.LESSON_DIFFICULTY_LEVELS = DIFFICULTY_LEVELS;
    window.LESSON_BANKS = LESSON_BANKS;
    window.LESSON_CURRENT_STATE = CURRENT_STATE;
    window.LESSON_CURRENT_ITEM = CURRENT_ITEM;

    window.LESSON_ROUTER = {
      version: VERSION,
      routes: LESSON_ROUTE,
      levels: DIFFICULTY_LEVELS,
      banks: LESSON_BANKS,
      order: DIFF_ORDER,

      normalizeSid,
      normalizeDifficulty,
      getStateFromUrl,
      getRoute,
      getBank,
      getCurrentItem,
      getCurrentSkill,
      pickItem,
      reportResult,
      nextDifficulty,
      getRecommendedDifficulty,
      validateBanks
    };

    const detail = {
      version: VERSION,
      state: CURRENT_STATE,
      item: CURRENT_ITEM,
      validation
    };

    window.dispatchEvent(new CustomEvent('lesson:router-ready', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:router-ready', { detail }));

    console.log('[LessonSkillRouter]', VERSION, detail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
