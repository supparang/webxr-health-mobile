// === js/stats-store.js — LocalStorage stats helper (2025-12-04) ===
'use strict';

const KEY = 'vrfitness_stats_v1';

/**
 * บันทึก summary ของ session ลง localStorage
 * - gameId: string เช่น 'shadow-breaker'
 * - summary: object จาก engine (sessionSummary)
 */
export function recordSession(gameId, summary) {
  try {
    const now = Date.now();
    const item = {
      gameId,
      ts: now,
      ...summary
    };

    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];

    // ใส่รายการใหม่ไว้ด้านบนสุด
    list.unshift(item);

    // เก็บสูงสุด 200 รายการกัน localStorage โตเกิน
    if (list.length > 200) {
      list.length = 200;
    }

    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[stats-store] cannot save stats', e);
  }
}

/**
 * ดึง history ของทุกเกม (ถ้ามี)
 * return: array ของ item { gameId, ts, ...summary }
 */
export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('[stats-store] cannot load stats', e);
    return [];
  }
}
