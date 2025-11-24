// === fitness/js/shadow-config.js (Difficulty & Boss Phases — 2025-11-24) ===
'use strict';

/**
 * ตารางความยาก + ค่าที่ใช้สำหรับ Shadow Breaker
 * - target: ค่าพื้นฐานของการ spawn เป้า
 * - boss: ค่าพื้นฐานของบอส + threshold เปลี่ยน phase
 * - weights: น้ำหนักสุ่มเป้า (main = เป้าหลัก, fake = เป้าล่อ, bonus = คะแนน/ฮีล)
 */
export const SHADOW_DIFF_TABLE = {
  easy: {
    label: 'โหมดง่าย',
    target: {
      // phase 1 / 2 / 3
      spawnIntervalMs: [900, 800, 700],
      lifetimeMs:      [2400, 2200, 2000],
      maxActive:       [3,    4,    5],
      sizePx:          [110, 130],      // เป้าใหญ่ เหมาะเริ่มต้น
    },
    boss: {
      maxHP: 40,
      // HP ratio จากมากไปน้อย → น้อยกว่าค่านี้จะขึ้น phase ถัดไป
      phaseThresholds: [0.7, 0.35],     // ≤0.7 → phase 2, ≤0.35 → phase 3
      nearDeathPct: 0.25,               // ใกล้ตาย = HP ≤ 25%
      nearDeathBoost: {
        spawnIntervalFactor: 0.75,      // เร่งให้ spawn เร็วขึ้น
        maxActiveBonus: 1              // เพิ่มจำนวนเป้าได้สูงสุดอีก
      }
    },
    weights: {
      main:  78,
      fake:  10,
      bonus: 12
    }
  },

  normal: {
    label: 'โหมดปกติ',
    target: {
      spawnIntervalMs: [800, 700, 600],
      lifetimeMs:      [2200, 2000, 1800],
      maxActive:       [4,    5,    6],
      sizePx:          [90, 120],
    },
    boss: {
      maxHP: 60,
      phaseThresholds: [0.75, 0.40],
      nearDeathPct: 0.25,
      nearDeathBoost: {
        spawnIntervalFactor: 0.70,
        maxActiveBonus: 1
      }
    },
    weights: {
      main:  70,
      fake:  18,
      bonus: 12
    }
  },

  hard: {
    label: 'โหมดยาก',
    target: {
      spawnIntervalMs: [700, 600, 520],
      lifetimeMs:      [2000, 1800, 1600],
      maxActive:       [5,    6,    7],
      sizePx:          [80, 110],
    },
    boss: {
      maxHP: 80,
      phaseThresholds: [0.80, 0.45],
      nearDeathPct: 0.30,
      nearDeathBoost: {
        spawnIntervalFactor: 0.65,
        maxActiveBonus: 2
      }
    },
    weights: {
      main:  64,
      fake:  24,
      bonus: 12
    }
  }
};

/**
 * คำนวณ phase, spawn speed, lifetime, maxActive, weights
 * จาก difficulty + bossHpRatio (0–1)
 */
export function computeShadowSpawnParams(diffKey, bossHpRatio) {
  const cfg = SHADOW_DIFF_TABLE[diffKey] || SHADOW_DIFF_TABLE.normal;
  const t   = cfg.target;
  const b   = cfg.boss;

  // 1) หาว่าอยู่ phase ไหน
  let phase = 1;
  if (bossHpRatio <= b.phaseThresholds[1]) phase = 3;
  else if (bossHpRatio <= b.phaseThresholds[0]) phase = 2;

  const idx = phase - 1;

  let spawnInterval = t.spawnIntervalMs[idx];
  let lifetime      = t.lifetimeMs[idx];
  let maxActive     = t.maxActive[idx];

  // 2) near-death boost
  const nearDeath = bossHpRatio <= b.nearDeathPct;
  if (nearDeath) {
    spawnInterval = Math.round(spawnInterval * b.nearDeathBoost.spawnIntervalFactor);
    maxActive    += b.nearDeathBoost.maxActiveBonus;
  }

  return {
    phase,
    nearDeath,
    spawnInterval,
    lifetime,
    maxActive,
    sizePx: t.sizePx,
    weights: cfg.weights,
    bossMaxHP: b.maxHP
  };
}

/**
 * ตัวช่วยจัดการ HP ของบอส
 */
export class ShadowBossState {
  constructor(diffKey) {
    const cfg = SHADOW_DIFF_TABLE[diffKey] || SHADOW_DIFF_TABLE.normal;
    this.diffKey = diffKey;
    this.maxHP   = cfg.boss.maxHP;
    this.hp      = this.maxHP;
    this.phase   = 1;
    this.nearDeath = false;
  }

  /**
   * โดนดาเมจ
   * @returns {Object} { hp, ratio, phase, phaseChanged, nearDeath, nearDeathChanged }
   */
  hit(dmg) {
    const prevPhase     = this.phase;
    const prevNearDeath = this.nearDeath;

    this.hp = Math.max(0, this.hp - Math.max(1, dmg | 0));
    const ratio = this.maxHP > 0 ? (this.hp / this.maxHP) : 0;

    // อัปเดต phase ตาม HP ratio
    const cfg = SHADOW_DIFF_TABLE[this.diffKey] || SHADOW_DIFF_TABLE.normal;
    const b   = cfg.boss;

    if (ratio <= b.phaseThresholds[1]) this.phase = 3;
    else if (ratio <= b.phaseThresholds[0]) this.phase = 2;
    else this.phase = 1;

    this.nearDeath = ratio <= b.nearDeathPct;

    return {
      hp: this.hp,
      ratio,
      phase: this.phase,
      phaseChanged: this.phase !== prevPhase,
      nearDeath: this.nearDeath,
      nearDeathChanged: this.nearDeath !== prevNearDeath
    };
  }
}
