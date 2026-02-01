// === /fitness/js/stats-store.js ===
// Minimal local stats store (latest session)
// Export: recordSession(gameKey, payload), getLatest(gameKey)

'use strict';

const KEY = 'VRFIT_STATS_LATEST_V1';

function safeParse(s){
  try{ return JSON.parse(s); }catch{ return null; }
}

export function recordSession(gameKey, payload){
  const raw = localStorage.getItem(KEY);
  const all = safeParse(raw) || {};
  all[gameKey] = payload || {};
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getLatest(gameKey){
  const raw = localStorage.getItem(KEY);
  const all = safeParse(raw) || {};
  return all[gameKey] || null;
}