// vr-groups/difficulty.js
// ตารางตั้งค่าความยากของ Food Groups VR

(function (ns) {
  'use strict';

  const TABLE = {
    easy: {
      label: 'ง่าย',
      spawnInterval: 1300,   // ms ระยะห่างระหว่างการเกิดเป้า
      targetLifetime: 2600,  // ms เป้าอยู่ได้นาน → ง่าย
      maxActive: 4,          // จำนวนเป้าพร้อมกันบนจอ
      duration: 60000,       // ระยะเวลาเล่นต่อรอบ (ms)
      targetRadius: 0.58     // ขนาดเป้าใหญ่สุด
    },
    normal: {
      label: 'ปกติ',
      spawnInterval: 900,
      targetLifetime: 2100,
      maxActive: 5,
      duration: 60000,
      targetRadius: 0.50
    },
    hard: {
      label: 'ท้าทาย',
      spawnInterval: 650,
      targetLifetime: 1700,  // เป้าหายไว
      maxActive: 6,          // เป้าเยอะ
      duration: 60000,
      targetRadius: 0.42     // เป้าเล็กสุด
    }
  };

  const api = {
    get(diff) {
      diff = (diff || 'normal').toLowerCase();
      return TABLE[diff] || TABLE.normal;
    },
    debugTable() {
      return JSON.parse(JSON.stringify(TABLE));
    }
  };

  ns.foodGroupsDifficulty = api;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));