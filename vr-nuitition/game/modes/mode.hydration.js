// === Hero Health — mode.hydration.js ===
// โหมด Hydration: ดื่มน้ำดี หลบน้ำหวาน / น้ำตาล
// ใช้ร่วมกับ engine กลางใน game/main.js ผ่าน window.HH_MODES.hydration

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- Emoji ชุดโหมดนี้ ----------
  // น้ำดี / เครื่องดื่มดีต่อสุขภาพ
  const GOOD_DRINKS = [
    '💧','🚰','🧊','🥛','🫗','🍵','🫖'
  ];

  // น้ำหวาน / น้ำตาล / ของเย็นจัดที่ไม่ดีต่อสุขภาพ
  const JUNK_DRINKS = [
    '🧃','🥤','🧋','🍹','🍧','🍨','🍦'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];

  // บอสประจำโหมด (ปีศาจน้ำหวาน)
  const BOSS_ICON = '😵‍💫';

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- config ตาม diff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // default: normal
    let cfg = {
      SPAWN_INTERVAL: 750,
      ITEM_LIFETIME: 1700,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,  // แก้วน้ำดีที่อยากได้
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   52,   // น้ำดีเยอะหน่อย
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
      cfg.ITEM_LIFETIME = 2400;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 14;
      cfg.SIZE_FACTOR = 1.15;
      cfg.TYPE_WEIGHTS = {
        good:   65,
        junk:   15,
        star:    8,
        gold:    6,
        diamond: 3,
        shield:  5,
        fever:   2,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 520;
      cfg.ITEM_LIFETIME = 1150;
      cfg.MAX_ACTIVE = 6;
      cfg.MISSION_GOOD_TARGET = 22;
      cfg.SIZE_FACTOR = 0.9;
      cfg.TYPE_WEIGHTS = {
        good:   38,
        junk:   40,  // น้ำหวานเยอะ
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
  window.HH_MODES.hydration = {
    id: 'hydration',
    label: 'Hydration Hero',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return (
        'ภารกิจดื่มน้ำ: เก็บน้ำดีให้ครบ ' + target +
        ' แก้ว 💧 และหลบน้ำหวานให้ได้มากที่สุด!'
      );
    },

    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(GOOD_DRINKS);
      if (type === 'junk')    return pickRandom(JUNK_DRINKS);
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      if (type === 'boss')    return BOSS_ICON;  // ปีศาจน้ำหวาน
      return '❓';
    }
  };
})();
