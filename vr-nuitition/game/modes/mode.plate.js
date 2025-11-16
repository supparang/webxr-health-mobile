// === Hero Health — mode.plate.js ===
// โหมด Balanced Plate: เลือกอาหารให้จานสมดุล (ข้าว-ผัก-โปรตีน-ผลไม้) vs อาหารทอด/หวานจัด

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};
  const MODE_ID = 'plate';

  // ---------- Diff Table สำหรับโหมด Plate ----------
  const HHA_DIFF_TABLE = {
    plate: {
      easy: {
        engine: {
          SPAWN_INTERVAL: 980,
          ITEM_LIFETIME: 2300,
          MAX_ACTIVE: 3,
          MISSION_GOOD_TARGET: 16,
          SIZE_FACTOR: 1.2,
          FEVER_DURATION: 5,
          DIAMOND_TIME_BONUS: 3,
          TYPE_WEIGHTS: {
            good:   64,
            junk:   16,
            star:    8,
            gold:    5,
            diamond: 3,
            shield:  2,
            fever:   2,
            rainbow: 0
          }
        },
        benchmark: {
          targetAccuracyPct: 85,
          targetMissionSuccessPct: 90,
          expectedAvgRTms: 900,
          note: 'ใช้สอน concept “จานสุขภาพ” แบบสนุก ๆ ครั้งแรก'
        }
      },
      normal: {
        engine: {
          SPAWN_INTERVAL: 720,
          ITEM_LIFETIME: 1650,
          MAX_ACTIVE: 4,
          MISSION_GOOD_TARGET: 20,
          SIZE_FACTOR: 1.0,
          FEVER_DURATION: 6,
          DIAMOND_TIME_BONUS: 2,
          TYPE_WEIGHTS: {
            good:   48,
            junk:   28,
            star:    7,
            gold:    6,
            diamond: 4,
            shield:  3,
            fever:   4,
            rainbow: 0
          }
        },
        benchmark: {
          targetAccuracyPct: 75,
          targetMissionSuccessPct: 70,
          expectedAvgRTms: 780,
          note: 'ใช้เก็บคะแนนหลังสอนเรื่องจานสุขภาพ 5 หมู่'
        }
      },
      hard: {
        engine: {
          SPAWN_INTERVAL: 500,
          ITEM_LIFETIME: 1100,
          MAX_ACTIVE: 6,
          MISSION_GOOD_TARGET: 24,
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
          expectedAvgRTms: 720,
          note: 'ใช้สำหรับเด็กที่เข้าใจหมู่–ปริมาณแล้ว อยากเพิ่ม challenge การตัดสินใจเร็ว'
        }
      }
    }
  };

  // ---------- Emoji Pools ----------
  // อาหารที่อยากเห็นบนจานสุขภาพ (ข้าว-ผัก-โปรตีน-ผลไม้)
  const PLATE_GOOD = [
    '🍚','🍙','🍞',
    '🥦','🥕','🥬','🍅',
    '🍗','🐟','🍤','🥚',
    '🍎','🍓','🍇','🍉','🍌','🍍'
  ];

  // อาหารที่ทำให้จานไม่สมดุล (ทอด มัน หวานจัด)
  const PLATE_JUNK = [
    '🍔','🍟','🍕','🌭','🍗','🍖',
    '🍩','🍪','🧁','🍰','🍫'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS    = ['🍽️','🥗']; // บอสจานใหญ่

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- configForDiff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const modeCfg = HHA_DIFF_TABLE[MODE_ID] && HHA_DIFF_TABLE[MODE_ID][d];
    if (modeCfg && modeCfg.engine) return modeCfg.engine;

    return {
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1650,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.0,
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2,
      TYPE_WEIGHTS: {
        good:   48,
        junk:   28,
        star:    7,
        gold:    6,
        diamond: 4,
        shield:  3,
        fever:   4,
        rainbow: 0
      }
    };
  }

  // ---------- Register Mode ----------
  window.HH_MODES[MODE_ID] = {
    id: MODE_ID,
    label: 'Balanced Plate',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เลือกอาหารที่ทำให้ “จานสุขภาพ” สมดุล ' +
        'ให้ครบ ' + target + ' ชิ้น (ข้าว-ผัก-โปรตีน-ผลไม้)';
    },

    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(PLATE_GOOD);
      if (type === 'junk')    return pickRandom(PLATE_JUNK);
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
