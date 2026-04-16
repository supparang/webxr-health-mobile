import { SESSION_STATS_KEY, state } from "./lesson-state.js";

export let sessionStats = loadSessionStats();
let missionRun = null;

function loadSessionStats() {
  try {
    const raw = localStorage.getItem(SESSION_STATS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return {
      totalAttempts: Number(data && data.totalAttempts) || 0,
      totalClears: Number(data && data.totalClears) || 0,
      totalFails: Number(data && data.totalFails) || 0,
      bossClears: Number(data && data.bossClears) || 0,
      bestCombo: Number(data && data.bestCombo) || 0,
      lastAIMood: typeof (data && data.lastAIMood) === "string" ? data.lastAIMood : "STEADY",
      missionTypeWins: Object.assign({ speaking: 0, reading: 0, listening: 0, writing: 0 }, data && data.missionTypeWins ? data.missionTypeWins : {}),
      unitClears: Object.assign({ 5: 0, 10: 0, 15: 0 }, data && data.unitClears ? data.unitClears : {})
    };
  } catch (e) {
    return {
      totalAttempts: 0, totalClears: 0, totalFails: 0, bossClears: 0, bestCombo: 0, lastAIMood: "STEADY",
      missionTypeWins: { speaking: 0, reading: 0, listening: 0, writing: 0 }, unitClears: { 5: 0, 10: 0, 15: 0 }
    };
  }
}

export function saveSessionStats() {
  try { localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(sessionStats)); } catch (e) {}
}

export function renderHubStatsBoard() {
  const body = document.getElementById("hub-stats-body");
  if (!body) return;
  const topType = Object.entries(sessionStats.missionTypeWins).sort((a, b) => b[1] - a[1])[0] || ["speaking", 0];
  body.textContent =
`Attempts: ${sessionStats.totalAttempts}
Clears: ${sessionStats.totalClears} | Fails: ${sessionStats.totalFails}
Boss Clears: ${sessionStats.bossClears}
Best Combo: x${sessionStats.bestCombo}
Top Skill: ${String(topType[0]).toUpperCase()} (${topType[1]})
AI Mood ล่าสุด: ${sessionStats.lastAIMood}`;
}

export function resetSummaryPanel() {
  const panel = document.getElementById("summary-panel");
  if (panel) panel.style.display = "none";
}

export function showEndSummary(success, currentMission, aiMood, extraLines = []) {
  const panel = document.getElementById("summary-panel");
  const title = document.getElementById("summary-title");
  const body = document.getElementById("summary-body");
  if (!panel || !title || !body) return;
  const missionType = currentMission && currentMission.type ? currentMission.type.toUpperCase() : "UNKNOWN";
  const missionName = currentMission && currentMission.title ? currentMission.title : "Mission";
  const lines = [
    `Mission: ${missionName}`,
    `Type: ${missionType}`,
    `Score: ${state.gameScore}`,
    `HP: ${state.systemHP}%`,
    `Combo Peak: x${Math.max(state.comboCount, sessionStats.bestCombo)}`,
    `AI Mood: ${aiMood}`,
    `Question Diff: ${(currentMission && currentMission._selectedDifficulty ? currentMission._selectedDifficulty : state.gameDifficulty).toUpperCase()}`
  ].concat(extraLines || []);
  title.textContent = success ? "MISSION SUMMARY ✅" : "MISSION SUMMARY ⚠️";
  title.style.color = success ? "#2ed573" : "#ff6b81";
  body.textContent = lines.join("\n");
  panel.style.display = "block";
}

export function recordMissionStart(mission, aiMood) {
  missionRun = { startedScore: state.gameScore, startedHp: state.systemHP, aiMoodAtStart: aiMood, missionId: mission && mission.id };
  sessionStats.totalAttempts += 1;
  sessionStats.lastAIMood = aiMood;
  saveSessionStats();
  renderHubStatsBoard();
}

export function recordMissionSuccess(currentMission, aiMood, isUnitFinalFn) {
  sessionStats.totalClears += 1;
  sessionStats.lastAIMood = aiMood;
  if (currentMission && currentMission.type && sessionStats.missionTypeWins[currentMission.type] != null) {
    sessionStats.missionTypeWins[currentMission.type] += 1;
  }
  if (currentMission && isUnitFinalFn(currentMission.id)) {
    sessionStats.bossClears += 1;
    sessionStats.unitClears[currentMission.id] = (sessionStats.unitClears[currentMission.id] || 0) + 1;
  }
  saveSessionStats();
  renderHubStatsBoard();
}

export function recordMissionFail(aiMood) {
  sessionStats.totalFails += 1;
  sessionStats.lastAIMood = aiMood;
  saveSessionStats();
  renderHubStatsBoard();
}

export function getMissionRunGain() {
  return missionRun ? state.gameScore - missionRun.startedScore : 0;
}
