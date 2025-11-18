// js/config-shadow.js
'use strict';

export const DifficultyConfigs = {
  easy: {
    name: 'easy',
    durationMs: 60000,
    spawnIntervalMs: 900,
    targetLifetimeMs: 1200,
    maxConcurrent: 3,
    decoyChance: 0.15,
    scorePerHit: 10,
    penaltyDecoy: 5
  },
  normal: {
    name: 'normal',
    durationMs: 60000,
    spawnIntervalMs: 650,
    targetLifetimeMs: 900,
    maxConcurrent: 4,
    decoyChance: 0.25,
    scorePerHit: 10,
    penaltyDecoy: 7
  },
  hard: {
    name: 'hard',
    durationMs: 60000,
    spawnIntervalMs: 480,
    targetLifetimeMs: 750,
    maxConcurrent: 5,
    decoyChance: 0.35,
    scorePerHit: 12,
    penaltyDecoy: 10
  }
};

export function pickConfigShadow(key) {
  return DifficultyConfigs[key] || DifficultyConfigs.normal;
}
