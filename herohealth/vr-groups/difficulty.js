// vr-groups/difficulty.js
(function (ns) {
  'use strict';

  // ปรับความยากให้แบบ “pop-up” (ไม่วิ่งเข้าใกล้กล้องแล้ว)
  const TABLE = {
    easy: {
      spawnInterval: 1100,   // ออกช้า
      targetLifetime: 2300,  // อยู่บนจอ ~2.3 วินาที
      maxActive: 4,          // บนจอไม่เกิน 4 เป้า
      duration: 60000        // เวลาเล่นรวม 60s
    },
    normal: {
      spawnInterval: 850,
      targetLifetime: 2000,
      maxActive: 5,
      duration: 70000
    },
    hard: {
      spawnInterval: 700,
      targetLifetime: 1700,
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
