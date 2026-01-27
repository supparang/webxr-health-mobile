// === /fitness/js/stats-store.js — Local summary store for VR Fitness (PATCH 2026-01-27) ===
'use strict';

const KEY = 'vrfitness_stats_v1';

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
    const list = raw ? JSON.parse(raw) : [];

    list.unshift(item);

    // เก็บสูงสุด 100 รอบล่าสุด
    const trimmed = list.slice(0, 100);
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
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}