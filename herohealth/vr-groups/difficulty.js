// === /herohealth/vr-groups/difficulty.js ===
// Production Ready — Food Groups VR Difficulty Table
// 2025-12-05

(function (ns) {
  'use strict';

  /**
   * ค่าที่ส่งออกให้ GameEngine.js ใช้
   * spawnInterval → ms (ยิ่งน้อยยิ่งเร็ว)
   * fallSpeed     → ความเร็วตก
   * scale         → ขนาดเป้า
   * maxActive     → จำนวนเป้าพร้อมกัน
   * goodRatio     → โอกาสเจออาหารดี (%)
   * quest:
   *   goalsPick   → เลือก goal จำนวนกี่อัน
   *   miniPick    → เลือก mini quest จำนวนกี่อัน
   */

  const TABLE = {
    easy: {
      spawnInterval: 1400,
      fallSpeed: 0.011,
      scale: 1.35,
      maxActive: 3,
      goodRatio: 0.85,   // เจอของดีเยอะ
      quest: {
        goalsPick: 2,
        miniPick: 3
      }
    },

    normal: {
      spawnInterval: 1100,
      fallSpeed: 0.014,
      scale: 1.15,
      maxActive: 4,
      goodRatio: 0.72,
      quest: {
        goalsPick: 2,
        miniPick: 3
      }
    },

    hard: {
      spawnInterval: 850,
      fallSpeed: 0.018,
      scale: 1.0,
      maxActive: 5,
      goodRatio: 0.55,   // มั่วเยอะขึ้น ต้องเลือกจริง
      quest: {
        goalsPick: 2,
        miniPick: 3
      }
    }
  };

  // ให้ GameEngine ขอ config ด้วย difficulty key
  function get(diff) {
    diff = String(diff || 'normal').toLowerCase();
    return TABLE[diff] || TABLE.normal;
  }

  ns.foodGroupsDifficulty = { get, TABLE };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));