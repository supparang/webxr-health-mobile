// === Hero Health — mode.plate.js ===
// โหมด Balanced Plate: เลือกจานอาหารที่สมดุล หลบจานฟาสต์ฟู้ดมัน ๆ

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  const PLATE_GOOD = [
    '🥗','🍱','🍛','🍲','🥙','🥪','🍚','🍛','🥬','🥕'
  ];

  const PLATE_JUNK = [
    '🍔','🍟','🍕','🌭','🍗','🍖','🍿'
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

    // normal
    let cfg = {
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1550,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   50,
        junk:   30,
        star:    6,
        gold:    5,
        diamond: 4,
        shield:  3,
        fever:   4,
        rainbow: 2
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      cfg.SPAWN_INTERVAL = 980;
      cfg.ITEM_LIFETIME = 2200;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 16;
      cfg.SIZE_FACTOR = 1.2;
      cfg.TYPE_WEIGHTS = {
        good:   65,
        junk:   15,
        star:    7,
        gold:    5,
        diamond: 3,
        shield:  4,
        fever:   3,
        rainbow: 1
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 470;
      cfg.ITEM_LIFETIME = 1050;
      cfg.MAX_ACTIVE = 6;
      cfg.MISSION_GOOD_TARGET = 26;
      cfg.SIZE_FACTOR = 0.9;
      cfg.TYPE_WEIGHTS = {
        good:   35,
        junk:   45,
        star:    5,
        gold:    5,
        diamond: 5,
        shield:  3,
        fever:   7,
        rainbow: 3
      };
      cfg.FEVER_DURATION = 7;
      cfg.DIAMOND_TIME_BONUS = 1;
    }

    return cfg;
  }

  window.HH_MODES.plate = {
    id: 'plate',
    label: 'Balanced Plate',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เลือกจานอาหารที่สมดุลให้ครบ ' +
             target + ' จาน และหลบฟาสต์ฟู้ดมัน ๆ';
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
      if (type === 'boss')    return '🍔'; // Boss = เบอร์เกอร์ยักษ์
      return '❓';
    }
  };
})();
