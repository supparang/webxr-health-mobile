// vr-groups/difficulty.js
(function (ns) {
  'use strict';

  // ค่าความยาก 3 ระดับ สำหรับ Groups VR
  const TABLE = {
    easy: {
      // เด็กเล็ก / เริ่มฝึก
      spawnInterval: 1400,   // ms ระยะห่างการเกิดเป้า
      targetLifetime: 2600,  // ms เป้าอยู่ได้นานขึ้น
      maxActive: 4,          // เป้าสูงสุดบนจอ
      duration: 60000,       // 60 วินาที
      targetRadius: 0.6      // เป้าใหญ่
    },
    normal: {
      // โมดมาตรฐาน ใช้เก็บข้อมูลวิจัย
      spawnInterval: 1100,
      targetLifetime: 2300,
      maxActive: 5,
      duration: 60000,
      targetRadius: 0.5
    },
    hard: {
      // ท้าทาย เด็กเริ่มชินแล้ว
      spawnInterval: 850,
      targetLifetime: 2000,
      maxActive: 6,
      duration: 60000,
      targetRadius: 0.45
    }
  };

  ns.foodGroupsDifficulty = {
    get: function (diff) {
      diff = (diff || 'normal').toLowerCase();
      return TABLE[diff] || TABLE.normal;
    },
    table: TABLE
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));