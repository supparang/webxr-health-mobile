// === Hero Health — mode.plate.js ===
// โหมด Balanced Plate Island: Table of Harmony
// จัดอาหารให้เหมาะกับ "จานสมดุล" เลี่ยงของมัน/หวานจัด

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  const GOOD_PLATE = [
    // ผัก
    '🥦','🥕','🥬','🍅','🥒','🌽',
    // ข้าว-แป้งที่ดี
    '🍚','🍙','🥔','🍞',
    // โปรตีนดี
    '🐟','🍗','🥚','🥜',
    // ผลไม้
    '🍎','🍓','🍌','🍊','🍇','🍉'
  ];

  const JUNK_FOOD = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🧋','🥤'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    let cfg = {
      SPAWN_INTERVAL: 700,
      ITEM_LIFETIME: 1600,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   52,
        junk:   24,
        star:    6,
        gold:    5,
        diamond: 4,
        shield:  4,
        fever:   4,
        rainbow: 1
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      cfg.SPAWN_INTERVAL = 1000;
      cfg.ITEM_LIFETIME = 2300;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 16;
      cfg.SIZE_FACTOR = 1.15;
      cfg.TYPE_WEIGHTS = {
        good:   68,
        junk:   14,
        star:    7,
        gold:    5,
        diamond: 3,
        shield:  5,
        fever:   2,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 500;
      cfg.ITEM_LIFETIME = 1100;
      cfg.MAX_ACTIVE = 6;
      cfg.MISSION_GOOD_TARGET = 26;
      cfg.SIZE_FACTOR = 0.9;
      cfg.TYPE_WEIGHTS = {
        good:   38,
        junk:   38,
        star:    6,
        gold:    5,
        diamond: 5,
        shield:  3,
        fever:   8,
        rainbow: 3
      };
      cfg.FEVER_DURATION = 7;
      cfg.DIAMOND_TIME_BONUS = 1;
    }

    return cfg;
  }

  window.HH_MODES.plate = {
    id: 'plate',
    label: 'Balanced Plate Island',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'Table of Harmony: เลือกอาหารให้เหมาะกับจานสมดุลให้ครบ ' +
        target + ' ชิ้น (ผัก + โปรตีนดี + ข้าวไม่ขัดสี)';
    },

    pickEmoji: function (type) {
      if (type === 'good')   return pickRandom(GOOD_PLATE);
      if (type === 'junk')   return pickRandom(JUNK_FOOD);
      if (type === 'star')   return pickRandom(STAR);
      if (type === 'gold')   return pickRandom(GOLD);
      if (type === 'diamond')return pickRandom(DIAMOND);
      if (type === 'shield') return pickRandom(SHIELD);
      if (type === 'fever')  return pickRandom(FEVER);
      if (type === 'rainbow')return pickRandom(RAINBOW);
      return '❓';
    },

    sessionInfo: function () {
      return {
        topic: 'Balanced Plate',
        world: 'Table of Harmony',
        groupId: 'plate',
        groupLabel: 'จานอาหารสมดุล',
        groupIcon: '🍽️'
      };
    }
  };
})();
