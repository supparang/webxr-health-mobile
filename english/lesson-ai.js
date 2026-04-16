import { state, clamp, getDifficultyColor } from "./lesson-state.js";

export const aiDirector = {
  pressure: 0,
  support: 0,
  mood: "STEADY",
  note: "AI กำลังดูจังหวะการเล่นของคุณ",
  lastMissionScore: 0
};

export function getBaseTimeForMissionType(type) {
  if (type === "speaking") return 40;
  if (type === "reading") return 30;
  if (type === "listening") return 35;
  if (type === "writing") return 45;
  return 35;
}

export function getDifficultyTimeMod() {
  return state.gameDifficulty === "easy" ? 15 : (state.gameDifficulty === "hard" ? -15 : 0);
}

export function getAdaptiveTimeBonus() {
  let bonus = 0;
  bonus += aiDirector.support * 4;
  bonus -= aiDirector.pressure * 3;
  if (state.systemHP <= 35) bonus += 6;
  if (state.consecutiveLosses >= 2) bonus += 4;
  if (state.consecutiveWins >= 2) bonus -= 2;
  return clamp(bonus, -10, 14);
}

export function getAdaptiveSpeakAllowance() {
  const base = state.gameDifficulty === "easy" ? 3 : (state.gameDifficulty === "normal" ? 1 : 0);
  const bonus = Math.max(aiDirector.support - aiDirector.pressure, 0);
  return clamp(base + bonus, 0, 5);
}

export function getAdaptiveDamageAdjustment() {
  let mod = 0;
  mod -= aiDirector.support * 4;
  mod += aiDirector.pressure * 3;
  if (state.systemHP <= 35) mod -= 5;
  return clamp(mod, -10, 10);
}

export function getAdaptiveBossHpAdjustment() {
  if (aiDirector.support >= 2) return -1;
  if (aiDirector.pressure >= 2) return 1;
  return 0;
}

export function setAIDirector(mood, note, pressure = aiDirector.pressure, support = aiDirector.support) {
  aiDirector.mood = mood;
  aiDirector.note = note;
  aiDirector.pressure = clamp(pressure, 0, 3);
  aiDirector.support = clamp(support, 0, 3);
  renderAIDirector();
}

export function renderAIDirector() {
  const stateEl = document.getElementById("ai-director-state");
  const subEl = document.getElementById("ai-director-sub");
  if (!stateEl || !subEl) return;
  const tension = aiDirector.pressure - aiDirector.support;
  stateEl.textContent = `${aiDirector.mood}  P:${aiDirector.pressure} S:${aiDirector.support}`;
  subEl.textContent = aiDirector.note;
  stateEl.style.color = tension >= 2 ? "#ff7675" : (tension <= -2 ? "#55efc4" : "#ffffff");
}

export function renderQuestionDiffBadge(diff = state.gameDifficulty) {
  const badge = document.getElementById("question-diff-badge");
  if (!badge) return;
  badge.textContent = `Q: ${String(diff || "normal").toUpperCase()}`;
  const color = getDifficultyColor(diff);
  badge.style.color = color;
  badge.style.borderColor = color;
}

export function onMissionLoadedForAI(mission, isUnitFinalFn) {
  if (!mission) return;
  const totalTime = getBaseTimeForMissionType(mission.type) + getDifficultyTimeMod() + getAdaptiveTimeBonus();
  const allow = getAdaptiveSpeakAllowance();
  const bossAdj = isUnitFinalFn(mission.id) ? getAdaptiveBossHpAdjustment() : 0;
  setAIDirector(
    aiDirector.mood,
    `เวลา ${clamp(totalTime, 18, 80)}วิ • พูดอนุโลม ${allow} คำ • Final Boss ${bossAdj >= 0 ? "+" : ""}${bossAdj} HP`,
    aiDirector.pressure,
    aiDirector.support
  );
  renderQuestionDiffBadge(mission._selectedDifficulty || state.gameDifficulty);
}

export function onMissionSuccessForAI() {
  if (state.timeLeft >= 18 || state.comboCount >= 2) {
    setAIDirector("CHALLENGE UP", "AI เห็นว่าคุณเริ่มคล่องแล้ว — จะเร่งจังหวะขึ้นนิดหนึ่ง", aiDirector.pressure + 1, aiDirector.support - 1);
  } else {
    setAIDirector("STEADY", "ยังคงบาลานซ์อยู่ — รักษาจังหวะนี้ต่อไป", aiDirector.pressure, aiDirector.support);
  }
}

export function onMissionFailForAI(reason = "damage") {
  const note = reason === "timeout"
    ? "AI เห็นว่าเวลาเริ่มกดดัน — จะผ่อนเวลาให้ในด่านถัดไป"
    : "AI จะช่วยผ่อนเกมให้เล็กน้อยในด่านถัดไป";
  setAIDirector("SUPPORT MODE", note, aiDirector.pressure - 1, aiDirector.support + 1);
}
