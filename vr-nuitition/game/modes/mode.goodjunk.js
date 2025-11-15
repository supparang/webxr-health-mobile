// === Hero Health — mode.goodjunk.js ===
// โหมดพื้นฐาน: Good vs Junk + Power-ups
// แยกออกมาจาก main.js ให้ main.js เรียกผ่าน window.HH_MODES.goodjunk

(function () {
  'use strict';

  // สร้าง namespace สำหรับทุกโหมด
  window.HH_MODES = window.HH_MODES || {};

  // ---------- ชุดอีโมจิของโหมดนี้ ----------
  const GOOD = [
    '🍎','🍓','🍇','🥦','🥕','🍅','🥬',
    '🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝',
    '🍚','🥛','🍞','🐟','🥗'
  ];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const STAR = ['⭐','🌟'];
  const GOLD = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD = ['🛡️'];
  const FEVER = ['🔥'];
  const RAINBOW = ['🌈'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- config ตาม diff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // ค่า default (normal)
    let cfg = {
      SPAWN_INTERVAL: 650,
      ITEM_LIFETIME: 1400,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   45,
        junk:   30,
        star:    7,
        gold:    6,
        diamond: 5,
        shield:  3,
        fever:   4,
        rainbow: 1
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      cfg.SPAWN_INTERVAL = 950;
      cfg.ITEM_LIFETIME = 2000;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 15;
      cfg.SIZE_FACTOR = 1.25;
      cfg.TYPE_WEIGHTS = {
        good:   60,
        junk:   15,
        star:    8,
        gold:    7,
        diamond: 4,
        shield:  4,
        fever:   2,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 430;
      cfg.ITEM_LIFETIME = 900;
      cfg.MAX_ACTIVE = 7;
      cfg.MISSION_GOOD_TARGET = 30;
      cfg.SIZE_FACTOR = 0.85;
      cfg.TYPE_WEIGHTS = {
        good:   30,
        junk:   45,
        star:    5,
        gold:    5,
        diamond: 5,
        shield:  2,
        fever:   8,
        rainbow: 2
      };
      cfg.FEVER_DURATION = 7;
      cfg.DIAMOND_TIME_BONUS = 1;
    }

    return cfg;
  }

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.goodjunk = {
    id: 'goodjunk',
    label: 'Good vs Junk',

    /** ให้ main.js เรียกตอนเริ่มเกม เพื่อขอ config */
    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    /** text ภารกิจบน HUD */
    missionText: function (target) {
      return 'ภารกิจวันนี้: เก็บของดีให้ครบ ' + target + ' ชิ้น';
    },

    /** main.js เรียกตอน spawn แต่ละเป้า เพื่อขอ emoji */
    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(GOOD);
      if (type === 'junk')    return pickRandom(JUNK);
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      return '❓';
    }
  };
})();
