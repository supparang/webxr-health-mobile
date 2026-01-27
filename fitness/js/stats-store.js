// === /fitness/js/stats-store.js — Local summary store for VR Fitness (PATCH 2026-01-27) ===
'use strict';

const KEY = 'vrfitness_stats_v1';
const MAX_KEEP = 100;

function safeParse(raw, fallback) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

/**
 * บันทึก summary ของ 1 session ลง localStorage
 * @param {string} gameId  เช่น 'shadow-breaker'
 * @param {Object} summary ข้อมูลสรุป session จาก engine
 */
export function recordSession(gameId, summary) {
  try {
    const now = Date.now();
    const item = { gameId, ts: now, ...summary };

    const raw = localStorage.getItem(KEY);
    const list = safeParse(raw, []);

    list.unshift(item);
    const trimmed = list.slice(0, MAX_KEEP); // เก็บสูงสุด 100 รอบล่าสุด

    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('VRFitness: cannot save stats', e);
  }
}

/**
 * โหลดประวัติ session ทั้งหมดจาก localStorage
 * @returns {Array}
 */
export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    return safeParse(raw, []);
  } catch {
    return [];
  }
}

/**
 * (เสริม) ล้างประวัติทั้งหมด
 */
export function clearSessions() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    console.warn('VRFitness: cannot clear stats', e);
  }
}