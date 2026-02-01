'use strict';

/**
 * stats-store.js
 * - เก็บ session summary แบบ lightweight ลง localStorage
 * - ไม่บังคับใช้: ถ้า localStorage ใช้ไม่ได้จะไม่พัง
 */

const KEY = 'VRFIT_SESSIONS_V1';

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function safeStringify(obj) {
  try { return JSON.stringify(obj); } catch { return ''; }
}

export function readSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = safeParse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordSession(gameKey, session) {
  try {
    const all = readSessions();
    all.push({ game: gameKey, ...session });
    // keep last 200
    while (all.length > 200) all.shift();
    localStorage.setItem(KEY, safeStringify(all));
  } catch (e) {
    // ignore
  }
}

export function clearSessions() {
  try { localStorage.removeItem(KEY); } catch {}
}