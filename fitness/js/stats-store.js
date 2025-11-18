// fitness/js/stats-store.js
'use strict';

const KEY = 'vrfitness_stats_v1';

export function recordSession(gameId, summary) {
  try {
    const now = Date.now();
    const item = { gameId, ts: now, ...summary };
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(item);
    const trimmed = list.slice(0, 100); // เก็บสูงสุด 100 รอบล่าสุด
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('VRFitness: cannot save stats', e);
  }
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
