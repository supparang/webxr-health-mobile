// vr-groups/difficulty.js
(function (ns) {
  'use strict';

  const TABLE = {
    easy: {
      spawnInterval: 1400,     // ศัตรูออกช้าหน่อย
      targetLifetime: 2800,    // อยู่บนจอนาน
      maxActive: 4,
      duration: 60000,
      targetRadius: 0.6        // 🎯 เป้าใหญ่สุด
    },
    normal: {
      spawnInterval: 1100,
      targetLifetime: 2300,
      maxActive: 5,
      duration: 60000,
      targetRadius: 0.5        // 🎯 กลาง ๆ
    },
    hard: {
      spawnInterval: 900,
      targetLifetime: 2000,
      maxActive: 6,
      duration: 60000,
      targetRadius: 0.42       // 🎯 เล็กลง ท้าทายขึ้น
    }
  };

  ns.foodGroupsDifficulty = {
    get(diff) {
      diff = (diff || 'normal').toLowerCase();
      return TABLE[diff] || TABLE.normal;
    }
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
