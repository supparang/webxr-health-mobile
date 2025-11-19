// === fitness/js/config.js — Shadow Breaker difficulty & boss config (2025-11-19) ===
'use strict';

const BOSSES = [
  { name: 'Bubble Glove', emoji: '🫧', final: false },
  { name: 'Metal Mitt',   emoji: '🤖', final: false },
  { name: 'Shadow Paw',   emoji: '🐾', final: false },
  { name: 'Star Fury',    emoji: '🌟', final: true  }
];

export function pickConfig(diffKey) {
  const base = {
    durationMs: 60000,
    targetLifeMs: 900,
    bossHPPerBoss: 120,
    bossList: BOSSES,
    bossCount: BOSSES.length,
    decoyChance: 0.18,
    phase2SpawnFactor: 0.9,
    phase3SpawnFactor: 0.75,
    finalBossSpawnFactor: 0.85
  };

  switch (diffKey) {
    case 'easy':
      return {
        ...base,
        name: 'easy',
        spawnInterval: 900,
        scoreHit: 10,
        hpMissPenalty: 3,
        hitRadius: 120,         // วงตีใหญ่มาก
        targetSizePx: 110,      // ★ เป้าใหญ่สุด
        emojiMain: '🥊',
        emojiDecoy: '💣'
      };
    case 'hard':
      return {
        ...base,
        name: 'hard',
        spawnInterval: 650,
        scoreHit: 14,
        hpMissPenalty: 6,
        hitRadius: 80,          // วงตีเล็ก
        targetSizePx: 70,       // ★ เป้าเล็กสุด
        emojiMain: '💥',
        emojiDecoy: '💣'
      };
    case 'normal':
    default:
      return {
        ...base,
        name: 'normal',
        spawnInterval: 780,
        scoreHit: 12,
        hpMissPenalty: 4,
        hitRadius: 95,          // กลาง ๆ
        targetSizePx: 90,       // ★ ขนาดกลาง
        emojiMain: '🥊',
        emojiDecoy: '💣'
      };
  }
}
