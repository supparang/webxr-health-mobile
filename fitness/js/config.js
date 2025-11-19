// === config.js (2025-11-19 easier hit) ===
'use strict';

export function pickConfig(key) {
  const base = {
    durationMs: 60000,
    scoreHit: 10,
    emojiMain: '⭐',
    hitRadius: 88,   // เดิม 48-60 → เพิ่มให้แตะง่าย
    targetLifetime: 1500
  };

  const diff = {
    easy: {
      ...base,
      name: 'easy',
      spawnInterval: 900,
      targetSizePx: 90
    },
    normal: {
      ...base,
      name: 'normal',
      spawnInterval: 750,
      targetSizePx: 80
    },
    hard: {
      ...base,
      name: 'hard',
      spawnInterval: 620,
      targetSizePx: 72
    }
  };

  return diff[key] || diff.normal;
}