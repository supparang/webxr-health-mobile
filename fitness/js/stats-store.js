// === /fitness/js/stats-store.js — Local summary store for VR Fitness (PATCH 2026-01-27) ===
'use strict';

const KEY = 'vrfitness_stats_v1';
const MAX = 100;

function safeParse(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
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
    const item = {
      gameId: String(gameId),
      ts: now,
      ...(summary && typeof summary === 'object' ? summary : {})
    };

    const raw = localStorage.getItem(KEY);
    const list = raw ? safeParse(raw) : [];
    list.unshift(item);

    // กันข้อมูลพัง/ใหญ่เกิน: เก็บล่าสุด MAX รายการ
    const trimmed = list.slice(0, MAX);
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
    return raw ? safeParse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * ล้างสถิติทั้งหมด (ใช้ตอน debug)
 */
export function clearSessions() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/**
 * ดึง session ล่าสุดของเกมที่กำหนด
 * @param {string} gameId
 * @returns {Object|null}
 */
export function getLatestSession(gameId) {
  const list = loadSessions();
  const gid = String(gameId || '');
  for (const it of list) {
    if (it && it.gameId === gid) return it;
  }
  return null;
}