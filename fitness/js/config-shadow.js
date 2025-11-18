// js/config-shadow.js
'use strict';

// กำหนดชุดบอสพื้นฐาน (ชื่อ + emoji) แล้วปรับ HP ตามระดับความยาก
const BASE_BOSSES = [
  { name: 'Bubble Glove',   emoji: '🐣' },
  { name: 'Thunder Paw',    emoji: '🐯' },
  { name: 'Shadow King',    emoji: '🐉' },
  { name: 'Star Titan',     emoji: '🤖' }
];

// helper สร้าง list บอสตาม HP ที่ต้องการ
function makeBosses(hpList){
  return BASE_BOSSES.map((b, i)=>({
    name: b.name,
    emoji: b.emoji,
    hp: hpList[i] || hpList[hpList.length-1]
  }));
}

/**
 * idea จำนวน hit โดยประมาณ (non-fever):
 * - easy:    ~10 / 14 / 18 / 22
 * - normal:  ~15 / 22 / 30 / 38
 * - hard:    ~20 / 30 / 42 / 56
 */
export const DifficultyConfigs = {
  easy: {
    name: 'easy',
    durationMs: 60000,
    spawnIntervalMs: 900,
    targetLifetimeMs: 1300,
    maxConcurrent: 3,
    decoyChance: 0.15,
    scorePerHit: 10,
    penaltyDecoy: 5,
    targetSizePx: 80,
    minDistancePct: 20,
    speedupFactor: 0.35,
    bosses: makeBosses([10, 14, 18, 22])
  },
  normal: {
    name: 'normal',
    durationMs: 60000,
    spawnIntervalMs: 700,
    targetLifetimeMs: 1000,
    maxConcurrent: 4,
    decoyChance: 0.25,
    scorePerHit: 10,
    penaltyDecoy: 7,
    targetSizePx: 70,
    minDistancePct: 18,
    speedupFactor: 0.5,
    bosses: makeBosses([15, 22, 30, 38])
  },
  hard: {
    name: 'hard',
    durationMs: 60000,
    spawnIntervalMs: 520,
    targetLifetimeMs: 850,
    maxConcurrent: 5,
    decoyChance: 0.35,
    scorePerHit: 12,
    penaltyDecoy: 10,
    targetSizePx: 60,
    minDistancePct: 16,
    speedupFactor: 0.65,
    bosses: makeBosses([20, 30, 42, 56])
  }
};

export function pickConfigShadow(key) {
  return DifficultyConfigs[key] || DifficultyConfigs.normal;
}
