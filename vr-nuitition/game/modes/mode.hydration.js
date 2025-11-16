// === Hero Health — mode.hydration.js ===
// โหมด Hydration: เลือกเครื่องดื่มที่ช่วยให้ร่างกายสดชื่น (น้ำเปล่า/นม/ซุป) vs น้ำหวาน

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};
  const MODE_ID = 'hydration';

  // ---------- Diff Table สำหรับโหมด Hydration ----------
  const HHA_DIFF_TABLE = {
    hydration: {
      easy: {
        engine: {
          SPAWN_INTERVAL: 1000,
          ITEM_LIFETIME: 2400,
          MAX_ACTIVE: 3,
          MISSION_GOOD_TARGET: 14,
          SIZE_FACTOR: 1.15,
          FEVER_DURATION: 5,
          DIAMOND_TIME_BONUS: 3,
          TYPE_WEIGHTS: {
            good:   68,
            junk:   14,
            star:    6,
            gold:    4,
            diamond: 3,
            shield:  3,
            fever:   2,
            rainbow: 0
          }
        },
        benchmark: {
          targetAccuracyPct: 88,
          targetMissionSuccessPct: 92,
          expectedAvgRTms: 900,
          note: 'เน้นให้เด็กแยก “น้ำเปล่า vs น้ำหวาน” ได้ชัดเจนมาก ๆ'
        }
      },
      normal: {
        engine: {
          SPAWN_INTERVAL: 750,
          ITEM_LIFETIME: 1700,
          MAX_ACTIVE: 4,
          MISSION_GOOD_TARGET: 18,
          SIZE_FACTOR: 1.0,
          FEVER_DURATION: 6,
          DIAMOND_TIME_BONUS: 2,
          TYPE_WEIGHTS: {
            good:   52,
            junk:   24,
            star:    6,
            gold:    5,
            diamond: 4,
            shield:  4,
            fever:   4,
            rainbow: 1
          }
        },
        benchmark: {
          targetAccuracyPct: 75,
          targetMissionSuccessPct: 70,
          expectedAvgRTms: 780,
          note: 'ใช้วัดผลหลังการสอนเรื่องการดื่มน้ำอย่างเหมาะสม'
        }
      },
      hard: {
        engine: {
          SPAWN_INTERVAL: 520,
          ITEM_LIFETIME: 1150,
          MAX_ACTIVE: 6,
          MISSION_GOOD_TARGET: 22,
          SIZE_FACTOR: 0.9,
          FEVER_DURATION: 7,
          DIAMOND_TIME_BONUS: 1,
          TYPE_WEIGHTS: {
            good:   38,
            junk:   40,
            star:    6,
            gold:    5,
            diamond: 5,
            shield:  3,
            fever:   7,
            rainbow: 3
          }
        },
        benchmark: {
          targetAccuracyPct: 60,
          targetMissionSuccessPct: 50,
          expectedAvgRTms: 720,
          note: 'เหมาะฝึกเด็กที่ดื่มน้ำหวานบ่อย ให้ฝึกแยกและปฏิเสธได้เร็ว'
        }
      }
    }
  };

  // ---------- Emoji Pools ----------
  // น้ำดี: น้ำเปล่า, นม, ซุป, ชาไม่หวาน, น้ำแข็งเปล่า
  const GOOD_DRINKS = [
    '💧','🚰','🫗','🥛','🍵','☕','🥣','🧊'
  ];

  // น้ำหวาน / น้ำตาลสูง
  const SUGARY_DRINKS = [
    '🥤','🧋','🧃','🍹','🍧','🍨','🍦'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS    = ['💦','🌊']; // บอสน้ำใหญ่

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- configForDiff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const modeCfg = HHA_DIFF_TABLE[MODE_ID] && HHA_DIFF_TABLE[MODE_ID][d];
    if (modeCfg && modeCfg.engine) return modeCfg.engine;

    return {
      SPAWN_INTERVAL: 750,
      ITEM_LIFETIME: 1700,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,
      SIZE_FACTOR: 1.0,
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2,
      TYPE_WEIGHTS: {
        good:   52,
        junk:   24,
        star:    6,
        gold:    5,
        diamond: 4,
        shield:  4,
        fever:   4,
        rainbow: 1
      }
    };
  }

  // ---------- Register Mode ----------
  window.HH_MODES[MODE_ID] = {
    id: MODE_ID,
    label: 'Hydration',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เลือกเครื่องดื่มที่ช่วยให้ร่างกายสดชื่น ' +
        'ให้ครบ ' + target + ' แก้ว (หลบน้ำหวานด้วยนะ!)';
    },

    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(GOOD_DRINKS);
      if (type === 'junk')    return pickRandom(SUGARY_DRINKS);
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      if (type === 'boss')    return pickRandom(BOSS);
      return '❓';
    }
  };
})();
