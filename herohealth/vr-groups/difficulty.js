// === /herohealth/vr-groups/difficulty.js ===
// Food Groups VR — Difficulty table (easy / normal / hard)
// ปรับขนาดเป้า (scale) + ความถี่ spawn ตามระดับ
// 2025-12-06

(function (ns) {
  'use strict';

  const TABLE = {
    easy: {
      engine: {
        spawnInterval: 1400,  // ช้าหน่อย
        fallSpeed: 0.0,       // ตอนนี้ยังไม่ตก
        maxActive: 3,
        scale: 1.3,           // เป้าใหญ่ที่สุด
        goodRatio: 0.8
      },
      quest: {
        goalsPick: 1,
        miniPick: 2
      }
    },
    normal: {
      engine: {
        spawnInterval: 1200,
        fallSpeed: 0.0,
        maxActive: 3,
        scale: 1.0,           // ขนาดปกติ
        goodRatio: 0.75
      },
      quest: {
        goalsPick: 2,
        miniPick: 3
      }
    },
    hard: {
      engine: {
        spawnInterval: 900,   // เร็วขึ้น
        fallSpeed: 0.0,
        maxActive: 4,
        scale: 0.8,           // เป้าเล็กสุด
        goodRatio: 0.7
      },
      quest: {
        goalsPick: 2,
        miniPick: 3
      }
    }
  };

  ns.foodGroupsDifficulty = {
    get: function (diffKey) {
      diffKey = String(diffKey || 'normal').toLowerCase();
      const row = TABLE[diffKey] || TABLE.normal;
      // คืนเฉพาะส่วน engine + quest รวมกัน เพื่อให้ GameEngine ใช้ง่าย
      return {
        spawnInterval: row.engine.spawnInterval,
        fallSpeed: row.engine.fallSpeed,
        maxActive: row.engine.maxActive,
        scale: row.engine.scale,
        goodRatio: row.engine.goodRatio,
        quest: row.quest
      };
    }
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));