// === /herohealth/vr-groups/difficulty.js ===
// Food Groups VR Difficulty table (non-module, global)
// 2025-12-06

(function (root) {
  'use strict';

  const TABLE = {
    easy: {
      spawnInterval: 1500,
      fallSpeed: 0.009,
      scale: 1.25,
      maxActive: 3,
      goodRatio: 0.8,
      quest: { goalsPick: 2, miniPick: 3 }
    },
    normal: {
      spawnInterval: 1200,
      fallSpeed: 0.011,
      scale: 1.0,
      maxActive: 4,
      goodRatio: 0.75,
      quest: { goalsPick: 2, miniPick: 3 }
    },
    hard: {
      spawnInterval: 900,
      fallSpeed: 0.013,
      scale: 0.85,
      maxActive: 5,
      goodRatio: 0.7,
      quest: { goalsPick: 3, miniPick: 4 }
    }
  };

  function get(diffKey) {
    const k = String(diffKey || 'normal').toLowerCase();
    return TABLE[k] || TABLE.normal;
  }

  const mod = {
    TABLE,
    get
  };

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.foodGroupsDifficulty = mod;

})(window);
