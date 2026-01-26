// === /fitness/js/stats-store.js ===
// Minimal stats store for Fitness Academy (localStorage)
// ✅ recordSession(gameKey, summary)
// ✅ getLatest(gameKey)
// ✅ getAll(gameKey)

'use strict';

const KEY = 'VRFITNESS_STATS_V1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('[stats-store] cannot write', e);
  }
}

export function recordSession(gameKey, summary) {
  if (!gameKey) return;
  const all = readAll();
  const arr = Array.isArray(all[gameKey]) ? all[gameKey] : [];
  arr.unshift(summary);
  // keep last 50
  all[gameKey] = arr.slice(0, 50);
  writeAll(all);
}

export function getLatest(gameKey) {
  const all = readAll();
  const arr = Array.isArray(all[gameKey]) ? all[gameKey] : [];
  return arr[0] || null;
}

export function getAll(gameKey) {
  const all = readAll();
  return Array.isArray(all[gameKey]) ? all[gameKey] : [];
}