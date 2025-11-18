// fitness/js/config.js
'use strict';

// ตั้งค่าระดับความยาก + บอส + speed
// ปรับแบบ “เล่นจริงได้” แต่ยังจูนละเอียดได้อีกภายหลังจากการเทสต์จริง

export const DifficultyConfigs = {
  easy: {
    name: 'easy',
    durationMs: 60000,        // เล่น 60 วินาที
    spawnIntervalMs: 900,     // เป้าขึ้นช้า
    targetLifetimeMs: 1200,   // อยู่บนจอนาน
    maxConcurrent: 3,
    decoyChance: 0.12,
    scorePerHit: 10,
    penaltyDecoy: 5,

    targetSizePx: 80,
    minDistancePct: 20,
    speedupFactor: 0.15,

    // บอส: ตัวหลังยากขึ้นทีละนิด
    bosses: [
      { name: 'Bubble Glove',  emoji: '🐣', hp: 18 },
      { name: 'Thunder Paw',   emoji: '🐯', hp: 24 },
      { name: 'Shadow Ghost',  emoji: '👻', hp: 30 },
      { name: 'Cyber Titan',   emoji: '🤖', hp: 36 }
    ]
  },

  normal: {
    name: 'normal',
    durationMs: 60000,
    spawnIntervalMs: 650,
    targetLifetimeMs: 900,
    maxConcurrent: 4,
    decoyChance: 0.22,
    scorePerHit: 10,
    penaltyDecoy: 7,

    targetSizePx: 70,
    minDistancePct: 18,
    speedupFactor: 0.20,

    // บอสโหดขึ้นชัดเจน ตัวท้ายโหดสุด
    bosses: [
      { name: 'Bubble Glove',  emoji: '🐣', hp: 24 },
      { name: 'Thunder Paw',   emoji: '🐯', hp: 34 },
      { name: 'Shadow King',   emoji: '🐉', hp: 44 },
      { name: 'Star Titan',    emoji: '🤖', hp: 56 }
    ]
  },

  hard: {
    name: 'hard',
    durationMs: 60000,
    spawnIntervalMs: 480,
    targetLifetimeMs: 750,
    maxConcurrent: 5,
    decoyChance: 0.30,
    scorePerHit: 12,
    penaltyDecoy: 10,

    targetSizePx: 60,
    minDistancePct: 16,
    speedupFactor: 0.26,

    // สำหรับสายจริงจัง: ต้องตีเยอะมากกว่าจะล้มบอสท้าย ๆ
    bosses: [
      { name: 'Bubble Glove',  emoji: '🐣', hp: 32 },
      { name: 'Thunder Paw',   emoji: '🐯', hp: 46 },
      { name: 'Shadow King',   emoji: '🐉', hp: 60 },
      { name: 'Star Titan',    emoji: '🤖', hp: 80 }
    ]
  }
};

export function pickConfig(key) {
  return DifficultyConfigs[key] || DifficultyConfigs.normal;
}
