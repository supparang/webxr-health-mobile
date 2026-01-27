// === /fitness/js/stats-store.js — Local summary store for VR Fitness (PATCH 2026-01-27) ===
'use strict';

const KEY = 'vrfitness_stats_v1';
const MAX_KEEP = 100;

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
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

    // ✅ กัน summary ทับฟิลด์หลัก (โดยเฉพาะ ts)
    const s = (summary && typeof summary === 'object') ? { ...summary } : {};
    delete s.gameId;
    delete s.ts;          // กัน ts จาก engine มาทับ
    delete s.timestamp;   // กันชื่ออื่น ๆ ที่อาจมี

    const item = {
      gameId: String(gameId),
      ts: now, // ✅ authoritative timestamp
      // normalize ตัวเลขที่ใช้โชว์บ่อย (ไม่บังคับ แต่ช่วยให้ stats.html อ่านง่าย)
      score: safeNumber(s.score, safeNumber(s.final_score, 0)),
      accuracy_pct: (s.accuracy_pct != null) ? safeNumber(s.accuracy_pct, 0) : undefined,
      grade: (s.grade != null) ? String(s.grade) : undefined,
      bosses_cleared: (s.bosses_cleared != null) ? safeNumber(s.bosses_cleared, 0) : undefined,
      duration_s: (s.duration_s != null) ? safeNumber(s.duration_s, 0) : undefined,
      diff: (s.diff != null) ? String(s.diff) : (s.difficulty != null ? String(s.difficulty) : undefined),

      // ✅ เก็บฟิลด์อื่น ๆ ต่อท้าย (ยังใช้วิเคราะห์ได้)
      ...s
    };

    const raw = localStorage.getItem(KEY);
    const list = safeParse(raw, []);
    const next = Array.isArray(list) ? list : [];

    next.unshift(item);

    // ✅ dedupe กันกรณีคลิกซ้ำเร็ว ๆ (gameId + ts ใกล้กัน)
    const deduped = [];
    const seen = new Set();
    for (const it of next) {
      const k = `${it.gameId}|${Math.floor((it.ts || 0) / 1000)}|${it.session_id || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(it);
      if (deduped.length >= MAX_KEEP) break;
    }

    localStorage.setItem(KEY, JSON.stringify(deduped));
  } catch (e) {
    console.warn('VRFitness: cannot save stats', e);
  }
}

/**
 * โหลดประวัติ session ทั้งหมดจาก localStorage
 */
export function loadSessions() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = safeParse(raw, []);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * ล้างประวัติทั้งหมด (ไว้ใช้ใน stats.html)
 */
export function clearSessions() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}