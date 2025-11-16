// === Hero Health — mode.goodjunk.js ===
// โหมดพื้นฐาน: Good vs Junk + Power-ups (วิจัยจริง + diff table)

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};
  const MODE_ID = 'goodjunk';

  // ---------- Diff Table สำหรับโหมด Good vs Junk ----------
  const HHA_DIFF_TABLE = {
    goodjunk: {
      easy: {
        engine: {
          SPAWN_INTERVAL: 1000,
          ITEM_LIFETIME: 2300,
          MAX_ACTIVE: 3,
          MISSION_GOOD_TARGET: 15,
          SIZE_FACTOR: 1.25,
          FEVER_DURATION: 5,
          DIAMOND_TIME_BONUS: 3,
          TYPE_WEIGHTS: {
            good:   62,
            junk:   14,
            star:    8,
            gold:    6,
            diamond: 3,
            shield:  5,
            fever:   2,
            rainbow: 0
          }
        },
        benchmark: {
          targetAccuracyPct: 85,
          targetMissionSuccessPct: 90,
          expectedAvgRTms: 900,
          note: 'โหมดฝึกพื้นฐาน แยกของดี/ขยะ เหมาะใช้สอนครั้งแรก ๆ'
        }
      },
      normal: {
        engine: {
          SPAWN_INTERVAL: 650,
          ITEM_LIFETIME: 1500,
          MAX_ACTIVE: 4,
          MISSION_GOOD_TARGET: 20,
          SIZE_FACTOR: 1.0,
          FEVER_DURATION: 6,
          DIAMOND_TIME_BONUS: 2,
          TYPE_WEIGHTS: {
            good:   48,
            junk:   30,
            star:    7,
            gold:    6,
            diamond: 4,
            shield:  3,
            fever:   4,
            rainbow: 1
          }
        },
        benchmark: {
          targetAccuracyPct: 75,
          targetMissionSuccessPct: 70,
          expectedAvgRTms: 750,
          note: 'ระดับมาตรฐานสำหรับเก็บข้อมูลก่อน–หลังการสอน'
        }
      },
      hard: {
        engine: {
          SPAWN_INTERVAL: 480,
          ITEM_LIFETIME: 1050,
          MAX_ACTIVE: 6,
          MISSION_GOOD_TARGET: 26,
          SIZE_FACTOR: 0.9,
          FEVER_DURATION: 7,
          DIAMOND_TIME_BONUS: 1,
          TYPE_WEIGHTS: {
            good:   34,
            junk:   42,
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
          expectedAvgRTms: 700,
          note: 'ใช้แยกเด็กที่มีการควบคุมตนเองดี / สมาธิดี (executive function)'
        }
      }
    }
  };

  // ---------- Emoji Pools ----------
  const GOOD = [
    '🍎','🍓','🍇','🥦','🥕','🍅','🥬',
    '🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝',
    '🍚','🥛','🍞','🐟','🥗'
  ];
  const JUNK    = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS    = ['👾','🤖'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- configForDiff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const modeCfg = HHA_DIFF_TABLE[MODE_ID] && HHA_DIFF_TABLE[MODE_ID][d];
    if (modeCfg && modeCfg.engine) return modeCfg.engine;

    // fallback ปลอดภัยถ้า diff ไม่ตรง
    return {
      SPAWN_INTERVAL: 650,
      ITEM_LIFETIME: 1500,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.0,
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2,
      TYPE_WEIGHTS: {
        good:   48,
        junk:   30,
        star:    7,
        gold:    6,
        diamond: 4,
        shield:  3,
        fever:   4,
        rainbow: 1
      }
    };
  }

  // ---------- Register Mode ----------
  window.HH_MODES[MODE_ID] = {
    id: MODE_ID,
    label: 'Good vs Junk',

    // main.js เรียกตอนเริ่มเกม
    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    // ข้อความภารกิจบน HUD
    missionText: function (target) {
      return 'ภารกิจวันนี้: คลิกของดีให้ครบ ' +
        target +
        ' ชิ้น แล้วหลบอาหารขยะให้ได้มากที่สุด!';
    },

    // main.js เรียกทุกครั้งที่ spawn เป้าใหม่
    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(GOOD);
      if (type === 'junk')    return pickRandom(JUNK);
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
