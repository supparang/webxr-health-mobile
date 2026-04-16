// /english/js/lesson-api.js
'use strict';

const RTDB_BASE = 'https://english-d4bfa-default-rtdb.asia-southeast1.firebasedatabase.app';

// ถ้าฐานข้อมูลเปิด public ชั่วคราวตอน dev ปล่อย null ได้
// ถ้าฐานข้อมูลปิด rules ต้องใส่ Firebase ID token ที่นี่
let FIREBASE_ID_TOKEN = null;

export function setFirebaseIdToken(token) {
  FIREBASE_ID_TOKEN = token || null;
}

function buildUrl(path) {
  const clean = String(path || '').replace(/^\/+/, '');
  const auth = FIREBASE_ID_TOKEN ? `?auth=${encodeURIComponent(FIREBASE_ID_TOKEN)}` : '';
  return `${RTDB_BASE}/${clean}.json${auth}`;
}

async function rtdb(path, { method = 'GET', body } = {}) {
  const res = await fetch(buildUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body)
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      detail = text || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeSessionId() {
  return `ES_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --------- ชุดคำถามชั่วคราวใน client เพื่อให้เกมรันก่อน ---------
// หมายเหตุ: แบบนี้ "ยังไม่ซ่อน logic"
// พอหน้าเกมรันได้แล้ว ค่อยย้ายส่วนนี้ไป Functions หรือ private store
const MOCK_QUESTIONS = [
  {
    questionId: 'Q001',
    type: 'choice',
    promptText: 'Choose the best meaning',
    questionText: 'What does "bug" mean in software development?',
    choices: [
      { value: 'a', label: 'A software error' },
      { value: 'b', label: 'A computer brand' },
      { value: 'c', label: 'A network cable' },
      { value: 'd', label: 'A mobile app icon' }
    ],
    expected: { value: 'a' },
    timeLimitSec: 10,
    bossImpact: 12
  },
  {
    questionId: 'Q002',
    type: 'choice',
    promptText: 'Choose the best word',
    questionText: 'We collect data to train a ______.',
    choices: [
      { value: 'a', label: 'feature' },
      { value: 'b', label: 'model' },
      { value: 'c', label: 'keyboard' },
      { value: 'd', label: 'speaker' }
    ],
    expected: { value: 'b' },
    timeLimitSec: 10,
    bossImpact: 10
  },
  {
    questionId: 'Q003',
    type: 'speaking',
    promptText: 'Say the sentence clearly',
    questionText: 'I need to test the app before deployment.',
    choices: [],
    expected: {
      text: 'i need to test the app before deployment',
      keywords: ['test', 'app', 'deployment']
    },
    timeLimitSec: 12,
    bossImpact: 14
  }
];

const local = {
  sessionId: null,
  uid: 'anon_player',
  unitId: 'a2_cs_unit_01',
  difficulty: 'normal',
  score: 0,
  combo: 0,
  bestCombo: 0,
  lives: 3,
  bossHp: 100,
  bossMaxHp: 100,
  askedIds: [],
  correctCount: 0,
  answered: 0,
  finished: false
};

function resetLocal(payload = {}) {
  local.sessionId = makeSessionId();
  local.uid = payload.uid || 'anon_player';
  local.unitId = payload.unitId || 'a2_cs_unit_01';
  local.difficulty = payload.requestedDifficulty || 'normal';
  local.score = 0;
  local.combo = 0;
  local.bestCombo = 0;
  local.lives = 3;
  local.bossHp = 100;
  local.bossMaxHp = 100;
  local.askedIds = [];
  local.correctCount = 0;
  local.answered = 0;
  local.finished = false;
}

function publicQuestionShape(q) {
  return {
    questionId: q.questionId,
    type: q.type,
    promptText: q.promptText,
    questionText: q.questionText,
    choices: q.choices || [],
    timeLimitSec: q.timeLimitSec || 10
  };
}

function pickNextQuestion() {
  const remaining = MOCK_QUESTIONS.filter(q => !local.askedIds.includes(q.questionId));
  return remaining[0] || MOCK_QUESTIONS[0] || null;
}

function evaluateAnswer(question, payload) {
  if (!question) {
    return { correct: false, scoreDelta: 0, feedback: 'Question not found.' };
  }

  if (question.type === 'speaking') {
    const spoken = normalizeText(payload?.answer?.transcript || '');
    const exact = spoken === normalizeText(question.expected?.text || '');
    const keywords = Array.isArray(question.expected?.keywords) ? question.expected.keywords : [];
    const hits = keywords.filter(k => spoken.includes(normalizeText(k))).length;
    const keywordRatio = keywords.length ? hits / keywords.length : 0;
    const correct = exact || keywordRatio >= 0.67;

    return {
      correct,
      scoreDelta: exact ? 120 : correct ? 90 : 0,
      feedback: correct
        ? exact
          ? 'Excellent! Clear and complete sentence.'
          : 'Good! You said the key words correctly.'
        : 'Almost there. Try again more clearly.'
    };
  }

  const picked = String(payload?.answer?.value || '');
  const correct = picked === String(question.expected?.value || '');
  return {
    correct,
    scoreDelta: correct ? 100 : 0,
    feedback: correct ? 'Correct answer!' : 'That choice is not correct yet.'
  };
}

// ----------------- public API for lesson-runtime.js -----------------

export async function startSession(payload) {
  resetLocal(payload);

  const sessionDoc = {
    uid: local.uid,
    unitId: local.unitId,
    difficulty: local.difficulty,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: 3,
    bossHp: 100,
    bossMaxHp: 100,
    askedIds: [],
    correctCount: 0,
    answered: 0,
    finished: false,
    startedAtMs: Date.now()
  };

  await rtdb(`englishSessions/${local.sessionId}`, {
    method: 'PUT',
    body: sessionDoc
  });

  return {
    sessionId: local.sessionId,
    difficulty: local.difficulty,
    lives: 3,
    boss: {
      hp: 100,
      maxHp: 100
    }
  };
}

export async function getNextQuestion() {
  await wait(150);

  const question = pickNextQuestion();
  if (!question) {
    throw new Error('No question available');
  }

  await rtdb(`englishSessions/${local.sessionId}`, {
    method: 'PATCH',
    body: {
      currentQuestionId: question.questionId,
      questionStartedAtMs: Date.now()
    }
  });

  return publicQuestionShape(question);
}

export async function submitAnswer(payload) {
  await wait(120);

  const qid = payload?.questionId;
  const question = MOCK_QUESTIONS.find(q => q.questionId === qid);
  const result = evaluateAnswer(question, payload);

  local.answered += 1;
  if (!local.askedIds.includes(qid)) local.askedIds.push(qid);

  if (result.correct) {
    local.correctCount += 1;
    local.combo += 1;
    local.bestCombo = Math.max(local.bestCombo, local.combo);
    local.score += result.scoreDelta;
    local.bossHp = Math.max(0, local.bossHp - (question?.bossImpact || 10) - Math.min(20, local.combo * 2));
  } else {
    local.combo = 0;
    local.lives = Math.max(0, local.lives - 1);
  }

  local.finished = local.lives <= 0 || local.bossHp <= 0 || local.answered >= 10;

  await rtdb(`englishSessions/${local.sessionId}`, {
    method: 'PATCH',
    body: {
      score: local.score,
      combo: local.combo,
      bestCombo: local.bestCombo,
      lives: local.lives,
      bossHp: local.bossHp,
      askedIds: local.askedIds,
      correctCount: local.correctCount,
      answered: local.answered,
      finished: local.finished,
      updatedAtMs: Date.now()
    }
  });

  await rtdb(`englishSessions/${local.sessionId}/events/${Date.now()}`, {
    method: 'PUT',
    body: {
      type: 'answer_submitted',
      questionId: qid,
      correct: result.correct,
      scoreDelta: result.scoreDelta,
      timeUsedMs: payload?.timeUsedMs || 0,
      combo: local.combo,
      lives: local.lives,
      bossHp: local.bossHp,
      createdAtMs: Date.now()
    }
  });

  return {
    correct: result.correct,
    displayFeedback: result.feedback,
    scoreDelta: result.scoreDelta,
    combo: local.combo,
    difficulty: local.difficulty,
    boss: { hp: local.bossHp },
    player: { lives: local.lives },
    nextAction: local.finished ? 'finish' : 'next_question'
  };
}

export async function finishSession() {
  const accuracy = local.answered > 0 ? local.correctCount / local.answered : 0;
  const bossCleared = local.bossHp <= 0;

  const summary = {
    finalScore: local.score,
    accuracy,
    bossCleared,
    summary: {
      bestCombo: local.bestCombo,
      correct: local.correctCount,
      wrong: local.answered - local.correctCount
    }
  };

  await rtdb(`englishSessions/${local.sessionId}`, {
    method: 'PATCH',
    body: {
      finished: true,
      endedAtMs: Date.now(),
      finalScore: local.score,
      accuracy,
      bossCleared
    }
  });

  // leaderboard แบบง่ายก่อน
  await rtdb(`englishLeaderboards/${local.unitId}/${local.sessionId}`, {
    method: 'PUT',
    body: {
      uid: local.uid,
      finalScore: local.score,
      accuracy,
      bestCombo: local.bestCombo,
      bossCleared,
      updatedAtMs: Date.now()
    }
  });

  return {
    sessionId: local.sessionId,
    ...summary
  };
}
