// === Hero Health — mode.hydration.js ===
// โหมด Hydration: เลือกเครื่องดื่มที่ดีต่อสุขภาพ หลบเครื่องดื่มหวานจัด

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // กลุ่ม "น้ำดี"
  const HYDRO_GOOD = [
    '💧','🚰','🧊','🥛','🍵','🫖',
    '🥒','🍉','🍊','🍋'
  ];

  // กลุ่ม "หวานจัด / น้ำอัดลม"
  const HYDRO_JUNK = [
    '🥤','🧋','🧃','🍹','🍰','🍪','🧁','🍫'
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
      SPAWN_INTERVAL: 700,
      ITEM_LIFETIME: 1500,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   55,
        junk:   25,
        star:    6,
        gold:    4,
        diamond: 3,
        shield:  3,
        fever:   4,
        rainbow: 0
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      cfg.SPAWN_INTERVAL = 950;
      cfg.ITEM_LIFETIME = 2100;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 14;
      cfg.SIZE_FACTOR = 1.2;
      cfg.TYPE_WEIGHTS = {
        good:   70,
        junk:   10,
        star:    7,
        gold:    4,
        diamond: 3,
        shield:  4,
        fever:   2,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 480;
      cfg.ITEM_LIFETIME = 1100;
      cfg.MAX_ACTIVE = 6;
      cfg.MISSION_GOOD_TARGET = 24;
      cfg.SIZE_FACTOR = 0.9;
      cfg.TYPE_WEIGHTS = {
        good:   35,
        junk:   45,
        star:    5,
        gold:    5,
        diamond: 4,
        shield:  3,
        fever:   7,
        rainbow: 1
      };
      cfg.FEVER_DURATION = 7;
      cfg.DIAMOND_TIME_BONUS = 1;
    }

    return cfg;
  }

  window.HH_MODES.hydration = {
    id: 'hydration',
    label: 'Hydration',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: แตะเครื่องดื่มที่ดีต่อสุขภาพให้ครบ ' +
             target + ' แก้ว และหลบเครื่องดื่มหวานจัด';
    },

    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(HYDRO_GOOD);
      if (type === 'junk')    return pickRandom(HYDRO_JUNK);
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      if (type === 'boss')    return '🧋'; // Boss = แก้วหวานยักษ์
      return '❓';
    }
  };
})();
