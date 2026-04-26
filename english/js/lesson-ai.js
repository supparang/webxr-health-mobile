// /english/js/lesson-ai.js
// TechPath Lesson AI Director — Ultimate r9.2
// PATCH v20260426-lesson-ai-4levels-r9-2
// ✅ Supports 4 levels: easy(A2), normal(A2+), hard(B1), challenge(B1+)
// ✅ Compatible with lesson-main.js imports
// ✅ AI Difficulty Director: level up/down by performance
// ✅ AI Coach: skill-based hint for listening/speaking/reading/writing
// ✅ Adaptive time / speaking allowance / damage adjustment
// ✅ Works with lesson-4level-bridge.js but does not require it

export const LESSON_AI_PATCH = "v20260426-lesson-ai-4levels-r9-2";

export const LEVELS = ["easy", "normal", "hard", "challenge"];

export const LEVEL_META = {
  easy: {
    label: "EASY",
    cefr: "A2",
    color: "#2ed573",
    timeMod: 15,
    damageMod: -4,
    speakBase: 3,
    note: "A2 • basic support"
  },
  normal: {
    label: "NORMAL",
    cefr: "A2+",
    color: "#f1c40f",
    timeMod: 5,
    damageMod: 0,
    speakBase: 2,
    note: "A2+ • balanced"
  },
  hard: {
    label: "HARD",
    cefr: "B1",
    color: "#ff6b81",
    timeMod: -5,
    damageMod: 3,
    speakBase: 1,
    note: "B1 • real task"
  },
  challenge: {
    label: "CHALLENGE",
    cefr: "B1+",
    color: "#b197fc",
    timeMod: -10,
    damageMod: 6,
    speakBase: 0,
    note: "B1+ • high challenge"
  }
};

export const aiDirector = {
  patch: LESSON_AI_PATCH,

  pressure: 0,
  support: 0,
  mood: "STEADY",
  note: "AI กำลังดูจังหวะการเล่นของคุณ",
  lastMissionScore: 0,

  level: "normal",
  cefr: "A2+",

  successStreak: 0,
  failStreak: 0,
  total: 0,
  success: 0,
  fail: 0,

  skillStats: {
    listening: { total: 0, success: 0, fail: 0 },
    speaking: { total: 0, success: 0, fail: 0 },
    reading: { total: 0, success: 0, fail: 0 },
    writing: { total: 0, success: 0, fail: 0 }
  },

  lastMissionType: "",
  lastMissionId: "",
  lastCoachTip: "",
  lastChangedAt: 0,
  manualLockUntil: 0
};

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clean(value) {
  return String(value ?? "").trim();
}

function now() {
  return Date.now();
}

function safeLocalGet(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (_) {
    return "";
  }
}

function safeLocalSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {}
}

function queryParam(names) {
  try {
    const qs = new URLSearchParams(location.search);
    for (const name of names) {
      const value = qs.get(name);
      if (value != null && clean(value)) return clean(value);
    }
  } catch (_) {}
  return "";
}

export function normalizeDifficulty(value) {
  const raw = clean(value).toLowerCase();

  if (raw === "easy" || raw === "a2") return "easy";
  if (raw === "normal" || raw === "medium" || raw === "a2+") return "normal";
  if (raw === "hard" || raw === "b1") return "hard";
  if (raw === "challenge" || raw === "challenging" || raw === "expert" || raw === "b1+") {
    return "challenge";
  }

  return "normal";
}

export function getDifficultyMeta(diff = getSelectedDifficulty()) {
  const safe = normalizeDifficulty(diff);
  return LEVEL_META[safe] || LEVEL_META.normal;
}

export function getSelectedDifficulty() {
  return normalizeDifficulty(
    window.TECHPATH_SELECTED_LEVEL ||
    window.TECHPATH_SELECTED_DIFFICULTY ||
    queryParam(["level", "diff", "difficulty", "cefr"]) ||
    safeLocalGet("TECHPATH_SELECTED_LEVEL") ||
    aiDirector.level ||
    "normal"
  );
}

export function setSelectedDifficulty(diff, options = {}) {
  const safe = normalizeDifficulty(diff);
  const meta = getDifficultyMeta(safe);

  aiDirector.level = safe;
  aiDirector.cefr = meta.cefr;

  window.TECHPATH_SELECTED_LEVEL = safe;
  window.TECHPATH_SELECTED_DIFFICULTY = safe;

  safeLocalSet("TECHPATH_SELECTED_LEVEL", safe);

  if (!options.skipBridge && window.TechPathLevels && typeof window.TechPathLevels.setLevel === "function") {
    try {
      window.TechPathLevels.setLevel(safe);
    } catch (_) {}
  }

  renderQuestionDiffBadge(safe);
  renderAIDirector();

  return safe;
}

function levelIndex(level) {
  return LEVELS.indexOf(normalizeDifficulty(level));
}

function stepLevel(level, delta) {
  const idx = levelIndex(level);
  const next = clamp(idx + delta, 0, LEVELS.length - 1);
  return LEVELS[next] || "normal";
}

function readGlobalGameState() {
  const candidates = [
    window.lessonState,
    window.gameState,
    window.state,
    window.TechPathState,
    window.__TECHPATH_STATE
  ];

  for (const obj of candidates) {
    if (obj && typeof obj === "object") {
      return obj;
    }
  }

  return {};
}

function getSystemHP() {
  const gs = readGlobalGameState();
  const hp =
    gs.systemHP ??
    gs.hp ??
    gs.health ??
    window.systemHP ??
    window.TECHPATH_SYSTEM_HP;

  return clamp(Number(hp ?? 100), 0, 100);
}

function getCombo() {
  const gs = readGlobalGameState();
  const combo =
    gs.comboCount ??
    gs.combo ??
    window.comboCount ??
    window.TECHPATH_COMBO;

  return clamp(Number(combo ?? 0), 0, 999);
}

function getTimeLeft() {
  const gs = readGlobalGameState();
  const t =
    gs.timeLeft ??
    gs.remainingTime ??
    window.timeLeft ??
    window.TECHPATH_TIME_LEFT;

  return clamp(Number(t ?? 0), 0, 999);
}

function getMissionType(mission) {
  return clean(mission?.type || mission?.skill || aiDirector.lastMissionType || "reading").toLowerCase();
}

function getMissionLevel(mission) {
  return normalizeDifficulty(
    mission?._selectedDifficulty ||
    mission?.difficulty ||
    mission?.level ||
    getSelectedDifficulty()
  );
}

function skillStat(type) {
  const safeType = ["listening", "speaking", "reading", "writing"].includes(type)
    ? type
    : "reading";

  if (!aiDirector.skillStats[safeType]) {
    aiDirector.skillStats[safeType] = { total: 0, success: 0, fail: 0 };
  }

  return aiDirector.skillStats[safeType];
}

function updateSkillStats(type, ok) {
  const s = skillStat(type);
  s.total += 1;

  if (ok) s.success += 1;
  else s.fail += 1;
}

function skillAccuracy(type) {
  const s = skillStat(type);
  if (!s.total) return 1;
  return s.success / s.total;
}

export function getBaseTimeForMissionType(type) {
  const t = clean(type).toLowerCase();

  if (t === "speaking") return 42;
  if (t === "reading") return 36;
  if (t === "listening") return 38;
  if (t === "writing") return 52;

  return 40;
}

export function getDifficultyTimeMod(diff = getSelectedDifficulty()) {
  return getDifficultyMeta(diff).timeMod;
}

export function getAdaptiveTimeBonus() {
  let bonus = 0;

  bonus += aiDirector.support * 4;
  bonus -= aiDirector.pressure * 3;

  if (getSystemHP() <= 35) bonus += 8;
  if (aiDirector.failStreak >= 2) bonus += 8;
  if (aiDirector.successStreak >= 3) bonus -= 4;

  const level = getSelectedDifficulty();

  if (level === "easy") bonus += 4;
  if (level === "challenge") bonus -= 2;

  return clamp(bonus, -12, 18);
}

export function getAdaptiveSpeakAllowance() {
  const level = getSelectedDifficulty();
  const meta = getDifficultyMeta(level);

  let allowance = meta.speakBase;

  allowance += Math.max(aiDirector.support - aiDirector.pressure, 0);

  if (aiDirector.failStreak >= 2) allowance += 1;
  if (skillAccuracy("speaking") < 0.5) allowance += 1;
  if (level === "challenge" && aiDirector.successStreak >= 3) allowance -= 1;

  return clamp(allowance, 0, 5);
}

export function getAdaptiveDamageAdjustment() {
  let mod = 0;

  mod -= aiDirector.support * 4;
  mod += aiDirector.pressure * 3;

  mod += getDifficultyMeta(getSelectedDifficulty()).damageMod;

  if (getSystemHP() <= 35) mod -= 7;
  if (aiDirector.failStreak >= 2) mod -= 5;
  if (aiDirector.successStreak >= 3) mod += 2;

  return clamp(mod, -12, 12);
}

export function getAdaptiveBossHpAdjustment() {
  const level = getSelectedDifficulty();

  if (aiDirector.support >= 2 || aiDirector.failStreak >= 2) return -1;
  if (level === "challenge" && aiDirector.successStreak >= 2) return 1;
  if (aiDirector.pressure >= 3) return 1;

  return 0;
}

export function getTotalMissionTime(type, diff = getSelectedDifficulty()) {
  return clamp(
    getBaseTimeForMissionType(type) +
      getDifficultyTimeMod(diff) +
      getAdaptiveTimeBonus(),
    18,
    90
  );
}

export function setAIDirector(
  mood,
  note,
  pressure = aiDirector.pressure,
  support = aiDirector.support
) {
  aiDirector.mood = clean(mood) || "STEADY";
  aiDirector.note = clean(note) || "AI กำลังดูจังหวะการเล่นของคุณ";
  aiDirector.pressure = clamp(pressure, 0, 3);
  aiDirector.support = clamp(support, 0, 3);
  aiDirector.lastChangedAt = now();

  renderAIDirector();
}

function levelColor(level) {
  return getDifficultyMeta(level).color;
}

function tensionColor() {
  const tension = aiDirector.pressure - aiDirector.support;

  if (tension >= 2) return "#ff7675";
  if (tension <= -2) return "#55efc4";

  return levelColor(aiDirector.level);
}

export function renderAIDirector() {
  const stateEl = document.getElementById("ai-director-state");
  const subEl = document.getElementById("ai-director-sub");

  if (!stateEl || !subEl) return;

  const meta = getDifficultyMeta(aiDirector.level);
  const tension = aiDirector.pressure - aiDirector.support;

  stateEl.textContent =
    `${aiDirector.mood} • ${meta.label} ${meta.cefr}  P:${aiDirector.pressure} S:${aiDirector.support}`;

  subEl.textContent = aiDirector.note;

  stateEl.style.color = tensionColor();

  if (tension >= 2) {
    subEl.style.color = "#ffd4dc";
  } else if (tension <= -2) {
    subEl.style.color = "#d9ffe8";
  } else {
    subEl.style.color = "#eaf6ff";
  }
}

export function renderQuestionDiffBadge(diff = getSelectedDifficulty()) {
  const safe = normalizeDifficulty(diff);
  const meta = getDifficultyMeta(safe);
  const badge = document.getElementById("question-diff-badge");

  if (!badge) return;

  badge.textContent = `Q: ${meta.label} • ${meta.cefr}`;
  badge.style.color = meta.color;
  badge.style.borderColor = meta.color;
  badge.style.background = `color-mix(in srgb, ${meta.color} 14%, transparent)`;

  document.body.dataset.aiLevel = safe;
  document.documentElement.dataset.aiLevel = safe;
}

function getCoachTip(type, outcome, mission = {}) {
  const level = getMissionLevel(mission);
  const meta = getDifficultyMeta(level);

  if (outcome === "success") {
    if (type === "listening") return `ดีมาก ฟังจับใจความหลักได้แล้ว • ${meta.cefr}`;
    if (type === "speaking") return `เยี่ยม พูดได้ชัดขึ้นแล้ว ต่อไปลองพูดเป็นจังหวะธรรมชาติมากขึ้น • ${meta.cefr}`;
    if (type === "reading") return `ดีมาก จับ main idea ได้ถูกต้อง ต่อไปลองแยก detail กับ main idea • ${meta.cefr}`;
    if (type === "writing") return `ดีมาก ข้อเขียนชัดขึ้นแล้ว ต่อไปเพิ่มเหตุผลหรือ next step • ${meta.cefr}`;
    return `ดีมาก รักษาจังหวะนี้ไว้ • ${meta.cefr}`;
  }

  if (type === "listening") {
    return "AI Guide: ฟัง keyword ก่อน อย่าแปลทุกคำ ให้จับว่าใครทำอะไรและจุดประสงค์คืออะไร";
  }

  if (type === "speaking") {
    return "AI Guide: พูดช้าลงนิดหนึ่ง เน้นคำสำคัญ และเว้นจังหวะหลังแต่ละวลี";
  }

  if (type === "reading") {
    return "AI Guide: อ่านประโยคแรกและประโยคสุดท้ายก่อน แล้วหาว่าบทความพูดเรื่องอะไรเป็นหลัก";
  }

  if (type === "writing") {
    const kws = Array.isArray(mission.keywords) ? mission.keywords.slice(0, 4).join(", ") : "";
    return kws
      ? `AI Guide: ใส่ keyword อย่างน้อย 2–3 คำ เช่น ${kws} แล้วเขียนให้เป็นประโยคสมบูรณ์`
      : "AI Guide: เขียนประโยคสั้น ๆ ให้ครบ subject + verb + object แล้วเพิ่มเหตุผลหนึ่งข้อ";
  }

  return "AI Guide: ลองใหม่โดยจับ keyword และจุดประสงค์ของโจทย์ก่อน";
}

function announceCoachTip(tip) {
  aiDirector.lastCoachTip = tip;

  window.dispatchEvent(new CustomEvent("techpath:ai-coach-tip", {
    detail: {
      patch: LESSON_AI_PATCH,
      tip,
      level: aiDirector.level,
      cefr: aiDirector.cefr,
      pressure: aiDirector.pressure,
      support: aiDirector.support
    }
  }));
}

function maybeAutoAdjustLevel(outcome) {
  const current = getSelectedDifficulty();
  let next = current;

  if (outcome === "success") {
    if (aiDirector.successStreak >= 3 && aiDirector.pressure >= 2) {
      next = stepLevel(current, 1);
    }
  } else {
    if (aiDirector.failStreak >= 2 || aiDirector.support >= 3) {
      next = stepLevel(current, -1);
    }
  }

  if (next !== current) {
    setSelectedDifficulty(next);

    const meta = getDifficultyMeta(next);

    if (outcome === "success") {
      setAIDirector(
        "LEVEL UP",
        `AI ปรับเป็น ${meta.label} ${meta.cefr} เพราะคุณทำได้ต่อเนื่อง`,
        1,
        0
      );
    } else {
      setAIDirector(
        "SUPPORT MODE",
        `AI ลดเป็น ${meta.label} ${meta.cefr} เพื่อช่วยให้กลับมาจับจังหวะได้`,
        0,
        2
      );
    }

    window.dispatchEvent(new CustomEvent("techpath:ai-level-auto-adjust", {
      detail: {
        patch: LESSON_AI_PATCH,
        from: current,
        to: next,
        outcome,
        successStreak: aiDirector.successStreak,
        failStreak: aiDirector.failStreak
      }
    }));
  }
}

export function onMissionLoadedForAI(mission, isUnitFinalFn) {
  if (!mission) return;

  const type = getMissionType(mission);
  const level = getMissionLevel(mission);
  const meta = getDifficultyMeta(level);

  setSelectedDifficulty(level, { skipBridge: false });

  aiDirector.lastMissionType = type;
  aiDirector.lastMissionId = mission.missionUid || mission.id || "";
  aiDirector.level = level;
  aiDirector.cefr = meta.cefr;

  const totalTime = getTotalMissionTime(type, level);
  const allow = getAdaptiveSpeakAllowance();

  let bossAdj = 0;
  if (typeof isUnitFinalFn === "function") {
    try {
      bossAdj = isUnitFinalFn(mission.id) ? getAdaptiveBossHpAdjustment() : 0;
    } catch (_) {
      bossAdj = 0;
    }
  }

  const guide =
    mission.aiGuide ||
    getCoachTip(type, "load", mission) ||
    `AI Difficulty: ${meta.label} ${meta.cefr}`;

  setAIDirector(
    aiDirector.mood || "STEADY",
    `เวลา ${totalTime}วิ • พูดอนุโลม ${allow} คำ • Final Boss ${bossAdj >= 0 ? "+" : ""}${bossAdj} HP • ${guide}`,
    aiDirector.pressure,
    aiDirector.support
  );

  renderQuestionDiffBadge(level);

  window.dispatchEvent(new CustomEvent("techpath:ai-mission-loaded", {
    detail: {
      patch: LESSON_AI_PATCH,
      mission,
      type,
      level,
      cefr: meta.cefr,
      totalTime,
      speakAllowance: allow,
      bossAdjustment: bossAdj
    }
  }));
}

export function onMissionSuccessForAI(mission = {}, detail = {}) {
  const type = getMissionType(mission);
  const combo = getCombo();
  const timeLeft = getTimeLeft();

  aiDirector.total += 1;
  aiDirector.success += 1;
  aiDirector.successStreak += 1;
  aiDirector.failStreak = 0;

  updateSkillStats(type, true);

  let pressure = aiDirector.pressure;
  let support = aiDirector.support;

  if (timeLeft >= 18 || combo >= 2 || aiDirector.successStreak >= 2) {
    pressure += 1;
    support -= 1;
  } else {
    pressure += 0;
    support -= 0;
  }

  const tip = getCoachTip(type, "success", mission);

  setAIDirector(
    aiDirector.successStreak >= 3 ? "CHALLENGE UP" : "STEADY",
    tip,
    pressure,
    support
  );

  announceCoachTip(tip);
  maybeAutoAdjustLevel("success");

  window.dispatchEvent(new CustomEvent("techpath:ai-success", {
    detail: {
      patch: LESSON_AI_PATCH,
      mission,
      type,
      level: aiDirector.level,
      successStreak: aiDirector.successStreak,
      failStreak: aiDirector.failStreak,
      combo,
      timeLeft,
      ...detail
    }
  }));
}

export function onMissionFailForAI(mission = {}, detail = {}) {
  const type = getMissionType(mission);

  aiDirector.total += 1;
  aiDirector.fail += 1;
  aiDirector.failStreak += 1;
  aiDirector.successStreak = 0;

  updateSkillStats(type, false);

  let pressure = aiDirector.pressure - 1;
  let support = aiDirector.support + 1;

  if (getSystemHP() <= 35) support += 1;
  if (skillAccuracy(type) < 0.5) support += 1;

  const tip = getCoachTip(type, "fail", mission);

  setAIDirector(
    aiDirector.failStreak >= 2 ? "SUPPORT MODE" : "AI GUIDE",
    tip,
    pressure,
    support
  );

  announceCoachTip(tip);
  maybeAutoAdjustLevel("fail");

  window.dispatchEvent(new CustomEvent("techpath:ai-fail", {
    detail: {
      patch: LESSON_AI_PATCH,
      mission,
      type,
      level: aiDirector.level,
      successStreak: aiDirector.successStreak,
      failStreak: aiDirector.failStreak,
      systemHP: getSystemHP(),
      ...detail
    }
  }));
}

export function getAICoachTip(type = aiDirector.lastMissionType, outcome = "fail", mission = {}) {
  return getCoachTip(type, outcome, mission);
}

export function resetAIDirector() {
  aiDirector.pressure = 0;
  aiDirector.support = 0;
  aiDirector.mood = "STEADY";
  aiDirector.note = "AI กำลังดูจังหวะการเล่นของคุณ";
  aiDirector.lastMissionScore = 0;
  aiDirector.level = getSelectedDifficulty();
  aiDirector.cefr = getDifficultyMeta(aiDirector.level).cefr;
  aiDirector.successStreak = 0;
  aiDirector.failStreak = 0;
  aiDirector.total = 0;
  aiDirector.success = 0;
  aiDirector.fail = 0;
  aiDirector.lastCoachTip = "";

  Object.keys(aiDirector.skillStats).forEach((key) => {
    aiDirector.skillStats[key] = { total: 0, success: 0, fail: 0 };
  });

  renderAIDirector();
  renderQuestionDiffBadge(aiDirector.level);
}

function bootAI() {
  const initial = getSelectedDifficulty();
  setSelectedDifficulty(initial, { skipBridge: false });
  setAIDirector(
    "STEADY",
    `AI Difficulty พร้อมใช้งาน • ${getDifficultyMeta(initial).label} ${getDifficultyMeta(initial).cefr}`,
    0,
    0
  );

  window.TechPathAI = {
    patch: LESSON_AI_PATCH,
    aiDirector,
    LEVELS,
    LEVEL_META,
    normalizeDifficulty,
    getSelectedDifficulty,
    setSelectedDifficulty,
    getDifficultyMeta,
    getBaseTimeForMissionType,
    getDifficultyTimeMod,
    getAdaptiveTimeBonus,
    getAdaptiveSpeakAllowance,
    getAdaptiveDamageAdjustment,
    getAdaptiveBossHpAdjustment,
    getTotalMissionTime,
    getAICoachTip,
    resetAIDirector,
    renderAIDirector,
    renderQuestionDiffBadge
  };

  window.addEventListener("techpath:level-change", (ev) => {
    const level = ev?.detail?.level;
    if (level) {
      setSelectedDifficulty(level, { skipBridge: true });
    }
  });

  console.log("[TechPath AI]", LESSON_AI_PATCH);
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAI, { once: true });
  } else {
    bootAI();
  }
}

export default aiDirector;
