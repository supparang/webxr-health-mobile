// js/config.js
'use strict';

// กำหนดชุดบอสพื้นฐาน (ชื่อ + emoji)
const BASE_BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣' },
  { name: 'Thunder Paw',  emoji: '🐯' },
  { name: 'Shadow King',  emoji: '🐉' },
  { name: 'Star Titan',   emoji: '🤖' }
];

// helper สร้าง list บอสจาก HP แต่ละระดับ
function makeBosses(hpList){
  return BASE_BOSSES.map((b, i)=>({
    name:  b.name,
    emoji: b.emoji,
    hp:    hpList[i] || hpList[hpList.length-1]
  }));
}

/**
 * จำนวน hit โดยประมาณ (ไม่รวม FEVER)
 * - easy:   10 / 20 / 32 / 46
 * - normal: 16 / 30 / 48 / 72
 * - hard:   22 / 38 / 60 / 96   ← บอสตัวหลัง ๆ หนักกว่านี้ชัดเจน
 */
export const DifficultyConfigs = {
  easy: {
    name: 'easy',
    durationMs: 60000,      // 60s
    spawnIntervalMs: 900,   // ช้าสุด
    targetLifetimeMs: 1200,
    maxConcurrent: 3,
    decoyChance: 0.15,
    scorePerHit: 10,
    penaltyDecoy: 5,

    // ขนาด/ระยะห่างเป้า (DOM)
    targetSizePx: 80,
    minDistancePct: 20,

    // ปรับความถี่ให้เร็วขึ้นตามเวลา (0–1)
    speedupFactor: 0.35,

    // HP บอสเรียงจากง่าย → ยาก
    bosses: makeBosses([10, 20, 32, 46])
  },
  normal: {
    name: 'normal',
    durationMs: 60000,
    spawnIntervalMs: 650,
    targetLifetimeMs: 900,
    maxConcurrent: 4,
    decoyChance: 0.25,
    scorePerHit: 10,
    penaltyDecoy: 7,

    targetSizePx: 70,
    minDistancePct: 18,
    speedupFactor: 0.5,

    // บอสกลางเกมเริ่มหนัก และตัวสุดท้ายโหดขึ้น
    bosses: makeBosses([16, 30, 48, 72])
  },
  hard: {
    name: 'hard',
    durationMs: 60000,
    spawnIntervalMs: 480,
    targetLifetimeMs: 750,
    maxConcurrent: 5,
    decoyChance: 0.35,
    scorePerHit: 12,
    penaltyDecoy: 10,

    targetSizePx: 60,
    minDistancePct: 16,
    speedupFactor: 0.65,

    // บอส 3–4 หนักมาก ต้องตีหลาย hit (เหมาะโหมดฝึกจริงจัง)
  easy:   bosses: makeBosses([12, 20, 30, 42]),
  normal: bosses: makeBosses([18, 30, 45, 70]),
  hard:   bosses: makeBosses([24, 38, 60, 90]),  }
  };

export function pickConfig(key) {
  return DifficultyConfigs[key] || DifficultyConfigs.normal;
}
