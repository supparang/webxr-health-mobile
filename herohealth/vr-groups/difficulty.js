// === /herohealth/vr-groups/difficulty.js ===
// Food Groups VR — Difficulty table (Hydration-style tuning)
// 2025-12-06

(function (root) {
  'use strict';

  const TABLE = {
    easy: {
      // ช้า เป้าใหญ่ จำนวนไม่เยอะ
      spawnInterval: 1400,
      fallSpeed: 0.007,
      scale: 1.35,
      maxActive: 3,
      goodRatio: 0.8,
      quest: { goalsPick: 2, miniPick: 3 }
    },
    normal: {
      // ค่า default ใกล้ Hydration โหมดปกติ
      spawnInterval: 1100,
      fallSpeed: 0.009,
      scale: 1.15,
      maxActive: 4,
      goodRatio: 0.75,
      quest: { goalsPick: 2, miniPick: 3 }
    },
    hard: {
      // เร็ว เป้าเล็กขึ้น และมีเป้าพร้อมกันมากขึ้น
      spawnInterval: 850,
      fallSpeed: 0.011,
      scale: 1.0,
      maxActive: 5,
      goodRatio: 0.7,
      quest: { goalsPick: 3, miniPick: 4 }
    }
  };

  function get(diffKey) {
    const k = String(diffKey || 'normal').toLowerCase();
    return TABLE[k] || TABLE.normal;
  }

  const mod = { TABLE, get };

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.foodGroupsDifficulty = mod;

})(window);
