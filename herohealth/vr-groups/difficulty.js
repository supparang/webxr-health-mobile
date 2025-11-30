// vr-groups/difficulty.js
(function (ns) {
  'use strict';

  // ปรับความยากแบบ pop-up: เป้าโผล่มาอยู่แป๊บเดียวแล้วหาย
  const TABLE = {
    easy: {
      spawnInterval: 1300,   // ms ระยะห่างการออกเป้า
      targetLifetime: 2600,  // ms ระยะเวลาที่เป้าอยู่
      maxActive: 4,
      duration: 60000        // เวลาเล่นรวม 60s
    },
    normal: {
      spawnInterval: 1000,
      targetLifetime: 2200,
      maxActive: 5,
      duration: 70000
    },
    hard: {
      spawnInterval: 800,
      targetLifetime: 1800,
      maxActive: 6,
      duration: 80000
    }
  };

  ns.foodGroupsDifficulty = {
    get(diff) {
      return TABLE[diff] || TABLE.normal;
    }
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
