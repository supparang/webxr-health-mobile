// js/config-shadow.js
'use strict';

// เพิ่ม boss list + ขนาดเป้า + speedup factor
const BOSSES = [
  { name: 'Iron Guard',   hp: 30 },
  { name: 'Crimson Fist', hp: 40 },
  { name: 'Shadow King',  hp: 50 },
  { name: 'Star Titan',   hp: 60 }
];

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
    bosses: BOSSES
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
    bosses: BOSSES
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
    bosses: BOSSES
  }
};

export function pickConfigShadow(key) {
  return DifficultyConfigs[key] || DifficultyConfigs.normal;
}
