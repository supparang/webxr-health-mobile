// vr-goodjunk/difficulty.js
(function (ns) {
  'use strict';

  const TABLE = {
    easy: {
      spawnInterval: 1400, // ms
      speed: 0.8,          // ช้าสุด
      duration: 60000      // 60s
    },
    normal: {
      spawnInterval: 1000,
      speed: 1.1,
      duration: 70000
    },
    hard: {
      spawnInterval: 750,
      speed: 1.4,
      duration: 80000
    }
  };

  ns.foodGroupsDifficulty = {
    get(diff) {
      return TABLE[diff] || TABLE.normal;
    }
  };
})(window.GAME_MODULES);
