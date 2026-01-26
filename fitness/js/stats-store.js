// === js/stats-store.js — simple localStorage store ===
'use strict';

const KEY = 'VRFIT_SESSIONS_V1';

export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function saveSessions(arr) {
  try { localStorage.setItem(KEY, JSON.stringify(arr || [])); } catch (_) {}
}

export function recordSession(gameKey, summary) {
  const arr = loadSessions();
  arr.push({ game: gameKey, ...summary });
  while (arr.length > 250) arr.shift();
  saveSessions(arr);
}