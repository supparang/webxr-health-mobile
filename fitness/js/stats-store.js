// === /fitness/js/stats-store.js — Local summary store for VR Fitness (PATCH 2026-01-27) ===
'use strict';

const KEY = 'vrfitness_stats_v1';
const MAX_ITEMS = 100;

function safeJsonParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * บันทึก summary ของ 1 session ลง localStorage
 * @param {string} gameId  เช่น 'shadow-breaker'
 * @param {Object} summary ข้อมูลสรุป session จาก engine
 */
export function recordSession(gameId, summary) {
  try {
    if (!gameId) return;
    const now = Date.now();
    const item = { gameId: String(gameId), ts: now, ...(summary || {}) };

    const raw = localStorage.getItem(KEY);
    const list = raw ? safeJsonParse(raw, []) : [];

    list.unshift(item);
    const trimmed = list.slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('VRFitness: cannot save stats', e);
  }
}

/**
 * โหลดประวัติ session ทั้งหมดจาก localStorage
 * @returns {Array<Object>}
 */
export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? safeJsonParse(raw, []) : [];
  } catch {
    return [];
  }
}

/**
 * ล้างประวัติทั้งหมด (เผื่อทำปุ่ม reset ในหน้า stats)
 */
export function clearSessions() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}