// === Hero Health — mode.groups.js ===
// โหมด Food Groups: เลือกอาหารให้ตรง "หมู่เป้าหมาย" (วิจัยจริง + diff table)

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};
  const MODE_ID = 'groups';

  // ---------- Diff Table สำหรับโหมด Groups ----------
  const HHA_DIFF_TABLE = {
    groups: {
      easy: {
        engine: {
          SPAWN_INTERVAL: 1050,
          ITEM_LIFETIME: 2400,
          MAX_ACTIVE: 3,
          MISSION_GOOD_TARGET: 14,
          SIZE_FACTOR: 1.2,
          FEVER_DURATION: 5,
          DIAMOND_TIME_BONUS: 3,
          TYPE_WEIGHTS: {
            good:   68,
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
          expectedAvgRTms: 950,
          note: 'ใช้เป็น pre-test เบา ๆ ว่าเข้าใจหมู่อาหารเบื้องต้นไหม'
        }
      },
      normal: {
        engine: {
          SPAWN_INTERVAL: 720,
          ITEM_LIFETIME: 1650,
          MAX_ACTIVE: 4,
          MISSION_GOOD_TARGET: 18,
          SIZE_FACTOR: 1.0,
          FEVER_DURATION: 6,
          DIAMOND_TIME_BONUS: 2,
          TYPE_WEIGHTS: {
            good:   52,
            junk:   24,
            star:    7,
            gold:    5,
            diamond: 4,
            shield:  4,
            fever:   4,
            rainbow: 2
          }
        },
        benchmark: {
          targetAccuracyPct: 75,
          targetMissionSuccessPct: 70,
          expectedAvgRTms: 800,
          note: 'เหมาะสำหรับเก็บคะแนนหลังเรียนหมู่อาหาร + วัด working memory'
        }
      },
      hard: {
        engine: {
          SPAWN_INTERVAL: 520,
          ITEM_LIFETIME: 1150,
          MAX_ACTIVE: 6,
          MISSION_GOOD_TARGET: 24,
          SIZE_FACTOR: 0.9,
          FEVER_DURATION: 7,
          DIAMOND_TIME_BONUS: 1,
          TYPE_WEIGHTS: {
            good:   36,
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
          note: 'ใช้แยกเด็กที่จำหมู่อาหารได้แม่น + ตอบสนองเร็ว'
        }
      }
    }
  };

  // ---------- ข้อมูลหมู่อาหาร ----------
  const FOOD_GROUPS = [
    {
      id: 'grain',
      label: 'ข้าว-แป้ง',
      icon: '🍚',
      items: ['🍚','🍙','🍞','🥖','🥯','🥨','🥐','🫓']
    },
    {
      id: 'veg',
      label: 'ผัก',
      icon: '🥦',
      items: ['🥦','🥕','🥬','🍅','🌽','🥒','🧅','🫛']
    },
    {
      id: 'fruit',
      label: 'ผลไม้',
      icon: '🍎',
      items: ['🍎','🍓','🍇','🍉','🍌','🍊','🍍','🍑','🍐','🥝','🫐']
    },
    {
      id: 'protein',
      label: 'เนื้อ-โปรตีน',
      icon: '🍗',
      items: ['🍗','🍖','🥩','🥚','🐟','🍤','🍣','🥜','🌭']
    },
    {
      id: 'dairy',
      label: 'นม',
      icon: '🥛',
      items: ['🥛','🧀','🍦','🍨','🍧']
    }
  ];

  // ขยะ/ของล่อใช้ร่วมกับทุกหมู่
  const EXTRA_JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫'];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS    = ['🍱','🍛']; // บอสจานรวมหมู่อาหาร

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickRandomGroup() {
    return FOOD_GROUPS[Math.floor(Math.random() * FOOD_GROUPS.length)];
  }

  function getOtherGroupItems(targetGroup) {
    if (!targetGroup) return [];
    let list = [];
    for (let i = 0; i < FOOD_GROUPS.length; i++) {
      const g = FOOD_GROUPS[i];
      if (g.id === targetGroup.id) continue;
      list = list.concat(g.items);
    }
    list = list.concat(EXTRA_JUNK);
    return list;
  }

  let currentGroup = null;

  // ---------- configForDiff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const modeCfg = HHA_DIFF_TABLE[MODE_ID] && HHA_DIFF_TABLE[MODE_ID][d];
    if (modeCfg && modeCfg.engine) return modeCfg.engine;

    // fallback ปลอดภัย
    return {
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1650,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,
      SIZE_FACTOR: 1.0,
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2,
      TYPE_WEIGHTS: {
        good:   52,
        junk:   24,
        star:    7,
        gold:    5,
        diamond: 4,
        shield:  4,
        fever:   4,
        rainbow: 2
      }
    };
  }

  // ---------- Register Mode ----------
  window.HH_MODES[MODE_ID] = {
    id: MODE_ID,
    label: 'Food Groups',

    setupForDiff: function (diff) {
      currentGroup = pickRandomGroup();
      return configForDiff(diff);
    },

    missionText: function (target) {
      if (currentGroup) {
        return 'ภารกิจวันนี้: เลือกอาหารให้ตรงหมู่ “' +
          currentGroup.icon + ' ' + currentGroup.label +
          '” ให้ครบ ' + target + ' ชิ้น';
      }
      return 'ภารกิจวันนี้: เลือกอาหารให้ตรงหมู่เป้าหมายให้ครบ ' +
        target + ' ชิ้น';
    },

    pickEmoji: function (type) {
      if (type === 'good') {
        const pool = currentGroup && currentGroup.items && currentGroup.items.length
          ? currentGroup.items
          : (FOOD_GROUPS[0] ? FOOD_GROUPS[0].items : ['🍎']);
        return pickRandom(pool);
      }

      if (type === 'junk') {
        let pool = getOtherGroupItems(currentGroup);
        if (!pool.length) pool = EXTRA_JUNK.slice();
        return pickRandom(pool);
      }

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
