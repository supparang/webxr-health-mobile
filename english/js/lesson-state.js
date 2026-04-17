// /english/js/lesson-state.js

export const CLEARED_MISSIONS_KEY = "TECHPATH_CLEARED_MISSIONS_V1";
export const PROFILE_LOCAL_KEY = "TECHPATH_PROFILE_LOCAL_V1";
export const SESSION_STATS_KEY = "TECHPATH_SESSION_STATS_V1";
export const DIFFICULTY_LOCAL_KEY = "TECHPATH_DIFFICULTY_V1";

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function normalizeDifficulty(level) {
  const v = String(level || "").toLowerCase();
  if (v === "easy" || v === "normal" || v === "hard") return v;
  return "normal";
}

function loadDifficulty() {
  try {
    return normalizeDifficulty(localStorage.getItem(DIFFICULTY_LOCAL_KEY) || "normal");
  } catch (e) {
    return "normal";
  }
}

function saveDifficulty(level) {
  try {
    localStorage.setItem(DIFFICULTY_LOCAL_KEY, normalizeDifficulty(level));
  } catch (e) {}
}

function loadClearedMissionIds() {
  const raw = safeJsonParse(
    (() => {
      try {
        return localStorage.getItem(CLEARED_MISSIONS_KEY);
      } catch (e) {
        return null;
      }
    })(),
    []
  );

  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw
        .map(v => Number(v))
        .filter(v => Number.isInteger(v) && v > 0)
    )
  ).sort((a, b) => a - b);
}

function saveClearedMissionIds(list) {
  try {
    localStorage.setItem(CLEARED_MISSIONS_KEY, JSON.stringify(list || []));
  } catch (e) {}
}

export let clearedMissions = loadClearedMissionIds();

export const state = {
  appId: "english-d4bfa",
  db: null,
  auth: null,
  currentUser: null,

  currentMission: null,
  lastMissionId: 1,

  gameDifficulty: loadDifficulty(),
  gameScore: 0,
  systemHP: 100,
  currentRewardStreak: 0,

  comboCount: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,

  timeLeft: 0,
  missionTimer: null,

  isGameOver: false
};

export function clamp(value, min, max) {
  const num = Number(value);
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(num)) return lo;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return num;
  return Math.min(hi, Math.max(lo, num));
}

export function setDbRuntime(db, auth, currentUser = null, appId = "english-d4bfa") {
  state.db = db || null;
  state.auth = auth || null;
  state.currentUser = currentUser || null;
  state.appId = appId || "english-d4bfa";
}

export function setCurrentUser(user) {
  state.currentUser = user || null;
}

export function updateDifficulty(level) {
  const next = normalizeDifficulty(level);
  state.gameDifficulty = next;
  saveDifficulty(next);
  return next;
}

export function markMissionCleared(id) {
  const missionId = Number(id);
  if (!Number.isInteger(missionId) || missionId <= 0) return false;
  if (clearedMissions.includes(missionId)) return false;

  clearedMissions = [...clearedMissions, missionId].sort((a, b) => a - b);
  saveClearedMissionIds(clearedMissions);
  return true;
}

export function unmarkMissionCleared(id) {
  const missionId = Number(id);
  const next = clearedMissions.filter(v => v !== missionId);
  const changed = next.length !== clearedMissions.length;
  if (!changed) return false;

  clearedMissions = next;
  saveClearedMissionIds(clearedMissions);
  return true;
}

export function clearMissionProgress() {
  clearedMissions = [];
  saveClearedMissionIds(clearedMissions);
}

export function reloadClearedMissionProgress() {
  clearedMissions = loadClearedMissionIds();
  return clearedMissions.slice();
}

export function getNextMissionId(lastMissionId = 1, totalMissions = 15) {
  const total = Math.max(1, Number(totalMissions) || 1);
  const current = Math.max(1, Number(lastMissionId) || 1);
  return current >= total ? 1 : current + 1;
}

export function resetRunState() {
  if (state.missionTimer) {
    clearInterval(state.missionTimer);
  }

  state.currentMission = null;
  state.lastMissionId = 1;

  state.gameScore = 0;
  state.systemHP = 100;
  state.comboCount = 0;
  state.consecutiveWins = 0;
  state.consecutiveLosses = 0;

  state.timeLeft = 0;
  state.missionTimer = null;
  state.isGameOver = false;
}

export function resetSessionForHub() {
  if (state.missionTimer) {
    clearInterval(state.missionTimer);
  }

  state.currentMission = null;
  state.timeLeft = 0;
  state.missionTimer = null;
  state.isGameOver = false;
  state.systemHP = 100;
}