// === /fitness/js/stats-store.js ===
'use strict';

const KEY = 'VRFITNESS_STATS_V1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch (_) {}
}

export function recordSession(gameKey, row) {
  const all = readAll();
  if (!all[gameKey]) all[gameKey] = [];
  all[gameKey].unshift(row);
  all[gameKey] = all[gameKey].slice(0, 50);
  writeAll(all);
}

export function getSessions(gameKey) {
  const all = readAll();
  return Array.isArray(all[gameKey]) ? all[gameKey] : [];
}

export function getAllStats() {
  return readAll();
}

export function clearStats() {
  writeAll({});
}