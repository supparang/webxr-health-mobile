// === Hero Health — mode.hydration.js ===
// โหมด Hydration: เลือก "น้ำดี" ให้ถึงเป้า หลีกเลี่ยงน้ำหวาน/น้ำอัดลม
// ใช้ร่วมกับ engine กลางใน game/main.js ผ่าน window.HH_MODES.hydration

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- ชุดอีโมจิของโหมดนี้ ----------
  // น้ำ "ดี" : น้ำเปล่า, นม, ซุปใส, ชาไม่หวาน (ตีความง่ายสำหรับเด็ก ป.5)
  const WATER_GOOD = [
    '💧', '🚰', '🥛', '🫗', '🍵', '☕', '🥣'
  ];

  // น้ำ "ล่อ/หวาน" : โซดา, น้ำอัดลม, ชานมไข่มุก ฯลฯ
  const WATER_JUNK = [
    '🥤','🧋','🧃','🍹','🍸','🍺','🍻','🥂','🍷','🥃'
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

    // ค่ากลาง (normal)
    let cfg = {
      SPAWN_INTERVAL: 700,
      ITEM_LIFETIME: 1500,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,   // เก็บ "แก้วน้ำดี" ให้ครบ
      SIZE_FACTOR: 1.0,
      TYPE_WEIGHTS: {
        good:   50,
        junk:   28,
        star:    6,
        gold:    5,
        diamond: 4,
        shield:  3,
        fever:   3,
        rainbow: 1
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      cfg.SPAWN_INTERVAL = 950;
      cfg.ITEM_LIFETIME = 2100;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 14;
      cfg.SIZE_FACTOR = 1.15;
      cfg.TYPE_WEIGHTS = {
        good:   65,
        junk:   15,
        star:    8,
        gold:    6,
        diamond: 3,
        shield:  4,
        fever:   2,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 460;
      cfg.ITEM_LIFETIME = 1050;
      cfg.MAX_ACTIVE = 6;
      cfg.MISSION_GOOD_TARGET = 24;
      cfg.SIZE_FACTOR = 0.9;
      cfg.TYPE_WEIGHTS = {
        good:   35,
        junk:   42,
        star:    5,
        gold:    5,
        diamond: 5,
        shield:  2,
        fever:   8,
        rainbow: 3
      };
      cfg.FEVER_DURATION = 7;
      cfg.DIAMOND_TIME_BONUS = 1;
    }

    return cfg;
  }

  // ---------- Goals / Quests ----------
  // ปล่อยแบบเบา ๆ ก่อน แล้วถ้าอาจารย์อยากจูนเกณฑ์วิจัยค่อยมาเพิ่ม
  function goalDefsForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const baseTarget = d === 'easy' ? 14 : (d === 'hard' ? 24 : 18);

    return [
      {
        id: 'good_glasses',
        label: 'เก็บแก้วน้ำดีให้ครบตามเป้า',
        type: 'count',
        target: baseTarget,
        weight: 2
      },
      {
        id: 'limit_sugar',
        label: 'แตะน้ำหวานให้น้อยที่สุด',
        type: 'count',        // engine ใช้กับ hitType='good' เป็นหลัก (ใช้เป็นตัวรอง)
        target: Math.round(baseTarget * 0.6),
        weight: 1
      }
    ];
  }

  function questDefsForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const streakTarget = d === 'easy' ? 10 : (d === 'hard' ? 14 : 12);
    const fastTarget   = d === 'easy' ? 0.90 : (d === 'hard' ? 0.65 : 0.75);

    return [
      {
        id: 'streak_water',
        icon: '💧',
        text: 'กดน้ำดีต่อเนื่อง ' + streakTarget + ' ชิ้น',
        kind: 'streak',
        threshold: streakTarget
      },
      {
        id: 'fast_click',
        icon: '⚡',
        text: 'กดให้ทันเร็วกว่า ' + fastTarget.toFixed(2) + ' วินาที (อย่างน้อย 1 ครั้ง)',
        kind: 'fast',
        threshold: fastTarget
      },
      {
        id: 'fever_mode',
        icon: '🔥',
        text: 'เข้าโหมด Fever อย่างน้อย 1 ครั้ง',
        kind: 'fever',
        threshold: 1
      }
    ];
  }

  // ---------- sessionInfo สำหรับ CSV ----------
  function buildSessionInfo() {
    return {
      topic: 'hydration',
      groupId: null,
      groupLabel: null,
      groupIcon: '💧'
    };
  }

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.hydration = {
    id: 'hydration',
    label: 'Hydration',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: เลือก "น้ำดี" ให้ครบ ' + target + ' แก้ว (อย่าเผลอกดน้ำหวานเยอะนะ!)';
    },

    goalDefs: function (diff) {
      return goalDefsForDiff(diff);
    },

    questDefs: function (diff) {
      return questDefsForDiff(diff);
    },

    sessionInfo: function () {
      return buildSessionInfo();
    },

    // engine จะเรียกตอน spawn เพื่อขอ emoji ตาม type
    pickEmoji: function (type) {
      if (type === 'good') {
        return pickRandom(WATER_GOOD);
      }
      if (type === 'junk') {
        return pickRandom(WATER_JUNK);
      }
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
