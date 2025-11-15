// === Hero Health — mode.goodjunk.js (minimal, production-safe) ===
// โหมด Good vs Junk สำหรับใช้ร่วมกับ game/main.js
// โฟกัสให้แน่ใจว่า register window.HH_MODES.goodjunk ได้แน่นอน

(function () {
  'use strict';

  // ให้เห็นใน console ว่าไฟล์นี้โหลดจริง
  console.log('[HHA goodjunk] loading mode.goodjunk.js');

  // สร้าง namespace ถ้ายังไม่มี
  if (!window.HH_MODES) {
    window.HH_MODES = {};
  }

  // ---------- อีโมจิพื้นฐาน ----------
  const GOOD = [
    '🍎','🍓','🍇','🥦','🥕','🍅','🥬',
    '🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝',
    '🍚','🥛','🍞','🐟','🥗'
  ];
  const JUNK    = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- config ตาม diff (เวอร์ชันย่อ) ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // base: normal
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
      cfg.SPAWN_INTERVAL      = 950;
      cfg.ITEM_LIFETIME       = 2000;
      cfg.MAX_ACTIVE          = 3;
      cfg.MISSION_GOOD_TARGET = 15;
      cfg.SIZE_FACTOR         = 1.25;
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
      cfg.FEVER_DURATION      = 5;
      cfg.DIAMOND_TIME_BONUS  = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL      = 430;
      cfg.ITEM_LIFETIME       = 900;
      cfg.MAX_ACTIVE          = 7;
      cfg.MISSION_GOOD_TARGET = 30;
      cfg.SIZE_FACTOR         = 0.85;
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
      cfg.FEVER_DURATION      = 7;
      cfg.DIAMOND_TIME_BONUS  = 1;
    }

    return cfg;
  }

  // ---------- Goal / Quest (เวอร์ชันสั้น) ----------
  function goalDefs(diff) {
    const cfg = configForDiff(diff);
    return [
      {
        id: 'gj_good_count',
        type: 'count',
        label: 'เก็บอาหารดีให้ครบ',
        target: cfg.MISSION_GOOD_TARGET,
        weight: 2
      }
    ];
  }

  function questDefs(diff) {
    return [
      {
        id: 'gj_streak3',
        icon: '⚡',
        text: 'คอมโบ ≥ 3',
        kind: 'streak',
        threshold: 3
      },
      {
        id: 'gj_fast1',
        icon: '⏱',
        text: 'แตะเป้าให้ทัน ≤ 1 วิ 1 ครั้ง',
        kind: 'fast',
        threshold: 1.0
      },
      {
        id: 'gj_power1',
        icon: '⭐',
        text: 'เก็บ Power-up อย่างน้อย 1 ชิ้น',
        kind: 'power',
        threshold: 1
      }
    ];
  }

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.goodjunk = {
    id: 'goodjunk',
    label: 'Good vs Junk',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เก็บอาหารดีให้ครบ ' + target + ' ชิ้น (อย่าแตะของขยะ!)';
    },

    goalDefs: function (diff) {
      return goalDefs(diff);
    },

    questDefs: function (diff) {
      return questDefs(diff);
    },

    sessionInfo: function () {
      // โหมดนี้ไม่มี context พิเศษ
      return {};
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
      return '❓';
    }
  };

  console.log('[HHA goodjunk] registered window.HH_MODES.goodjunk =', window.HH_MODES.goodjunk);
})();
