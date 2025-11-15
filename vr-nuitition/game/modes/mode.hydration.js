// === Hero Health — mode.hydration.js ===
// โหมด Hydration Cave: Water Balance Battle
// เลือกเครื่องดื่มที่ดีต่อสุขภาพ เลี่ยงน้ำหวาน/น้ำอัดลม

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  const GOOD_DRINKS = [
    '💧','🚰','🥛','🫖','🍵','🧊','🍶',
    '🍋','🥒' // infused water
  ];

  const JUNK_DRINKS = [
    '🥤','🧋','🍹','🍸','🍺','🍷','🍾','🍻',
    '🧃','🥤','🍧'
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
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1600,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,
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
      cfg.MISSION_GOOD_TARGET = 14;
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
      cfg.MISSION_GOOD_TARGET = 24;
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

  window.HH_MODES.hydration = {
    id: 'hydration',
    label: 'Hydration Cave',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'Water Balance Battle: เลือกเครื่องดื่มช่วยฟื้นพลังน้ำในร่างกายให้ครบ ' +
        target + ' แก้ว (เลี่ยงน้ำหวานจัด!)';
    },

    pickEmoji: function (type) {
      if (type === 'good')   return pickRandom(GOOD_DRINKS);
      if (type === 'junk')   return pickRandom(JUNK_DRINKS);
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
        topic: 'Hydration',
        world: 'Water Balance Battle',
        groupId: 'hydration',
        groupLabel: 'สมดุลน้ำดื่ม',
        groupIcon: '💧'
      };
    }
  };
})();
