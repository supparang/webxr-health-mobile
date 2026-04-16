// /english/js/lesson-state.js
'use strict';

export const CLEARED_MISSIONS_KEY = 'TECHPATH_VR_CLEARED_MISSIONS_V1';
export const PROFILE_LOCAL_KEY = 'TECHPATH_VR_PROFILE_V1';
export const SESSION_STATS_KEY = 'TECHPATH_VR_SESSION_STATS_V1';

function loadClearedMissions() {
  try {
    const raw = localStorage.getItem(CLEARED_MISSIONS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? arr.map(v => Number(v)).filter(v => Number.isFinite(v))
      : [];
  } catch (e) {
    return [];
  }
}

function saveClearedMissions() {
  try {
    localStorage.setItem(CLEARED_MISSIONS_KEY, JSON.stringify(clearedMissions));
  } catch (e) {}
}

export const clearedMissions = loadClearedMissions();

export const state = {
  db: null,
  auth: null,
  currentUser: null,
  appId: 'english-d4bfa',

  currentMission: null,
  lastMissionId: 1,

  missionTimer: null,
  timeLeft: 0,

  gameScore: 0,
  systemHP: 100,
  comboCount: 0,
  isGameOver: false,

  gameDifficulty: 'normal',
  consecutiveWins: 0,
  consecutiveLosses: 0,

  currentRewardStreak: 0
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getDifficultyColor(diff = state.gameDifficulty) {
  if (diff === 'easy') return '#2ecc71';
  if (diff === 'hard') return '#e74c3c';
  return '#f1c40f';
}

export function updateDifficulty(level = 'normal') {
  state.gameDifficulty = ['easy', 'normal', 'hard'].includes(level) ? level : 'normal';
}

export function markMissionCleared(id) {
  const missionId = Number(id);
  if (!Number.isFinite(missionId)) return;

  if (!clearedMissions.includes(missionId)) {
    clearedMissions.push(missionId);
    clearedMissions.sort((a, b) => a - b);
    saveClearedMissions();
  }
}

export function setCurrentUser(user) {
  state.currentUser = user || null;
}

export function setDbRuntime(db, auth, currentUser = null, appId = 'english-d4bfa') {
  state.db = db || null;
  state.auth = auth || null;
  state.currentUser = currentUser || null;
  state.appId = appId || 'english-d4bfa';
}

export function getNextMissionId(lastId = 1, totalCount = 15) {
  const current = Number(lastId);
  const max = Number(totalCount);

  if (!Number.isFinite(current) || current < 1) return 1;
  if (!Number.isFinite(max) || max < 1) return current + 1;

  const next = current + 1;
  return next > max ? 1 : next;
}
