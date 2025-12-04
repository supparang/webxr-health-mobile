// === /herohealth/vr-groups/difficulty.js ===
// Food Groups VR Difficulty Table (2025-12-06)

(function (ns) {
  'use strict';

  const TABLE = {
    easy: {
      spawnInterval: 1400,
      fallSpeed: 0.011,
      scale: 1.35,
      maxActive: 3,
      goodRatio: 0.85,
      quest: { goalsPick: 2, miniPick: 3 }
    },

    normal: {
      spawnInterval: 1100,
      fallSpeed: 0.014,
      scale: 1.15,
      maxActive: 4,
      goodRatio: 0.72,
      quest: { goalsPick: 2, miniPick: 3 }
    },

    hard: {
      spawnInterval: 850,
      fallSpeed: 0.018,
      scale: 1.0,
      maxActive: 5,
      goodRatio: 0.55,
      quest: { goalsPick: 2, miniPick: 3 }
    }
  };

  function get(diff) {
    diff = String(diff || 'normal').toLowerCase();
    return TABLE[diff] || TABLE.normal;
  }

  ns.foodGroupsDifficulty = { get, TABLE };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));