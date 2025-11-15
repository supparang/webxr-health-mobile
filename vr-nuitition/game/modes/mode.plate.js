// === Hero Health — mode.plate.js ===
// โหมด Balanced Plate: เลือกอาหารที่ทำให้ "จานสุขภาพดี" + Diff Table + ACC_TARGET

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // อาหารที่อยากให้เด็กเลือก (ดีต่อสุขภาพ)
  const PLATE_GOOD = [
    '🥦','🥬','🥕','🍅','🌽','🥒',       // ผัก
    '🍎','🍓','🍇','🍉','🍊','🍍','🍐',    // ผลไม้
    '🍚','🍙','🍞','🥖','🥨','🥐',        // ข้าว-แป้ง
    '🍗','🥩','🥚','🐟','🥜','🥗'         // โปรตีนดี
  ];

  // ของมัน/หวาน/ฟาสต์ฟู้ดที่ควรหลบ
  const PLATE_JUNK = [
    '🍔','🍟','🍕','🌭','🍩','🍪','🧁','🍰','🍫','🥤','🧋'
  ];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS_ICON = ['👑','👾'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Diff config ----------
  const PLATE_DIFF_TABLE = {
    easy: {
      SPAWN_INTERVAL: 1250,
      ITEM_LIFETIME: 2400,
      MAX_ACTIVE: 3,
      MISSION_GOOD_TARGET: 14,
      SIZE_FACTOR: 1.20,
      TYPE_WEIGHTS: {
        good:   70,
        junk:   10,
        star:    7,
        gold:    4,
        diamond: 3,
        shield:  3,
        fever:   3,
        rainbow: 0
      },
      FEVER_DURATION: 5,
      DIAMOND_TIME_BONUS: 3,
      ACC_TARGET: { min: 0.80, max: 1.00 }
    },

    normal: {
      SPAWN_INTERVAL: 780,
      ITEM_LIFETIME: 1650,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
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
      SPAWN_INTERVAL: 540,
      ITEM_LIFETIME: 1200,
      MAX_ACTIVE: 6,
      MISSION_GOOD_TARGET: 28,
      SIZE_FACTOR: 0.90,
      TYPE_WEIGHTS: {
        good:   38,
        junk:   36,
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
    const base = PLATE_DIFF_TABLE[d] || PLATE_DIFF_TABLE.normal;
    return JSON.parse(JSON.stringify(base));
  }

  window.HH_MODES.plate = {
    id: 'plate',
    label: 'Balanced Plate',

    setupForDiff: function (diff) {
      const cfg = configForDiff(diff);
      cfg.sessionInfo = {
        concept: 'จานอาหารสมดุล',
        note: 'เลือกอาหารที่ช่วยให้จานมีผัก ผลไม้ โปรตีนดี และข้าว-แป้งพอดี'
      };
      return cfg;
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เลือกอาหารที่ดีต่อสุขภาพให้ครบ ' +
        target + ' ชิ้น เพื่อจัด “จานสมดุล” ของเรา!';
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
      if (type === 'boss')    return pickRandom(BOSS_ICON);
      return '❓';
    }
  };
})();
