// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// GoodJunk — Goal + Mini definitions (H++ Pack)

'use strict';

// GOALS (ใช้เดิมได้เลย หรือปรับข้อความตามที่คุณชอบ)
export const GOODJUNK_GOALS = [
  {
    id: 'G1_SCORE',
    title: 'ทำคะแนนให้ถึงเป้าหมาย',
    type: 'scoreAtLeast',
    byDiff: { easy: 380, normal: 520, hard: 680 }
  },
  {
    id: 'G2_GOODHIT',
    title: 'เก็บ “ของดี” ให้ครบตามจำนวน',
    type: 'goodHitsAtLeast',
    byDiff: { easy: 18, normal: 22, hard: 26 }
  }
];

// MINIS (สุ่ม/ต่อเนื่อง)
// NOTE: quest-director จะอ่าน `type` แล้วไปตรวจเงื่อนไขจาก state
export const GOODJUNK_MINIS = [
  {
    id: 'M1_STREAK',
    title: 'เก็บของดีติดกัน (ห้าม MISS)',
    type: 'streakGood',
    byDiff: { easy: 6, normal: 8, hard: 10 }
  },
  {
    id: 'M2_GOLD',
    title: 'หา “ทอง” ให้เจอ',
    type: 'goldHitOnce',
    byDiff: { easy: 1, normal: 1, hard: 1 }
  },
  {
    id: 'M3_BLOCK',
    title: 'บล็อกด้วยโล่ (Shield) ให้ได้',
    type: 'blocksAtLeast',
    byDiff: { easy: 1, normal: 1, hard: 2 }
  },

  // ✅ NEW: Hazard Master (โหด)
  // รอด hazard ต่อเนื่อง 3 ครั้ง (Ring/Laser นับได้หมด)
  {
    id: 'M4_HAZARD_MASTER',
    title: 'Hazard Master — รอด Ring/Laser 3 ครั้งติด (ห้ามโดน)',
    type: 'hazardsSurviveStreak',
    byDiff: { easy: 3, normal: 3, hard: 3 }
  },

  // ✅ NEW: Boss Rage Finisher
  // เคลียร์บอส (หรือผ่าน Rage window โดยไม่ตาย/ไม่โดนเกินที่กำหนด)
  {
    id: 'M5_RAGE_FINISH',
    title: 'Rage Finisher — ช่วงบอสคลั่ง เก็บของดีให้ได้',
    type: 'finalRageGoodHits',
    byDiff: { easy: 4, normal: 5, hard: 6 }
  }
];