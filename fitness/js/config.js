// fitness/js/config.js
// Shadow Breaker — Difficulty & spawn config (2025-11-19)
'use strict';

/**
 * config นี้ใช้เป็น “ปุ่มหมุน” หลักสำหรับปรับ:
 * - ระยะเวลาเล่น (durationMs)
 * - ความถี่เป้าเกิด (spawnIntervalMs)
 * - เป้าอยู่ได้นานแค่ไหน (targetLifetimeMs)
 * - จำนวนเป้าพร้อมกันบนจอ (maxConcurrent)
 * - อัตราเป้าหลอก (decoyChance)
 * - คะแนนต่อเป้าจริง (scorePerHit)
 * - โทษเมื่อกดเป้าหลอก (penaltyDecoy)
 * - ขนาดเป้า (targetSizePx) → renderer ใช้
 *
 * หมายเหตุ:
 *  - Engine จะอ่านค่าเหล่านี้ผ่าน pickConfig()
 *  - ถ้าเพิ่ม key เพิ่มเติม Engine ไม่ใช้ก็ไม่พัง (ignore)
 */

export const DifficultyConfigs = {
  easy: {
    name: 'easy',

    // เล่น 60 วินาที
    durationMs: 60000,

    // เป้าเกิดช้าสุด → ให้เด็ก ป.5 เล่นได้สบาย
    spawnIntervalMs: 900,   // ms ระหว่างเป้า

    // เป้าอยู่บนจอนานขึ้น หน่วงเวลาเด็กคิด
    targetLifetimeMs: 1300,

    // ไม่ให้เป้าเยอะเกิน 3 ลูกพร้อมกัน
    maxConcurrent: 3,

    // เป้าหลอกน้อยหน่อย
    decoyChance: 0.12,

    // คะแนนต่อ hit
    scorePerHit: 10,

    // โทษเมื่อกดเป้าหลอก
    penaltyDecoy: 5,

    // ขนาดเป้าใหญ่สุด → เล่นง่าย
    targetSizePx: 120
  },

  normal: {
    name: 'normal',

    durationMs: 60000,

    // ค่อนข้างเร็ว แต่ยังเล่นได้
    spawnIntervalMs: 650,
    targetLifetimeMs: 1000,
    maxConcurrent: 4,

    decoyChance: 0.22,
    scorePerHit: 10,
    penaltyDecoy: 7,

    // ขนาดเป้ากลาง ๆ
    targetSizePx: 104
  },

  hard: {
    name: 'hard',

    durationMs: 60000,

    // เร็วสุด
    spawnIntervalMs: 480,
    targetLifetimeMs: 850,
    maxConcurrent: 5,

    // เป้าหลอกเยอะขึ้น
    decoyChance: 0.32,
    scorePerHit: 12,
    penaltyDecoy: 10,

    // เป้าเล็กสุด → ท้าทายสาย reaction
    targetSizePx: 92
  }
};

/**
 * ใช้ใน main-shadow.js:
 *   const diffConfig = pickConfig(currentDiffKey);
 */
export function pickConfig(key) {
  return DifficultyConfigs[key] || DifficultyConfigs.normal;
}