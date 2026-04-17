// /english/js/lesson-summary.js

import { SESSION_STATS_KEY, state } from "./lesson-state.js";

export let sessionStats = loadSessionStats();
let missionRun = null;

function defaultSessionStats() {
  return {
    totalAttempts: 0,
    totalClears: 0,
    totalFails: 0,
    bossClears: 0,
    bestCombo: 0,
    lastAIMood: "STEADY",
    missionTypeWins: {
      speaking: 0,
      reading: 0,
      listening: 0,
      writing: 0
    },
    unitClears: {
      5: 0,
      10: 0,
      15: 0
    }
  };
}

function safeMergeStats(data) {
  const base = defaultSessionStats();
  const src = data && typeof data === "object" ? data : {};

  return {
    totalAttempts: Number(src.totalAttempts) || 0,
    totalClears: Number(src.totalClears) || 0,
    totalFails: Number(src.totalFails) || 0,
    bossClears: Number(src.bossClears) || 0,
    bestCombo: Number(src.bestCombo) || 0,
    lastAIMood: typeof src.lastAIMood === "string" ? src.lastAIMood : "STEADY",
    missionTypeWins: Object.assign({}, base.missionTypeWins, src.missionTypeWins || {}),
    unitClears: Object.assign({}, base.unitClears, src.unitClears || {})
  };
}

function loadSessionStats() {
  try {
    const raw = localStorage.getItem(SESSION_STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return safeMergeStats(parsed);
  } catch (e) {
    return defaultSessionStats();
  }
}

export function saveSessionStats() {
  try {
    localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(sessionStats));
  } catch (e) {}
}

export function renderHubStatsBoard() {
  const body = document.getElementById("hub-stats-body");
  if (!body) return;

  const topType =
    Object.entries(sessionStats.missionTypeWins)
      .sort((a, b) => b[1] - a[1])[0] || ["speaking", 0];

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

  const missionType = currentMission && currentMission.type
    ? currentMission.type.toUpperCase()
    : "UNKNOWN";

  const missionName = currentMission && currentMission.title
    ? currentMission.title
    : "Mission";

  const selectedDiff =
    (currentMission && currentMission._selectedDifficulty
      ? currentMission._selectedDifficulty
      : state.gameDifficulty) || "normal";

  const comboPeak = Math.max(state.comboCount || 0, sessionStats.bestCombo || 0);

  const lines = [
    `Mission: ${missionName}`,
    `Type: ${missionType}`,
    `Score: ${state.gameScore}`,
    `HP: ${state.systemHP}%`,
    `Combo Peak: x${comboPeak}`,
    `AI Mood: ${aiMood || sessionStats.lastAIMood || "STEADY"}`,
    `Question Diff: ${String(selectedDiff).toUpperCase()}`
  ].concat(Array.isArray(extraLines) ? extraLines : []);

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
    missionId: mission && mission.id
  };

  sessionStats.totalAttempts += 1;
  sessionStats.lastAIMood = aiMood || "STEADY";
  saveSessionStats();
  renderHubStatsBoard();
}

export function recordMissionSuccess(currentMission, aiMood, isUnitFinalFn) {
  sessionStats.totalClears += 1;
  sessionStats.lastAIMood = aiMood || sessionStats.lastAIMood || "STEADY";

  if (currentMission && currentMission.type && sessionStats.missionTypeWins[currentMission.type] != null) {
    sessionStats.missionTypeWins[currentMission.type] += 1;
  }

  const isFinal =
    typeof isUnitFinalFn === "function"
      ? !!isUnitFinalFn(currentMission && currentMission.id)
      : false;

  if (currentMission && isFinal) {
    sessionStats.bossClears += 1;
    sessionStats.unitClears[currentMission.id] =
      (sessionStats.unitClears[currentMission.id] || 0) + 1;
  }

  if ((state.comboCount || 0) > sessionStats.bestCombo) {
    sessionStats.bestCombo = state.comboCount || 0;
  }

  saveSessionStats();
  renderHubStatsBoard();
}

export function recordMissionFail(aiMood) {
  sessionStats.totalFails += 1;
  sessionStats.lastAIMood = aiMood || sessionStats.lastAIMood || "STEADY";
  saveSessionStats();
  renderHubStatsBoard();
}

export function getMissionRunGain() {
  return missionRun ? state.gameScore - missionRun.startedScore : 0;
}