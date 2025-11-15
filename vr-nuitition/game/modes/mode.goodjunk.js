// === Hero Health — mode.goodjunk.js ===
// โหมดพื้นฐาน: Good vs Junk + Power-ups
// ใช้ร่วมกับ engine กลางใน game/main.js ผ่าน window.HH_MODES.goodjunk
// รองรับ Goal + Quest API (goalDefs, questDefs) ด้วย

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

  // ---------- Goal API ----------
  // ใช้กับ mission bar / summary / CSV (แบบกลาง ๆ เล่นได้กับทุกโหมด)
  function goalDefs(diff) {
    const d = (diff || 'normal').toLowerCase();
    const cfg = configForDiff(d);

    let comboTarget = 8;
    let maxBad = 8;
    if (d === 'easy') {
      comboTarget = 5;
      maxBad = 10;
    } else if (d === 'hard') {
      comboTarget = 12;
      maxBad = 6;
    }

    return [
      {
        id: 'gj_good_count',
        type: 'count',
        label: 'เก็บอาหารดีให้ครบ',
        target: cfg.MISSION_GOOD_TARGET,
        weight: 2
      },
      {
        id: 'gj_combo_peak',
        type: 'combo',
        label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย',
        target: comboTarget,
        weight: 1
      },
      {
        id: 'gj_limit_bad',
        type: 'noFail',
        label: 'อย่าแตะของขยะบ่อยเกินไป (จำนวนครั้งผิดสูงสุด)',
        target: maxBad,
        weight: 1
      }
    ];
  }

  // ---------- Quest API ----------
  function questDefs(diff) {
    const d = (diff || 'normal').toLowerCase();

    const streakSoft = (d === 'easy') ? 3 : 5;
    const streakHard = (d === 'hard') ? 15 : 10;
    const scoreEarly = (d === 'hard') ? 260 : 200;

    return [
      {
        id: 'gj_streak_basic',
        icon: '⚡',
        text: 'แตะอาหารดีติดกัน ≥ 3 ครั้ง',
        kind: 'streak',
        threshold: 3
      },
      {
        id: 'gj_streak_soft',
        icon: '⚡',
        text: 'ต่อคอมโบยาว ๆ ≥ ' + streakSoft + ' ครั้ง',
        kind: 'streak',
        threshold: streakSoft
      },
      {
        id: 'gj_streak_hard',
        icon: '⚡',
        text: 'คอมโบสุดโหด ≥ ' + streakHard + ' ครั้ง',
        kind: 'streak',
        threshold: streakHard
      },
      {
        id: 'gj_fast',
        icon: '⏱',
        text: 'แตะเป้าให้ทัน ≤ 1 วิ อย่างน้อย 1 ครั้ง',
        kind: 'fast',
        threshold: 1.0
      },
      {
        id: 'gj_nobad5',
        icon: '🛡',
        text: 'เล่นโดยไม่แตะของขยะเลย 5 วินาที',
        kind: 'noBadFor',
        threshold: 5
      },
      {
        id: 'gj_nobad10',
        icon: '🛡',
        text: 'เล่นโดยไม่แตะของขยะเลย 10 วินาที',
        kind: 'noBadFor',
        threshold: 10
      },
      {
        id: 'gj_power1',
        icon: '⭐',
        text: 'เก็บ Power-up ให้ได้อย่างน้อย 1 ครั้ง',
        kind: 'power',
        threshold: 1
      },
      {
        id: 'gj_fever1',
        icon: '🔥',
        text: 'เข้าโหมด Fever อย่างน้อย 1 ครั้ง',
        kind: 'fever',
        threshold: 1
      },
      {
        id: 'gj_score_early',
        icon: '💥',
        text: 'ทำคะแนน ≥ ' + scoreEarly + ' ภายใน 20 วิแรก',
        kind: 'scoreIn',
        threshold: scoreEarly
      },
      {
        id: 'gj_rainbow',
        icon: '🌈',
        text: 'เก็บ Rainbow อย่างน้อย 1 ครั้ง',
        kind: 'powerType',
        threshold: 1,
        powerType: 'rainbow'
      }
    ];
  }

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.goodjunk = {
    id: 'goodjunk',
    label: 'Good vs Junk',

    // engine เรียกตอนเริ่มเกม เพื่อขอ config ตาม diff
    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    // text ภารกิจที่จะแสดงบน HUD
    missionText: function (target) {
      return 'ภารกิจวันนี้: เก็บอาหารดีให้ครบ ' + target + ' ชิ้น (อย่าแตะของขยะ!)';
    },

    // Goal หลักของโหมดนี้
    goalDefs: function (diff) {
      return goalDefs(diff);
    },

    // Mini Quest Pool ของโหมดนี้
    questDefs: function (diff) {
      return questDefs(diff);
    },

    // context เพิ่มเติมต่อรอบ (goodjunk ไม่ต้องมีอะไรพิเศษ ก็คืน {} ไป)
    sessionInfo: function () {
      return {};
    },

    // engine เรียกทุกครั้งที่ spawn เป้า เพื่อขอ emoji ตาม type
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
