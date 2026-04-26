// /english/js/lesson-data.js
// TechPath Lesson Data — Ultimate r9.2
// PATCH v20260426-lesson-data-4levels-r9-2
// ✅ 15 sessions
// ✅ 4 levels per session: easy(A2), normal(A2+), hard(B1), challenge(B1+)
// ✅ 10 missions per level
// ✅ 40 missions per session
// ✅ 600 missions total
// ✅ Compatible with lesson-main.js: export { missionDB }
// ✅ Compatible shapes: group.easy / group.normal / group.hard / group.challenge
// ✅ Also provides group.missions, group.variants, group.levels, group.items

export const LESSON_DATA_PATCH = "v20260426-lesson-data-4levels-r9-2";

export const LEVELS = ["easy", "normal", "hard", "challenge"];

export const LEVEL_META = {
  easy: {
    label: "EASY",
    cefr: "A2",
    band: "A2",
    speed: "slow",
    readingLength: "short",
    sentenceTarget: 8,
    keywordNeed: 2
  },
  normal: {
    label: "NORMAL",
    cefr: "A2+",
    band: "A2+",
    speed: "clear",
    readingLength: "medium",
    sentenceTarget: 10,
    keywordNeed: 3
  },
  hard: {
    label: "HARD",
    cefr: "B1",
    band: "B1",
    speed: "natural",
    readingLength: "extended",
    sentenceTarget: 12,
    keywordNeed: 4
  },
  challenge: {
    label: "CHALLENGE",
    cefr: "B1+",
    band: "B1+",
    speed: "natural plus",
    readingLength: "extended plus",
    sentenceTarget: 14,
    keywordNeed: 5
  }
};

export const SESSION_BLUEPRINTS = [
  {
    id: 1,
    code: "S01",
    title: "Self-Introduction in Tech",
    shortTitle: "Self-Intro",
    focus: "Introduce yourself as a CS/AI student",
    domain: "profile",
    keywords: ["student", "computer science", "AI", "project", "goal"],
    context: "A student joins a new technology class and introduces their background."
  },
  {
    id: 2,
    code: "S02",
    title: "Academic Background and Projects",
    shortTitle: "Academic Background",
    focus: "Talk about courses, projects, and learning goals",
    domain: "academic",
    keywords: ["course", "project", "programming", "database", "team"],
    context: "A student explains their academic background and a class project."
  },
  {
    id: 3,
    code: "S03",
    title: "Tech Jobs and Roles",
    shortTitle: "Tech Roles",
    focus: "Describe jobs and responsibilities in tech teams",
    domain: "career",
    keywords: ["developer", "designer", "tester", "data analyst", "team"],
    context: "A team discusses different roles in a software project."
  },
  {
    id: 4,
    code: "S04",
    title: "Daily Workplace Communication",
    shortTitle: "Workplace Talk",
    focus: "Use short workplace phrases for daily tasks",
    domain: "workplace",
    keywords: ["task", "deadline", "update", "message", "schedule"],
    context: "A student intern communicates with a team during a normal workday."
  },
  {
    id: 5,
    code: "S05",
    title: "Emails and Chat",
    shortTitle: "Emails & Chat",
    focus: "Write polite emails and chat messages",
    domain: "communication",
    keywords: ["email", "reply", "request", "attach", "confirm"],
    context: "A student sends a short message to ask for information politely."
  },
  {
    id: 6,
    code: "S06",
    title: "Meetings",
    shortTitle: "Meetings",
    focus: "Join, arrange, and summarize meetings",
    domain: "meeting",
    keywords: ["meeting", "agenda", "minute", "decision", "follow up"],
    context: "A team plans a short online meeting about project progress."
  },
  {
    id: 7,
    code: "S07",
    title: "Explaining a System",
    shortTitle: "System Explanation",
    focus: "Explain how a simple system works",
    domain: "system",
    keywords: ["system", "input", "process", "output", "user"],
    context: "A student explains a web application to a classmate."
  },
  {
    id: 8,
    code: "S08",
    title: "Problems and Bugs",
    shortTitle: "Problems & Bugs",
    focus: "Describe problems, bugs, and solutions",
    domain: "debugging",
    keywords: ["bug", "error", "problem", "fix", "test"],
    context: "A team finds a bug in an app and discusses how to fix it."
  },
  {
    id: 9,
    code: "S09",
    title: "Client Meeting",
    shortTitle: "Client Meeting",
    focus: "Ask questions and respond to client needs",
    domain: "client",
    keywords: ["client", "requirement", "feature", "question", "confirm"],
    context: "A student team meets a client to ask about app requirements."
  },
  {
    id: 10,
    code: "S10",
    title: "Data and AI Communication",
    shortTitle: "Data & AI",
    focus: "Explain data and AI ideas simply",
    domain: "ai",
    keywords: ["data", "model", "AI", "prediction", "accuracy"],
    context: "A student explains an AI model and how it uses data."
  },
  {
    id: 11,
    code: "S11",
    title: "Team Collaboration and Stand-up",
    shortTitle: "Team Stand-up",
    focus: "Report progress, blockers, and next steps",
    domain: "teamwork",
    keywords: ["progress", "blocker", "next step", "support", "team"],
    context: "A team has a short stand-up meeting before working on a project."
  },
  {
    id: 12,
    code: "S12",
    title: "Product Demo",
    shortTitle: "Product Demo",
    focus: "Present features and demonstrate a product",
    domain: "demo",
    keywords: ["demo", "feature", "screen", "user", "benefit"],
    context: "A student demonstrates a prototype app to classmates."
  },
  {
    id: 13,
    code: "S13",
    title: "CV and Portfolio Language",
    shortTitle: "CV & Portfolio",
    focus: "Describe skills, projects, and achievements",
    domain: "portfolio",
    keywords: ["skill", "portfolio", "experience", "project", "achievement"],
    context: "A student prepares a short portfolio profile for a tech internship."
  },
  {
    id: 14,
    code: "S14",
    title: "Job Interview",
    shortTitle: "Job Interview",
    focus: "Answer common interview questions",
    domain: "interview",
    keywords: ["interview", "strength", "experience", "team", "learn"],
    context: "A student practices answering interview questions for a junior tech role."
  },
  {
    id: 15,
    code: "S15",
    title: "Project Pitch",
    shortTitle: "Project Pitch",
    focus: "Pitch a project clearly and confidently",
    domain: "pitch",
    keywords: ["problem", "solution", "user", "impact", "prototype"],
    context: "A student team gives a final pitch for a technology project."
  }
];

const TYPE_PATTERN = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "reading",
  "writing",
  "listening",
  "speaking",
  "reading",
  "writing"
];

const LETTERS = ["A", "B", "C"];

const GENERIC_DISTRACTORS = {
  profile: ["A food menu", "A travel story", "A sports event", "A shopping list"],
  academic: ["A restaurant order", "A weather report", "A movie review", "A bus timetable"],
  career: ["A cooking recipe", "A birthday party", "A hotel booking", "A holiday plan"],
  workplace: ["A song playlist", "A restaurant review", "A family story", "A map direction"],
  communication: ["A health exercise", "A game rule", "A city tour", "A product price"],
  meeting: ["A clothing store", "A music lesson", "A train ticket", "A movie ticket"],
  system: ["A pet story", "A holiday photo", "A recipe", "A sports match"],
  debugging: ["A simple technology learning task", "A food menu", "A travel story", "A music concert"],
  client: ["A classroom rule", "A lunch menu", "A museum visit", "A sport result"],
  ai: ["A flower garden", "A cooking show", "A bus stop", "A cartoon story"],
  teamwork: ["A shopping mall", "A family dinner", "A movie scene", "A weather forecast"],
  demo: ["A history lesson", "A train route", "A restaurant table", "A birthday card"],
  portfolio: ["A vacation plan", "A football game", "A cooking class", "A map of a park"],
  interview: ["A hotel room", "A shopping receipt", "A pet care note", "A music event"],
  pitch: ["A travel advertisement", "A birthday plan", "A lunch order", "A sport club"]
};

const VERB_BANK = {
  profile: ["introduce", "study", "learn", "build", "practice"],
  academic: ["explain", "complete", "present", "review", "submit"],
  career: ["design", "develop", "test", "analyze", "support"],
  workplace: ["update", "confirm", "schedule", "report", "share"],
  communication: ["reply", "request", "attach", "confirm", "send"],
  meeting: ["join", "discuss", "summarize", "decide", "follow up"],
  system: ["connect", "process", "display", "save", "send"],
  debugging: ["find", "fix", "test", "check", "report"],
  client: ["ask", "confirm", "clarify", "suggest", "listen"],
  ai: ["collect", "train", "predict", "evaluate", "explain"],
  teamwork: ["coordinate", "support", "report", "review", "help"],
  demo: ["show", "demonstrate", "explain", "highlight", "answer"],
  portfolio: ["describe", "include", "highlight", "organize", "share"],
  interview: ["answer", "explain", "prepare", "describe", "learn"],
  pitch: ["identify", "propose", "explain", "persuade", "present"]
};

const NOUN_BANK = {
  profile: ["background", "major", "goal", "project", "skill"],
  academic: ["course", "assignment", "project", "database", "presentation"],
  career: ["role", "responsibility", "developer", "tester", "analyst"],
  workplace: ["task", "deadline", "update", "schedule", "message"],
  communication: ["email", "reply", "request", "file", "attachment"],
  meeting: ["agenda", "meeting", "minute", "decision", "action item"],
  system: ["input", "process", "output", "feature", "screen"],
  debugging: ["bug", "error", "test", "solution", "system"],
  client: ["client", "requirement", "feature", "question", "feedback"],
  ai: ["data", "model", "prediction", "accuracy", "result"],
  teamwork: ["progress", "blocker", "support", "next step", "team"],
  demo: ["feature", "demo", "screen", "button", "benefit"],
  portfolio: ["skill", "project", "experience", "portfolio", "achievement"],
  interview: ["strength", "experience", "challenge", "answer", "example"],
  pitch: ["problem", "solution", "user", "impact", "prototype"]
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function normalizeLevel(level) {
  return LEVELS.includes(level) ? level : "normal";
}

function titleCase(text) {
  return String(text || "")
    .split(" ")
    .map((w) => w ? w[0].toUpperCase() + w.slice(1) : "")
    .join(" ");
}

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getCorrectLetter(seed) {
  return LETTERS[Math.abs(seed) % LETTERS.length];
}

function makeChoices(correctText, distractors, seed = 0) {
  const correctLetter = getCorrectLetter(seed);
  const pool = [...new Set((distractors || []).filter(Boolean))];

  while (pool.length < 2) {
    pool.push("A different topic");
  }

  const map = {
    A: pool[0],
    B: pool[1],
    C: pool[2] || pool[0]
  };

  map[correctLetter] = correctText;

  const used = new Set();
  LETTERS.forEach((letter, idx) => {
    let value = clean(map[letter]);
    while (used.has(value.toLowerCase())) {
      value = `${value} ${idx + 1}`;
    }
    used.add(value.toLowerCase());
    map[letter] = value;
  });

  return {
    answer: correctLetter,
    choices: LETTERS.map((letter) => `${letter}. ${map[letter]}`)
  };
}

function sentenceFor(session, level, itemIndex) {
  const verbs = VERB_BANK[session.domain] || VERB_BANK.workplace;
  const nouns = NOUN_BANK[session.domain] || NOUN_BANK.workplace;
  const v1 = verbs[itemIndex % verbs.length];
  const n1 = nouns[(itemIndex + 1) % nouns.length];
  const n2 = nouns[(itemIndex + 3) % nouns.length];

  if (level === "easy") {
    return `I can ${v1} the ${n1}.`;
  }

  if (level === "normal") {
    return `I can ${v1} the ${n1} and share the ${n2} with my team.`;
  }

  if (level === "hard") {
    return `I can ${v1} the ${n1}, check the ${n2}, and explain the result clearly.`;
  }

  return `I can ${v1} the ${n1}, compare the ${n2}, and recommend the next step for users.`;
}

function readingPassage(session, level, itemIndex) {
  const verbs = VERB_BANK[session.domain] || VERB_BANK.workplace;
  const nouns = NOUN_BANK[session.domain] || NOUN_BANK.workplace;

  const v1 = verbs[itemIndex % verbs.length];
  const v2 = verbs[(itemIndex + 2) % verbs.length];
  const n1 = nouns[itemIndex % nouns.length];
  const n2 = nouns[(itemIndex + 1) % nouns.length];
  const n3 = nouns[(itemIndex + 2) % nouns.length];

  if (level === "easy") {
    return clean(
      `${session.context} The student needs to ${v1} the ${n1}. The main goal is to use simple English for ${session.focus.toLowerCase()}.`
    );
  }

  if (level === "normal") {
    return clean(
      `${session.context} The student needs to ${v1} the ${n1} and ${v2} the ${n2}. The team wants a clear message, so everyone understands the task.`
    );
  }

  if (level === "hard") {
    return clean(
      `${session.context} The student must ${v1} the ${n1}, ${v2} the ${n2}, and explain the ${n3}. The message should be polite, accurate, and useful for the team.`
    );
  }

  return clean(
    `${session.context} The student must ${v1} the ${n1}, ${v2} the ${n2}, compare the ${n3}, and recommend a practical next step. The message should help both technical and non-technical people understand the situation.`
  );
}

function writingPrompt(session, level, itemIndex) {
  const nouns = NOUN_BANK[session.domain] || NOUN_BANK.workplace;
  const n1 = nouns[itemIndex % nouns.length];
  const n2 = nouns[(itemIndex + 1) % nouns.length];

  if (level === "easy") {
    return `Write one sentence about your ${n1}.`;
  }

  if (level === "normal") {
    return `Write two short sentences to explain the ${n1} and the ${n2}.`;
  }

  if (level === "hard") {
    return `Write a short message explaining the ${n1}, the ${n2}, and one next step.`;
  }

  return `Write a short professional message that explains the ${n1}, compares it with the ${n2}, and recommends one next step.`;
}

function writingStarter(session, level, itemIndex) {
  const nouns = NOUN_BANK[session.domain] || NOUN_BANK.workplace;
  const n1 = nouns[itemIndex % nouns.length];

  if (level === "easy") {
    return `Starter: I can explain the ${n1}.`;
  }

  if (level === "normal") {
    return `Starter: The ${n1} is important because...`;
  }

  if (level === "hard") {
    return `Starter: Our team should check the ${n1} and...`;
  }

  return `Starter: Based on the ${n1}, I recommend that we...`;
}

function keywordSet(session, level, itemIndex) {
  const base = session.keywords || [];
  const nouns = NOUN_BANK[session.domain] || [];
  const verbs = VERB_BANK[session.domain] || [];

  const size =
    level === "easy" ? 3 :
    level === "normal" ? 4 :
    level === "hard" ? 5 : 6;

  return [...new Set([
    ...base,
    nouns[itemIndex % Math.max(1, nouns.length)],
    nouns[(itemIndex + 1) % Math.max(1, nouns.length)],
    verbs[itemIndex % Math.max(1, verbs.length)]
  ].filter(Boolean))]
    .slice(0, size)
    .map((x) => String(x).toLowerCase());
}

function makeListeningMission(session, level, itemIndex, seed) {
  const meta = LEVEL_META[level];
  const sentence = sentenceFor(session, level, itemIndex);
  const correctText =
    level === "easy" ? `The speaker talks about ${session.shortTitle.toLowerCase()}.` :
    level === "normal" ? `The speaker explains a task about ${session.shortTitle.toLowerCase()}.` :
    level === "hard" ? `The speaker explains a problem and a useful next step.` :
    `The speaker explains the situation, compares details, and recommends a next step.`;

  const choices = makeChoices(
    correctText,
    [
      "The speaker orders food.",
      "The speaker describes a holiday.",
      "The speaker talks about a sports game.",
      "The speaker buys a train ticket."
    ],
    seed
  );

  return {
    id: session.id,
    missionUid: `${session.code}-${level}-L${pad2(itemIndex)}`,
    sessionNo: session.code,
    level,
    difficulty: level,
    _selectedDifficulty: level,
    cefr: meta.cefr,
    type: "listening",
    title: `${session.code} ${session.shortTitle} • Listening ${itemIndex}`,
    prompt: "Listen and choose the best answer.",
    question: "What is the speaker mainly talking about?",
    audioText: sentence,
    transcript: sentence,
    answer: choices.answer,
    choices: choices.choices,
    keywords: keywordSet(session, level, itemIndex),
    hint: "ฟังคำสำคัญก่อน เช่น topic, task, problem, next step.",
    aiGuide: `Listen for the main idea. This level is ${meta.cefr}.`,
    failMsg: "Listen again and focus on the main idea."
  };
}

function makeSpeakingMission(session, level, itemIndex, seed) {
  const meta = LEVEL_META[level];
  const phrase = sentenceFor(session, level, itemIndex);

  return {
    id: session.id,
    missionUid: `${session.code}-${level}-S${pad2(itemIndex)}`,
    sessionNo: session.code,
    level,
    difficulty: level,
    _selectedDifficulty: level,
    cefr: meta.cefr,
    type: "speaking",
    title: `${session.code} ${session.shortTitle} • Speaking ${itemIndex}`,
    prompt: phrase,
    question: phrase,
    exactPhrase: phrase.toLowerCase().replace(/[.!?]/g, ""),
    audioText: phrase,
    keywords: keywordSet(session, level, itemIndex),
    hint: "พูดช้า ชัด และเน้น keyword สำคัญในประโยค.",
    aiGuide: `Say the sentence clearly. Target level: ${meta.cefr}.`,
    failMsg: "Try again. Speak a little slower and clearer."
  };
}

function makeReadingMission(session, level, itemIndex, seed) {
  const meta = LEVEL_META[level];
  const passage = readingPassage(session, level, itemIndex);
  const correctText =
    level === "easy" ? `A simple task about ${session.shortTitle.toLowerCase()}` :
    level === "normal" ? `A team communication task about ${session.shortTitle.toLowerCase()}` :
    level === "hard" ? `A professional situation with a clear next step` :
    `A professional situation that compares details and recommends action`;

  const distractors = GENERIC_DISTRACTORS[session.domain] || GENERIC_DISTRACTORS.profile;

  const choices = makeChoices(correctText, distractors, seed);

  return {
    id: session.id,
    missionUid: `${session.code}-${level}-R${pad2(itemIndex)}`,
    sessionNo: session.code,
    level,
    difficulty: level,
    _selectedDifficulty: level,
    cefr: meta.cefr,
    type: "reading",
    title: `${session.code} ${session.shortTitle} • Reading ${itemIndex}`,
    passage,
    readingText: passage,
    prompt: passage,
    question: "What is the passage mainly about?",
    answer: choices.answer,
    choices: choices.choices,
    keywords: keywordSet(session, level, itemIndex),
    hint: "อ่านเพื่อจับใจความหลัก ไม่ใช่จำคำทุกคำ.",
    aiGuide: `Find the main idea first. Target level: ${meta.cefr}.`,
    failMsg: "Look for the topic and the purpose of the passage."
  };
}

function makeWritingMission(session, level, itemIndex, seed) {
  const meta = LEVEL_META[level];
  const prompt = writingPrompt(session, level, itemIndex);
  const starter = writingStarter(session, level, itemIndex);
  const keywords = keywordSet(session, level, itemIndex);

  return {
    id: session.id,
    missionUid: `${session.code}-${level}-W${pad2(itemIndex)}`,
    sessionNo: session.code,
    level,
    difficulty: level,
    _selectedDifficulty: level,
    cefr: meta.cefr,
    type: "writing",
    title: `${session.code} ${session.shortTitle} • Writing ${itemIndex}`,
    prompt,
    question: prompt,
    starter,
    sampleAnswer: `${starter.replace("Starter: ", "")} I will use clear words and give one useful detail.`,
    keywords,
    minKeywords: meta.keywordNeed,
    hint: `ใช้ keyword อย่างน้อย ${meta.keywordNeed} คำ: ${keywords.slice(0, meta.keywordNeed).join(", ")}`,
    aiGuide: `Write clearly. Include key words and one useful detail. Target level: ${meta.cefr}.`,
    failMsg: "Add more key words and make the message clearer."
  };
}

function makeMissionByType(type, session, level, itemIndex, seed) {
  if (type === "listening") return makeListeningMission(session, level, itemIndex, seed);
  if (type === "speaking") return makeSpeakingMission(session, level, itemIndex, seed);
  if (type === "reading") return makeReadingMission(session, level, itemIndex, seed);
  return makeWritingMission(session, level, itemIndex, seed);
}

function makeLevelMissions(session, level) {
  return TYPE_PATTERN.map((type, idx) => {
    const itemIndex = idx + 1;
    const seed = (session.id * 100) + (LEVELS.indexOf(level) * 17) + itemIndex;
    return makeMissionByType(type, session, level, itemIndex, seed);
  });
}

function primaryTypeForSession(sessionId) {
  const cycle = ["speaking", "reading", "listening", "writing"];
  return cycle[(sessionId - 1) % cycle.length];
}

function makeSessionGroup(session) {
  const easy = makeLevelMissions(session, "easy");
  const normal = makeLevelMissions(session, "normal");
  const hard = makeLevelMissions(session, "hard");
  const challenge = makeLevelMissions(session, "challenge");

  const missions = {
    easy,
    normal,
    hard,
    challenge
  };

  const allItems = [...easy, ...normal, ...hard, ...challenge];

  const group = {
    id: session.id,
    sessionNo: session.code,
    code: session.code,
    title: session.title,
    shortTitle: session.shortTitle,
    focus: session.focus,
    domain: session.domain,
    type: primaryTypeForSession(session.id),
    isBoss: session.id % 3 === 0,
    isFinal: session.id === 15,
    cefrRange: "A2-B1+",
    levelCount: 4,
    missionCount: allItems.length,

    easy,
    normal,
    hard,
    challenge,

    missions,
    variants: missions,
    levels: missions,
    items: allItems,
    bank: allItems
  };

  return group;
}

export const missionDB = SESSION_BLUEPRINTS.map(makeSessionGroup);

export const lessonMissionIndex = missionDB.reduce((acc, group) => {
  acc[group.sessionNo] = group;
  acc[String(group.id)] = group;
  return acc;
}, {});

export function getSessionGroup(sessionIdOrCode) {
  const raw = String(sessionIdOrCode || "").trim();
  if (!raw) return missionDB[0];

  const normalized = /^S?\d{1,2}$/i.test(raw)
    ? `S${pad2(Number(raw.replace(/^S/i, "")))}`
    : raw;

  return lessonMissionIndex[normalized] || lessonMissionIndex[String(Number(raw))] || missionDB[0];
}

export function getLevelMissions(sessionIdOrCode, level = "normal") {
  const group = getSessionGroup(sessionIdOrCode);
  const safeLevel = normalizeLevel(level);
  return group?.missions?.[safeLevel] || group?.normal || [];
}

export function getMissionBySlot(sessionIdOrCode, level = "normal", slot = 0) {
  const list = getLevelMissions(sessionIdOrCode, level);
  if (!list.length) return null;
  const index = Math.abs(Number(slot) || 0) % list.length;
  return list[index];
}

export function getAllMissions() {
  return missionDB.flatMap((group) => group.items || []);
}

export function getMissionStats() {
  const totalSessions = missionDB.length;
  const totalMissions = getAllMissions().length;

  return {
    patch: LESSON_DATA_PATCH,
    totalSessions,
    levels: LEVELS.slice(),
    missionsPerLevel: 10,
    missionsPerSession: 40,
    totalMissions,
    cefrRange: "A2-B1+"
  };
}

if (typeof window !== "undefined") {
  window.TechPathMissionDB = missionDB;
  window.TechPathLessonData = {
    patch: LESSON_DATA_PATCH,
    LEVELS,
    LEVEL_META,
    SESSION_BLUEPRINTS,
    missionDB,
    getSessionGroup,
    getLevelMissions,
    getMissionBySlot,
    getAllMissions,
    getMissionStats
  };
}

export default missionDB;
