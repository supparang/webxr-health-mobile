// === Hero Health — mode.hydration.js ===
// โหมด Hydration: เลือกเครื่องดื่มที่ดีต่อสุขภาพ เลี่ยงน้ำหวาน/น้ำอัดลม

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- ชุดเครื่องดื่ม ----------
  const GOOD_DRINKS = [
    '💧','🚰','🥛','🫖','🍵','🧊','🍶','🥤', // 🥤 ไว้ใช้ใน good low-sugar ถ้าต้องการ
    '🥒','🍋' // ใช้แทน infused water (แตงกวา/เลมอน)
  ];

  const JUNK_DRINKS = [
    '🥤','🧋','🍹','🍸','🍺','🍷','🍾','🍻',
    '🧃','🥤','🍸','🍹','🍧'
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

  // ---------- config ตาม diff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // default: normal
    let cfg = {
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1600,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   50,
        junk:   25,
        star:    6,
        gold:    5,
        diamond: 4,
        shield:  4,
        fever:   4,
        rainbow: 2
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
        good:   65,
        junk:   15,
        star:    8,
        gold:    6,
        diamond: 3,
        shield:  5,
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
        good:   35,
        junk:   40,
        star:    5,
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

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.hydration = {
    id: 'hydration',
    label: 'Hydration Balance',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เลือกเครื่องดื่มที่ดีต่อสุขภาพให้ครบ ' + target + ' แก้ว';
    },

    pickEmoji: function (type) {
      if (type === 'good') {
        return pickRandom(GOOD_DRINKS);
      }
      if (type === 'junk') {
        return pickRandom(JUNK_DRINKS);
      }
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      return '❓';
    },

    // ข้อมูลสำหรับงานวิจัย/ครู (ใช้ใน CSV)
    sessionInfo: function () {
      return {
        topic: 'Hydration',
        groupId: 'hydration',
        groupLabel: 'สมดุลน้ำดื่ม',
        groupIcon: '💧'
      };
    }
  };
})();
