// === config-shadow.js — Bosses + Difficulty Factors (2025-11-19) ===
'use strict';

export const BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣' },
  { name: 'Neon Fist',    emoji: '🧤' },
  { name: 'Tempo Titan',  emoji: '🎵' },
  { name: 'Shadow King',  emoji: '👑' }
];

// ค่าเริ่มต้น Shadow Breaker
export function pickShadowConfig(diff = 'normal') {
  const base = {
    durationMs: 60000,
    targetLifeMs: 900,
    spawnInterval: 750,

    scoreHit: 10,
    hitRadius: 90,

    decoyChance: 0.18,

    hpMax: 100,
    hpMissPenalty: 4,

    bossCount: BOSSES.length,
    bossHPPerBoss: 100,
    bossDamagePerHit: 3,

    feverGainPerHit: 16,
    feverDecayPerSec: 10,
    feverThreshold: 100,
    feverDurationMs: 5000,

    bosses: BOSSES,
    emojiMain: '🥊',
    emojiDecoy: '💣'
  };

  if (diff === 'easy') {
    base.spawnInterval = 900;
    base.targetLifeMs = 1100;
    base.hitRadius = 115;
    base.decoyChance = 0.1;
  }

  if (diff === 'hard') {
    base.spawnInterval = 600;
    base.targetLifeMs = 750;
    base.hitRadius = 70;
    base.decoyChance = 0.25;
  }

  return base;
}
