// === Hero Health — mode.goodjunk.js ===
// โหมดพื้นฐาน: Good vs Junk + Power-ups
// ใช้ร่วมกับ engine กลางใน game/main.js ผ่าน window.HH_MODES.goodjunk
// (เวอร์ชันนี้เพิ่ม Goal + Quest API: goalDefs(), questDefs())

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

    // default: normal
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

  // ---------- Goal + Quest API (ให้ main.js รุ่นใหม่เรียกใช้) ----------

  /**
   * goalDefs(diff)
   *  - คืนชุด "เป้าหมายหลัก" ของโหมดนี้ ตามระดับ diff
   *  - main.js จะเอาไปใช้วาด mission bar / สรุปผลใน CSV
   *
   * รูปแบบแต่ละ goal:
   *  { id, type, label, target, weight }
   *
   * type แนะนำ:
   *  - 'count'   : นับจำนวนของดี/การตอบถูก (ผูกกับ missionGoodCount)
   *  - 'combo'   : คอมโบสูงสุด (ผูกกับ maxCombo)
   *  - 'noFail'  : จำกัดจำนวนผิด (engine จะนับ badHits ให้)
   */
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
        id: 'good_count',
        type: 'count',
        label: 'เก็บของดีให้ครบ',
        target: cfg.MISSION_GOOD_TARGET,
        weight: 2
      },
      {
        id: 'combo_peak',
        type: 'combo',
        label: 'ทำคอมโบให้ได้อย่างน้อย',
        target: comboTarget,
        weight: 1
      },
      {
        id: 'limit_bad',
        type: 'noFail',
        label: 'อย่าพลาดเกิน',
        target: maxBad,   // จำนวนครั้งผิดสูงสุดที่ยอมให้
        weight: 1
      }
    ];
  }

  /**
   * questDefs(diff)
   *  - คืน "Mini Quest Pool" ของโหมดนี้
   *  - engine จะสุ่ม 3 ข้อจาก pool นี้ไปแสดงใน panel ทีละรอบ
   *
   * รูปแบบแต่ละ quest:
   *  { id, icon, text, kind, threshold }
   *
   * kind ตัวอย่าง:
   *  - 'streak'   : ใช้ maxCombo / combo
   *  - 'fast'     : reaction time <= threshold (วินาที)
   *  - 'noBadFor' : ไม่มีการผิดเลยภายใน threshold วินาที
   *  - 'power'    : เก็บ power-up ครบตามจำนวน
   *  - 'scoreIn'  : ได้คะแนนถึงใน X วินาทีแรก
   */
  function questDefs(diff) {
    const d = (diff || 'normal').toLowerCase();

    // ปรับความโหดเล็กน้อยตาม diff
    const streak5 = (d === 'easy') ? 4 : 5;
    const streak10 = (d === 'hard') ? 12 : 10;
    const scoreEarly = (d === 'hard') ? 260 : 200;

    return [
      {
        id: 'streak3',
        icon: '⚡',
        text: 'ทำคอมโบต่อเนื่อง ≥ 3',
        kind: 'streak',
        threshold: 3
      },
      {
        id: 'streak5',
        icon: '⚡',
        text: 'ทำคอมโบต่อเนื่อง ≥ ' + streak5,
        kind: 'streak',
        threshold: streak5
      },
      {
        id: 'streak10',
        icon: '⚡',
        text: 'ทำคอมโบยาว ๆ ≥ ' + streak10,
        kind: 'streak',
        threshold: streak10
      },
      {
        id: 'fast1',
        icon: '⏱',
        text: 'แตะเป้าให้ทัน ≤ 1 วิ อย่างน้อย 1 ครั้ง',
        kind: 'fast',
        threshold: 1.0
      },
      {
        id: 'noBad5',
        icon: '🛡',
        text: 'เล่นโดยไม่พลาดเลย 5 วินาที',
        kind: 'noBadFor',
        threshold: 5
      },
      {
        id: 'noBad10',
        icon: '🛡',
        text: 'เล่นโดยไม่พลาดเลย 10 วินาที',
        kind: 'noBadFor',
        threshold: 10
      },
      {
        id: 'power1',
        icon: '⭐',
        text: 'เก็บ Power-up ให้ได้อย่างน้อย 1 ครั้ง',
        kind: 'power',
        threshold: 1
      },
      {
        id: 'fever1',
        icon: '🔥',
        text: 'เข้าโหมด Fever ให้ได้อย่างน้อย 1 ครั้ง',
        kind: 'fever',
        threshold: 1
      },
      {
        id: 'scoreEarly',
        icon: '💥',
        text: 'ทำคะแนน ≥ ' + scoreEarly + ' ภายใน 20 วิแรก',
        kind: 'scoreIn',
        threshold: scoreEarly   // engine จะใช้ร่วมกับ "time = 20s"
      },
      {
        id: 'rainbowHit',
        icon: '🌈',
        text: 'เก็บเป้า Rainbow อย่างน้อย 1 ครั้ง',
        kind: 'powerType',      // เจาะจงชนิด power-up
        threshold: 1,
        powerType: 'rainbow'
      }
    ];
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

    /** นิยาม Goal หลักของโหมดนี้ (ให้ main.js ใช้ทำ mission/summary) */
    goalDefs: function (diff) {
      return goalDefs(diff);
    },

    /** นิยาม Mini Quest Pool ของโหมดนี้ (ให้ main.js สุ่มไปแสดง) */
    questDefs: function (diff) {
      return questDefs(diff);
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
