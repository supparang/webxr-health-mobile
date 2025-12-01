// vr-groups/difficulty.js
// ตารางความยากของ Food Groups VR

(function (ns) {
  'use strict';

  const TABLE = {
    easy: {
      spawnInterval: 1200,   // ms ระยะห่างการเกิดเป้า
      targetLifetime: 2600,  // ms เป้าอยู่ค้างบนจอ
      maxActive: 4,          // จำนวนเป้าพร้อมกัน
      duration: 60000,       // ยาว ~60 วินาที
      targetRadius: 0.6      // ขนาดเป้าใหญ่ (เล็งง่ายสุด)
    },
    normal: {
      spawnInterval: 950,
      targetLifetime: 2200,
      maxActive: 5,
      duration: 60000,
      targetRadius: 0.5
    },
    hard: {
      spawnInterval: 750,
      targetLifetime: 2000,
      maxActive: 6,
      duration: 60000,
      targetRadius: 0.42    // เป้าเล็กสุด
    }
  };

  ns.foodGroupsDifficulty = {
    get: function (diff) {
      diff = (diff || 'normal').toLowerCase();
      return TABLE[diff] || TABLE.normal;
    },
    all: TABLE
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
