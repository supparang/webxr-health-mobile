// === /herohealth/vr-hydration/hha-diff-table.js ===
window.HHA_DIFF_TABLE = window.HHA_DIFF_TABLE || {};

window.HHA_DIFF_TABLE.hydration = {
  easy: {
    engine: {
      SIZE_FACTOR: 1.25,
      SPAWN_INTERVAL: 1100,
      ITEM_LIFETIME: 2600,
      MAX_ACTIVE: 3,
      TYPE_WEIGHTS: {
        good: 70,
        junk: 18,
        star: 4,
        diamond: 4,
        shield: 4
      }
    },
    benchmark: { /* ... ไว้ใช้วิจัยต่อ ... */ }
  },
  normal: {
    engine: {
      SIZE_FACTOR: 1.0,
      SPAWN_INTERVAL: 900,
      ITEM_LIFETIME: 2300,
      MAX_ACTIVE: 4,
      TYPE_WEIGHTS: {
        good: 65,
        junk: 22,
        star: 4,
        diamond: 4,
        shield: 5
      }
    }
  },
  hard: {
    engine: {
      SIZE_FACTOR: 0.9,
      SPAWN_INTERVAL: 750,
      ITEM_LIFETIME: 2100,
      MAX_ACTIVE: 5,
      TYPE_WEIGHTS: {
        good: 60,
        junk: 26,
        star: 4,
        diamond: 4,
        shield: 6
      }
    }
  }
};
