// === Hero Health — mode.hydration.js ===
// โหมด Hydration: เลือก "น้ำดี" vs "น้ำหวาน" + Diff Table + ACC_TARGET

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // น้ำดี (ควรดื่มบ่อย)
  const WATER_GOOD = [
    '💧','🚰','🥛','🫗','🍵','🫖','🧊'
  ];

  // น้ำหวาน / เครื่องดื่มหวาน (ควรหลบ)
  const WATER_JUNK = [
    '🥤','🧋','🧃','🍹','🍸','🍷','🍺','🍾'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS_ICON = ['🐉','👾'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Diff config ----------
  const HYDRATION_DIFF_TABLE = {
    easy: {
      SPAWN_INTERVAL: 1100,
      ITEM_LIFETIME: 2300,
      MAX_ACTIVE: 3,
      MISSION_GOOD_TARGET: 14,
      SIZE_FACTOR: 1.20,
      TYPE_WEIGHTS: {
        good:   66,
        junk:   14,
        star:    7,
        gold:    5,
        diamond: 3,
        shield:  3,
        fever:   2,
        rainbow: 0
      },
      FEVER_DURATION: 5,
      DIAMOND_TIME_BONUS: 3,
      ACC_TARGET: { min: 0.80, max: 1.00 }
    },

    normal: {
      SPAWN_INTERVAL: 720,
      ITEM_LIFETIME: 1600,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,
      SIZE_FACTOR: 1.00,
      TYPE_WEIGHTS: {
        good:   52,
        junk:   24,
        star:    8,
        gold:    5,
        diamond: 4,
        shield:  3,
        fever:   3,
        rainbow: 1
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2,
      ACC_TARGET: { min: 0.55, max: 0.75 }
    },

    hard: {
      SPAWN_INTERVAL: 520,
      ITEM_LIFETIME: 1100,
      MAX_ACTIVE: 6,
      MISSION_GOOD_TARGET: 27,
      SIZE_FACTOR: 0.90,
      TYPE_WEIGHTS: {
        good:   36,
        junk:   38,
        star:    6,
        gold:    5,
        diamond: 5,
        shield:  3,
        fever:   7,
        rainbow: 3
      },
      FEVER_DURATION: 8,
      DIAMOND_TIME_BONUS: 1,
      ACC_TARGET: { min: 0.35, max: 0.55 }
    }
  };

  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const base = HYDRATION_DIFF_TABLE[d] || HYDRATION_DIFF_TABLE.normal;
    return JSON.parse(JSON.stringify(base));
  }

  window.HH_MODES.hydration = {
    id: 'hydration',
    label: 'Hydration',

    setupForDiff: function (diff) {
      const cfg = configForDiff(diff);
      cfg.sessionInfo = {
        concept: 'ดี vs น้ำหวาน',
        note: 'เลือกเฉพาะน้ำดี (น้ำเปล่า / นม / ชาไม่หวาน) ให้ครบเป้าหมาย'
      };
      return cfg;
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เลือกเฉพาะ “น้ำดี” ให้ครบ ' + target +
        ' แก้ว แล้วหลบเครื่องดื่มหวานให้ได้เยอะที่สุด!';
    },

    pickEmoji: function (type) {
      if (type === 'good')    return pickRandom(WATER_GOOD);
      if (type === 'junk')    return pickRandom(WATER_JUNK);
      if (type === 'star')    return pickRandom(STAR);
      if (type === 'gold')    return pickRandom(GOLD);
      if (type === 'diamond') return pickRandom(DIAMOND);
      if (type === 'shield')  return pickRandom(SHIELD);
      if (type === 'fever')   return pickRandom(FEVER);
      if (type === 'rainbow') return pickRandom(RAINBOW);
      if (type === 'boss')    return pickRandom(BOSS_ICON);
      return '❓';
    }
  };
})();
