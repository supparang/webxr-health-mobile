// lesson-runtime.js
// ใช้ร่วมกับ lesson-data.js เดิมของคุณ

import { missionDB, getMissionBank } from "./lesson-data.js";

/* =========================================================
 * SESSION META
 * ========================================================= */

export const sessionMetaDB = [
  {
    id: 1,
    type: "speaking",
    title: "S1: Introduction",
    scene: "Company Lobby",
    npc: "Mina, HR Officer",
    brief: "Introduce yourself clearly and confidently as a student in tech.",
    objectives: [
      "Say your name clearly",
      "Say what you study",
      "Say one interest in tech"
    ],
    vocabulary: ["student", "computer science", "AI", "coding", "future"],
    expressions: [
      "My name is ...",
      "I study ...",
      "I want to work in tech."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 2,
    type: "reading",
    title: "S2: Greetings",
    scene: "Welcome Desk",
    npc: "Reception Bot",
    brief: "Read short greetings and choose the most suitable response.",
    objectives: [
      "Recognize greetings",
      "Respond politely",
      "Choose context-appropriate replies"
    ],
    vocabulary: ["hello", "good morning", "thank you", "welcome", "help"],
    expressions: [
      "Hello!",
      "Nice to meet you too.",
      "You are welcome."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 3,
    type: "writing",
    title: "S3: Tech Words",
    scene: "Lab Board",
    npc: "Tech Tutor",
    brief: "Write simple tech-related words and short sentences.",
    objectives: [
      "Recall tech vocabulary",
      "Type short correct answers",
      "Use simple words in context"
    ],
    vocabulary: ["code", "app", "data", "web", "python"],
    expressions: [
      "I like coding.",
      "This is a web page.",
      "Data is useful."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 4,
    type: "speaking",
    title: "S4: Daily Work",
    scene: "Open Office",
    npc: "June, Team Member",
    brief: "Speak about simple daily work tasks in clear English.",
    objectives: [
      "Say daily work actions",
      "Speak in full short sentences",
      "Use work-related vocabulary"
    ],
    vocabulary: ["email", "meeting", "task", "report", "team"],
    expressions: [
      "I check my email.",
      "I join the meeting.",
      "I finish my task."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 5,
    type: "listening",
    title: "S5: Final Interview",
    scene: "Interview Room",
    npc: "HR Bot",
    brief: "Listen to interview questions and choose the best answer.",
    objectives: [
      "Catch key question meaning",
      "Select suitable interview responses",
      "Understand simple spoken English"
    ],
    vocabulary: ["name", "study", "strength", "project", "team"],
    expressions: [
      "My name is ...",
      "I study computer science.",
      "I am good at teamwork."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 6,
    type: "reading",
    title: "S6: Agile Team",
    scene: "Scrum Corner",
    npc: "Scrum Master",
    brief: "Read short team communication and respond appropriately.",
    objectives: [
      "Understand work updates",
      "Recognize blockers and plans",
      "Respond in team contexts"
    ],
    vocabulary: ["task", "blocker", "review", "feature", "demo"],
    expressions: [
      "I finished my task.",
      "I will fix the bug.",
      "We can prepare a demo."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 7,
    type: "writing",
    title: "S7: Bug Report",
    scene: "QA Desk",
    npc: "Mira, QA Tester",
    brief: "Write short bug-report words and simple problem sentences.",
    objectives: [
      "Use bug-report vocabulary",
      "Describe issues briefly",
      "Type result and expected result"
    ],
    vocabulary: ["bug", "error", "crash", "page", "login"],
    expressions: [
      "The page crashes.",
      "The button does not work.",
      "The page should open correctly."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 8,
    type: "speaking",
    title: "S8: Presentation",
    scene: "Demo Stage",
    npc: "Presentation Coach",
    brief: "Present a simple project idea in short spoken sentences.",
    objectives: [
      "Describe a project",
      "Say user benefit",
      "Speak clearly in sequence"
    ],
    vocabulary: ["app", "project", "students", "useful", "design"],
    expressions: [
      "This is our app.",
      "It helps students.",
      "We built this project."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 9,
    type: "reading",
    title: "S9: Client Meeting",
    scene: "Client Room",
    npc: "Sara, Client Representative",
    brief: "Read client questions and choose clear, polite responses.",
    objectives: [
      "Understand client requests",
      "Reply professionally",
      "Use simple business language"
    ],
    vocabulary: ["client", "time", "summary", "ready", "file"],
    expressions: [
      "Yes, we can help you.",
      "We need one more day.",
      "I will send it today."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 10,
    type: "listening",
    title: "S10: Global Team",
    scene: "Remote Hub",
    npc: "Global PM",
    brief: "Listen to team instructions in an international work setting.",
    objectives: [
      "Follow spoken instructions",
      "Catch time and task keywords",
      "Understand remote teamwork English"
    ],
    vocabulary: ["meeting", "screen", "documentation", "server", "release"],
    expressions: [
      "Join the meeting at ten.",
      "Please send the documentation.",
      "We need more testing."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 11,
    type: "writing",
    title: "S11: Data and AI",
    scene: "AI Lab",
    npc: "Ken, AI Engineer",
    brief: "Write short AI, data, and ethics-related answers.",
    objectives: [
      "Use AI vocabulary",
      "Write short data sentences",
      "Mention ethics basics"
    ],
    vocabulary: ["model", "data", "training", "bias", "privacy"],
    expressions: [
      "AI can help people.",
      "Data is useful for analysis.",
      "AI needs fairness and privacy."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 12,
    type: "speaking",
    title: "S12: Problem Solving",
    scene: "War Room",
    npc: "Alex, Mentor",
    brief: "Speak through a simple problem-solving process step by step.",
    objectives: [
      "Explain steps in order",
      "Use problem-solving verbs",
      "Speak in connected short sentences"
    ],
    vocabulary: ["problem", "test", "fix", "result", "solution"],
    expressions: [
      "First we find the problem.",
      "Then we test the system.",
      "Finally we help the user."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 13,
    type: "reading",
    title: "S13: Career Path",
    scene: "Career Studio",
    npc: "HR Coach",
    brief: "Read career questions and choose strong professional answers.",
    objectives: [
      "Recognize career language",
      "Choose growth-oriented responses",
      "Understand HR questions"
    ],
    vocabulary: ["developer", "skills", "internship", "learn", "career"],
    expressions: [
      "I want to be a developer.",
      "I can code and design.",
      "I want to learn and grow."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 14,
    type: "listening",
    title: "S14: Remote Work",
    scene: "Online Office",
    npc: "Meeting Bot",
    brief: "Listen to remote work instructions and choose the correct action.",
    objectives: [
      "Understand online meeting instructions",
      "Catch remote-work keywords",
      "Follow spoken tasks"
    ],
    vocabulary: ["camera", "screen", "notes", "internet", "message"],
    expressions: [
      "Turn on your camera.",
      "Share your screen now.",
      "Write a short note."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  },
  {
    id: 15,
    type: "writing",
    title: "S15: Graduation Final",
    scene: "Command Deck",
    npc: "Executive Board",
    brief: "Write simple final statements about goals, skills, and gratitude.",
    objectives: [
      "State a future goal",
      "Describe one strength",
      "Write a thank-you message"
    ],
    vocabulary: ["goal", "future", "developer", "skill", "support"],
    expressions: [
      "After graduation I want to work in tech.",
      "I am proud of my coding skill.",
      "Thank you for your support and help."
    ],
    passRule: { minCorrect: 10, bossMinCorrect: 3 }
  }
];

export function getSessionMeta(sessionId) {
  return sessionMetaDB.find(s => s.id === sessionId) || null;
}

/* =========================================================
 * RNG / SHUFFLE
 * ========================================================= */

function hashSeed(input) {
  const str = String(input ?? "");
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRng(seed) {
  const make = hashSeed(seed);
  return mulberry32(make());
}

function shuffleArray(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* =========================================================
 * FULL SESSION RUN
 * - ครบ 15 ข้อ
 * - easy 5 / normal 5 / hard 5
 * - ไม่ซ้ำ
 * - adaptive แค่ "ลำดับ" ไม่ใช่จำนวน
 * ========================================================= */

function buildDifficultyOrder(mode = "normal", aiState = { pressure: 0, support: 0 }) {
  // counts ต้องคง 5/5/5 ตามที่ตกลงกัน
  const defaultOrder = [
    "easy","easy","easy","easy","easy",
    "normal","normal","normal","normal","normal",
    "hard","hard","hard","hard","hard"
  ];

  const supportOrder = [
    "easy","easy","easy","easy","normal",
    "easy","normal","normal","normal","hard",
    "normal","hard","hard","hard","hard"
  ];

  const pressureOrder = [
    "easy","easy","normal","normal","normal",
    "hard","hard","normal","hard","easy",
    "hard","normal","easy","hard","easy"
  ];

  if (aiState?.support >= 2) return supportOrder;
  if (aiState?.pressure >= 2) return pressureOrder;

  if (mode === "easy") return supportOrder;
  if (mode === "hard") return pressureOrder;
  return defaultOrder;
}

export function buildSessionRun(sessionId, mode = "normal", aiState = { pressure: 0, support: 0 }, seed = `${sessionId}-${Date.now()}`) {
  const mission = missionDB.find(m => m.id === sessionId);
  if (!mission) return [];

  const rng = seededRng(seed);

  const easy = shuffleArray(
    (mission.bank?.easy || []).map((item, i) => ({ ...item, _difficulty: "easy", _poolIndex: i })),
    rng
  );
  const normal = shuffleArray(
    (mission.bank?.normal || []).map((item, i) => ({ ...item, _difficulty: "normal", _poolIndex: i })),
    rng
  );
  const hard = shuffleArray(
    (mission.bank?.hard || []).map((item, i) => ({ ...item, _difficulty: "hard", _poolIndex: i })),
    rng
  );

  const order = buildDifficultyOrder(mode, aiState);

  const counters = { easy: 0, normal: 0, hard: 0 };

  return order.map((diff, idx) => {
    const source = diff === "easy" ? easy : diff === "normal" ? normal : hard;
    const item = source[counters[diff]++];
    const stage =
      idx < 5 ? "warmup" :
      idx < 10 ? "main" :
      "boss";

    return {
      ...item,
      _sessionId: sessionId,
      _sessionType: mission.type,
      _step: idx + 1,
      _stage: stage
    };
  });
}

/* =========================================================
 * SINGLE PICK
 * ========================================================= */

export function pickAdaptiveMissionItem(sessionId, mode = "normal", aiState = { pressure: 0, support: 0 }, seed = `${sessionId}-${Date.now()}`) {
  const mission = missionDB.find(m => m.id === sessionId);
  if (!mission) return null;

  let targetDiff = mode;
  if (aiState?.support >= 2) targetDiff = "easy";
  else if (aiState?.pressure >= 2) targetDiff = "hard";

  const bank = mission.bank?.[targetDiff] || mission.bank?.normal || [];
  if (!bank.length) return null;

  const rng = seededRng(seed);
  const randomIndex = Math.floor(rng() * bank.length);

  return {
    ...bank[randomIndex],
    _sessionId: sessionId,
    _sessionType: mission.type,
    _selectedDifficulty: targetDiff
  };
}

/* =========================================================
 * NORMALIZE / EVALUATE
 * สำคัญ: speaking อย่าเช็ก exact แบบดิบ
 * ========================================================= */

export function normalizeEnglish(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTokens(text = "") {
  return [...new Set(normalizeEnglish(text).split(" ").filter(Boolean))];
}

function countMatchedKeywords(input, keywords = []) {
  const inputTokens = uniqueTokens(input);
  const keySet = keywords.map(k => normalizeEnglish(k));
  return keySet.filter(k => inputTokens.includes(k)).length;
}

function speakingThreshold(strictness = "normal") {
  if (strictness === "easy") return 0.60;
  if (strictness === "hard") return 0.85;
  return 0.75;
}

export function evaluateMissionAnswer(item, userInput, strictness = "normal") {
  if (!item) {
    return { ok: false, score: 0, feedback: "ไม่พบโจทย์" };
  }

  const input = normalizeEnglish(userInput || "");

  // reading / listening
  if (item.answer) {
    const picked = String(userInput || "").trim().toUpperCase();
    const ok = picked === String(item.answer).trim().toUpperCase();
    return {
      ok,
      score: ok ? 1 : 0,
      feedback: ok
        ? "ถูกต้อง"
        : `คำตอบที่เหมาะสมคือ ${item.answer} เพราะเป็นตัวเลือกที่สื่อสารได้ตรงสถานการณ์ที่สุด`
    };
  }

  // speaking
  if (item.exactPhrase) {
    const targetTokens = uniqueTokens(item.exactPhrase);
    const inputTokens = uniqueTokens(input);
    const matched = targetTokens.filter(t => inputTokens.includes(t)).length;
    const ratio = targetTokens.length ? matched / targetTokens.length : 0;
    const threshold = speakingThreshold(strictness);
    const ok = ratio >= threshold;

    return {
      ok,
      score: ok ? 1 : 0,
      ratio,
      matched,
      required: targetTokens.length,
      feedback: ok
        ? "ดีมาก พูดได้ใกล้เคียงเป้าหมาย"
        : item.failMsg || "ลองพูดใหม่ให้ชัดและครบมากขึ้น",
      model: item.exactPhrase
    };
  }

  // writing
  if (item.keywords) {
    const matched = countMatchedKeywords(input, item.keywords);
    const minMatch = Number(item.minMatch || 1);
    const ok = matched >= minMatch;

    return {
      ok,
      score: ok ? 1 : 0,
      matched,
      minMatch,
      feedback: ok
        ? "ดีมาก คำตอบมี keyword เพียงพอ"
        : item.failMsg || "ลองเติม keyword สำคัญให้มากขึ้น",
      expectedKeywords: item.keywords
    };
  }

  return {
    ok: false,
    score: 0,
    feedback: "รูปแบบโจทย์นี้ยังไม่มี evaluator"
  };
}

/* =========================================================
 * SESSION SCORING / MASTERY
 * ========================================================= */

export function summarizeSessionResult(sessionId, results = []) {
  const meta = getSessionMeta(sessionId);
  const total = results.length;
  const correct = results.filter(r => r?.ok).length;
  const bossCorrect = results.filter(r => r?._stage === "boss" && r?.ok).length;

  const minCorrect = meta?.passRule?.minCorrect ?? 10;
  const bossMinCorrect = meta?.passRule?.bossMinCorrect ?? 3;

  const passed = correct >= minCorrect && bossCorrect >= bossMinCorrect;

  let stars = 0;
  if (passed) stars = 1;
  if (passed && correct >= 12) stars = 2;
  if (passed && correct >= 14) stars = 3;

  return {
    sessionId,
    title: meta?.title || `S${sessionId}`,
    total,
    correct,
    wrong: Math.max(0, total - correct),
    bossCorrect,
    passed,
    stars,
    rank:
      correct >= 14 ? "Excellent" :
      correct >= 12 ? "Strong" :
      correct >= 10 ? "Pass" :
      "Retry",
    nextAdvice:
      correct < 10 ? "ควรฝึกซ้ำอีก 1 รอบ" :
      bossCorrect < bossMinCorrect ? "ผ่าน warmup/main แล้ว แต่ควรฝึก boss เพิ่ม" :
      "พร้อมไป session ถัดไป"
  };
}

/* =========================================================
 * SAVE / LOAD
 * ========================================================= */

const STORAGE_KEY = "A2_SESSION_PROGRESS_V2";

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSessionProgress(sessionId, summary) {
  const current = loadProgress();
  current[sessionId] = {
    ...current[sessionId],
    bestCorrect: Math.max(current[sessionId]?.bestCorrect || 0, summary.correct || 0),
    bestStars: Math.max(current[sessionId]?.bestStars || 0, summary.stars || 0),
    passed: !!summary.passed,
    lastPlayedAt: Date.now(),
    summary
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  return current[sessionId];
}

export function isSessionUnlocked(sessionId) {
  if (sessionId <= 1) return true;
  const progress = loadProgress();
  return !!progress[sessionId - 1]?.passed;
}