export const TECHPATH_PROGRESS_KEY = "TECHPATH_VR_PROGRESS_V1";
export const SESSION_STATS_KEY = "TECHPATH_VR_SESSION_STATS_V1";
export const PROFILE_LOCAL_KEY = "TECHPATH_VR_PROFILE_V1";

export const state = {
  currentMission: null,
  missionTimer: null,
  timeLeft: 60,
  gameScore: 0,
  systemHP: 100,
  isGameOver: false,
  comboCount: 0,
  gameDifficulty: "normal",
  consecutiveWins: 0,
  consecutiveLosses: 0,
  lastMissionId: null,
  currentRewardStreak: 0,
  db: null,
  auth: null,
  currentUser: null,
  appId: "english-d4bfa"
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function loadClearedMissions() {
  try {
    const raw = localStorage.getItem(TECHPATH_PROGRESS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

export let clearedMissions = loadClearedMissions();

export function saveClearedMissions() {
  try {
    localStorage.setItem(TECHPATH_PROGRESS_KEY, JSON.stringify(clearedMissions));
  } catch (e) {}
}

export function markMissionCleared(id) {
  if (!clearedMissions.includes(id)) {
    clearedMissions.push(id);
    clearedMissions.sort((a, b) => a - b);
    saveClearedMissions();
  }
}

export function getNextMissionId(id, total) {
  return id >= total ? 1 : id + 1;
}

export function setDbRuntime(db, auth, currentUser, appId) {
  state.db = db;
  state.auth = auth;
  state.currentUser = currentUser;
  state.appId = appId || state.appId;
}

export function setCurrentUser(user) {
  state.currentUser = user;
}

export function updateDifficulty(level) {
  state.gameDifficulty = level;
}

export function getDifficultyColor(diff) {
  if (diff === "easy") return "#55efc4";
  if (diff === "hard") return "#ff7675";
  return "#f1c40f";
}
