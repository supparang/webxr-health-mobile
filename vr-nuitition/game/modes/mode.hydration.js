// === Hero Health — mode.hydration.js ===
// โหมด Hydration: เลือกสิ่งที่ช่วยเพิ่มน้ำดี ๆ ให้ร่างกาย (good)
// หลีกเลี่ยงน้ำหวาน / น้ำอัดลม / ชาไข่มุก (junk)
// ใช้ร่วมกับ engine กลางผ่าน window.HH_MODES.hydration

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- ชุดอีโมจิ ----------

  // ของดี ช่วยเรื่องน้ำ/ความชุ่มชื้น
  const GOOD = [
    '💧','🚰','🥤','🥛','🍵','🫗',
    '🍉','🍍','🍊','🍇','🍎'
  ];
  // “ของล่อ” ด้านน้ำ: น้ำหวานจัด / น้ำอัดลม / ชาไข่มุก ฯลฯ
  const JUNK = [
    '🧋','🥤','🧃','🍹','🍸','🍺','🥃',
    '🍰','🧁','🍩'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS    = ['💦']; // ใช้ตอน Boss

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- config ตาม diff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // default (normal)
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
        gold:    5,
        diamond: 3,
        shield:  3,
        fever:   6,
        rainbow: 2
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
        junk:   15,
        star:    6,
        gold:    4,
        diamond: 2,
        shield:  4,
        fever:   3,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 480;
      cfg.ITEM_LIFETIME = 1100;
      cfg.MAX_ACTIVE = 6;
      cfg.MISSION_GOOD_TARGET = 22;
      cfg.SIZE_FACTOR = 0.9;
      cfg.TYPE_WEIGHTS = {
        good:   40,
        junk:   40,
        star:    5,
        gold:    4,
        diamond: 4,
        shield:  3,
        fever:   8,
        rainbow: 2
      };
      cfg.FEVER_DURATION = 7;
      cfg.DIAMOND_TIME_BONUS = 1;
    }

    return cfg;
  }

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.hydration = {
    id: 'hydration',
    label: 'Hydration',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจน้ำดี: เลือก 💧/น้ำดี ๆ ให้ครบ ' + target + ' แก้ว แล้วหลบน้ำหวานสุด ๆ 🍹';
    },

    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(GOOD);
      if (type === 'junk')    return pickRandom(JUNK);
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
