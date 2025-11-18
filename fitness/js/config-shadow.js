// js/config-shadow.js
'use strict';

// เพิ่ม targetSizePx, minDistancePct, speedupFactor ต่อระดับความยาก
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
    targetSizePx: 80,      // เป้าใหญ่สุด
    minDistancePct: 20,    // กันเป้าชนกัน
    speedupFactor: 0.35    // เร่งความถี่เล็กน้อยเมื่อใกล้หมดเวลา
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
    speedupFactor: 0.5
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
    targetSizePx: 60,     // เป้าเล็กสุด
    minDistancePct: 16,
    speedupFactor: 0.65   // ยิ่งเล่นไปยิ่งถี่
  }
};

export function pickConfigShadow(key) {
  return DifficultyConfigs[key] || DifficultyConfigs.normal;
}
