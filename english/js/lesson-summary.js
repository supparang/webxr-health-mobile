// /english/js/lesson-summary.js
import { SESSION_STATS_KEY, state } from "./lesson-state.js";

export let sessionStats = loadSessionStats();
let missionRun = null;

function loadSessionStats() {
  try {
    const raw = localStorage.getItem(SESSION_STATS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return {
      totalAttempts: Number(data?.totalAttempts) || 0,
      totalClears: Number(data?.totalClears) || 0,
      totalFails: Number(data?.totalFails) || 0,
      bossClears: Number(data?.bossClears) || 0,
      bestCombo: Number(data?.bestCombo) || 0,
      lastAIMood: typeof data?.lastAIMood === "string" ? data.lastAIMood : "STEADY",
      missionTypeWins: Object.assign(
        { speaking: 0, reading: 0, listening: 0, writing: 0 },
        data?.missionTypeWins || {}
      ),
      unitClears: Object.assign(
        { 5: 0, 10: 0, 15: 0 },
        data?.unitClears || {}
      )
    };
  } catch (e) {
    return {
      totalAttempts: 0,
      totalClears: 0,
      totalFails: 0,
      bossClears: 0,
      bestCombo: 0,
      lastAIMood: "STEADY",
      missionTypeWins: { speaking: 0, reading: 0, listening: 0, writing: 0 },
      unitClears: { 5: 0, 10: 0, 15: 0 }
    };
  }
}

export function saveSessionStats() {
  try {
    localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(sessionStats));
  } catch (e) {}
}

function getTopSkillLabel() {
  const topType = Object.entries(sessionStats.missionTypeWins)
    .sort((a, b) => b[1] - a[1])[0] || ["speaking", 0];
  return `${String(topType[0]).toUpperCase()} (${topType[1]})`;
}

export function renderHubStatsBoard() {
  const body = document.getElementById("hub-stats-body");
  if (!body) return;

  body.textContent =
`Clears: ${sessionStats.totalClears}
Boss: ${sessionStats.bossClears}
Best Combo: x${sessionStats.bestCombo}
Top Skill: ${getTopSkillLabel()}`;
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

  const missionName = currentMission?.title || "Mission";
  const missionType = (currentMission?.type || "unknown").toUpperCase();
  const diff = (currentMission?._selectedDifficulty || state.gameDifficulty || "normal").toUpperCase();

  const lines = [
    `Mission: ${missionName}`,
    `Type: ${missionType}`,
    `Score: ${state.gameScore}`,
    `HP: ${state.systemHP}%`,
    `Diff: ${diff}`
  ].concat(extraLines || []);

  title.textContent = success ? "MISSION SUMMARY ✅" : "MISSION SUMMARY ⚠️";
  title.style.color = success ? "#2ed573" : "#ff6b81";
  body.textContent = lines.join("\n");
  panel.style.display = "block";
}

export function recordMissionStart(mission, aiMood) {
  missionRun = {
    startedScore: state.gameScore,
    startedHp: state.systemHP,
    aiMoodAtStart: aiMood,
    missionId: mission?.id || null
  };

  sessionStats.totalAttempts += 1;
  sessionStats.lastAIMood = aiMood;
  saveSessionStats();
  renderHubStatsBoard();
}

export function recordMissionSuccess(currentMission, aiMood, isUnitFinalFn) {
  sessionStats.totalClears += 1;
  sessionStats.lastAIMood = aiMood;

  if (currentMission?.type && sessionStats.missionTypeWins[currentMission.type] != null) {
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
