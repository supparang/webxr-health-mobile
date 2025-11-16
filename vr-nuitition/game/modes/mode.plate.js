// === Hero Health — mode.plate.js ===
// โหมด Balanced Plate: จัดจานให้สมดุล 5 หมู่
// ใช้ร่วมกับ engine กลางใน game/main.js ผ่าน window.HH_MODES.plate

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- Emoji ชุดโหมดนี้ ----------
  // อาหารดีต่อสุขภาพ (อยากให้ขึ้นจาน)
  const GOOD_FOODS = [
    '🍚','🥗','🥦','🥕','🍅','🥬','🍎','🍊','🍇',
    '🍌','🍐','🐟','🍗','🥚','🥜','🥛'
  ];

  // อาหาร/ขนมที่ให้เป็น "ของล่อ" ไม่อยากให้เต็มจาน
  const JUNK_FOODS = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🍰','🧁','🍫','🍦'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];

  // บอสประจำโหมด (จานยักษ์)
  const BOSS_ICON = '🍽️';

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- config ตาม diff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // default: normal
    let cfg = {
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1650,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   48,
        junk:   28,
        star:    7,
        gold:    6,
        diamond: 4,
        shield:  3,
        fever:   4,
        rainbow: 0
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      cfg.SPAWN_INTERVAL = 980;
      cfg.ITEM_LIFETIME = 2300;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 16;
      cfg.SIZE_FACTOR = 1.2;
      cfg.TYPE_WEIGHTS = {
        good:   62,
        junk:   16,
        star:    8,
        gold:    6,
        diamond: 3,
        shield:  4,
        fever:   3,
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
        good:   34,
        junk:   42,
        star:    6,
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

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.plate = {
    id: 'plate',
    label: 'Balanced Plate',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return (
        'ภารกิจจานสมดุล: เลือกอาหารดีให้ครบ ' + target +
        ' ชิ้น 🥗 และหลบฟาสต์ฟู้ด / ขนมหวานให้อยู่หมัด!'
      );
    },

    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(GOOD_FOODS);
      if (type === 'junk')    return pickRandom(JUNK_FOODS);
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      if (type === 'boss')    return BOSS_ICON; // จานยักษ์ทดสอบความไว
      return '❓';
    }
  };
})();
