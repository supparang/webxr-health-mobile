// === Hero Health — mode.plate.js ===
// โหมด Balanced Plate: เลือกจาน/อาหารที่ช่วยให้จานสมดุล
// good = อาหารจานหลัก 5 หมู่, junk = ขนมจัดหนัก / ของทอดล้วน ๆ
// ใช้ร่วมกับ engine กลางผ่าน window.HH_MODES.plate

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // แบ่งหมู่คร่าว ๆ เป็นจาน
  const PLATE_GOOD = [
    '🥗','🍱','🍛','🍚','🍛','🥙',
    '🍞','🥦','🍎','🍓','🐟','🥚'
  ];
  const PLATE_JUNK = [
    '🍔','🍟','🌭','🍕','🍗','🍖',
    '🍩','🍪','🍰','🧁','🍫'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS    = ['🍽️']; // Boss เป็น “จานใหญ่”

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    let cfg = {
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1600,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   50,
        junk:   25,
        star:    6,
        gold:    5,
        diamond: 4,
        shield:  4,
        fever:   6,
        rainbow: 2
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      cfg.SPAWN_INTERVAL = 1000;
      cfg.ITEM_LIFETIME = 2300;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 16;
      cfg.SIZE_FACTOR = 1.2;
      cfg.TYPE_WEIGHTS = {
        good:   65,
        junk:   15,
        star:    7,
        gold:    5,
        diamond: 3,
        shield:  5,
        fever:   3,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 480;
      cfg.ITEM_LIFETIME = 1100;
      cfg.MAX_ACTIVE = 6;
      cfg.MISSION_GOOD_TARGET = 26;
      cfg.SIZE_FACTOR = 0.9;
      cfg.TYPE_WEIGHTS = {
        good:   38,
        junk:   40,
        star:    5,
        gold:    4,
        diamond: 4,
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
    label: 'Balanced Plate',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจจานสมดุล: เลือกจาน/อาหารดี ๆ ให้ครบ ' +
             target + ' ชิ้น แล้วระวังจานของทอดล้วน ๆ นะ 🍟🍕';
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
