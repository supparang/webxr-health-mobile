// === fitness/js/config.js (Shadow Breaker difficulty + bosses) ===
'use strict';

// รายชื่อบอส 4 ตัว (ชื่อ + emoji)
const BOSSES = [
  { name: 'Bubble Glove', emoji: '🐣' },
  { name: 'Neon Fist',    emoji: '🧤' },
  { name: 'Tempo Titan',  emoji: '🎵' },
  { name: 'Shadow King',  emoji: '👑' }
];

function baseConfig() {
  return {
    emojiMain:  '🥊',
    emojiDecoy: '💣',
    bosses: BOSSES
  };
}

const DIFF = {
  easy: {
    name: 'easy',
    // เล่นสบาย เป้าใหญ่ ตกช้า decoy น้อย
    durationMs:    60000,
    spawnInterval: 900,
    targetLifeMs:  1200,
    targetSizePx:  120,
    hitRadius:     120,
    decoyChance:   0.06,
    bossHPPerBoss: 80
  },
  normal: {
    name: 'normal',
    durationMs:    60000,
    spawnInterval: 750,
    targetLifeMs:  900,
    targetSizePx:  96,
    hitRadius:     96,
    decoyChance:   0.14,
    bossHPPerBoss: 100
  },
  hard: {
    name: 'hard',
    durationMs:    60000,
    spawnInterval: 600,
    targetLifeMs:  750,
    targetSizePx:  78,
    hitRadius:     78,
    decoyChance:   0.22,
    bossHPPerBoss: 120
  }
};

export function pickConfig(key = 'normal') {
  const k = DIFF[key] ? key : 'normal';
  return {
    ...baseConfig(),
    ...DIFF[k]
  };
}
