// === Hero Health — mode.groups.js ===
// โหมด Food Groups: เลือกอาหารให้ตรง "หมู่เป้าหมาย"
// ใช้ร่วมกับ engine กลางใน game/main.js ผ่าน window.HH_MODES.groups
// เวอร์ชันนี้เพิ่ม Goal + Quest API + sessionInfo() สำหรับ export CSV

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- ข้อมูลหมู่อาหาร ----------
  const FOOD_GROUPS = [
    {
      id: 'grain',
      label: 'ข้าว-แป้ง',
      icon: '🍚',
      items: ['🍚','🍙','🍞','🥖','🥯','🥨','🥐','🫓']
    },
    {
      id: 'veg',
      label: 'ผัก',
      icon: '🥦',
      items: ['🥦','🥕','🥬','🍅','🌽','🥒','🧅','🫛']
    },
    {
      id: 'fruit',
      label: 'ผลไม้',
      icon: '🍎',
      items: ['🍎','🍓','🍇','🍉','🍌','🍊','🍍','🍑','🍐','🥝','🫐']
    },
    {
      id: 'protein',
      label: 'เนื้อ-โปรตีน',
      icon: '🍗',
      items: ['🍗','🍖','🥩','🥚','🐟','🍤','🍣','🥜','🌭']
    },
    {
      id: 'dairy',
      label: 'นม',
      icon: '🥛',
      items: ['🥛','🧀','🍦','🍨','🍧']
    }
  ];

  // ขยะ/ของล่อใช้ร่วมกับทุกหมู่ (ไม่ใช่หมู่เป้าหมาย)
  const EXTRA_JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫'];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickRandomGroup() {
    return FOOD_GROUPS[Math.floor(Math.random() * FOOD_GROUPS.length)];
  }

  function getOtherGroupItems(targetGroup) {
    if (!targetGroup) return [];
    let list = [];
    for (let i = 0; i < FOOD_GROUPS.length; i++) {
      const g = FOOD_GROUPS[i];
      if (g.id === targetGroup.id) continue;
      list = list.concat(g.items);
    }
    list = list.concat(EXTRA_JUNK);
    return list;
  }

  // state ของโหมดนี้ (แต่ละรอบเกม)
  let currentGroup = null;

  // ---------- config ตาม diff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // default: normal
    let cfg = {
      SPAWN_INTERVAL: 700,
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
      cfg.SIZE_FACTOR = 1.2;
      cfg.TYPE_WEIGHTS = {
        good:   68,
        junk:   12,
        star:    7,
        gold:    5,
        diamond: 3,
        shield:  3,
        fever:   2,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      cfg.SPAWN_INTERVAL = 480;
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

  // ---------- Goal API ----------
  function goalDefs(diff) {
    const d = (diff || 'normal').toLowerCase();
    const cfg = configForDiff(d);

    let comboTarget = 7;
    let maxBad = 8;
    if (d === 'easy') {
      comboTarget = 4;
      maxBad = 10;
    } else if (d === 'hard') {
      comboTarget = 10;
      maxBad = 6;
    }

    const labelMain = 'เลือกอาหารให้ตรงหมู่เป้าหมายให้ครบ';

    return [
      {
        id: 'group_good_count',
        type: 'count',
        label: labelMain,
        target: cfg.MISSION_GOOD_TARGET,
        weight: 2
      },
      {
        id: 'group_combo_peak',
        type: 'combo',
        label: 'ทำคอมโบต่อเนื่องให้ได้อย่างน้อย',
        target: comboTarget,
        weight: 1
      },
      {
        id: 'group_limit_bad',
        type: 'noFail',
        label: 'อย่าตอบผิดหมู่บ่อยเกินไป (จำนวนครั้งผิดสูงสุด)',
        target: maxBad,
        weight: 1
      }
    ];
  }

  // ---------- Quest API ----------
  function questDefs(diff) {
    const d = (diff || 'normal').toLowerCase();

    const streakSoft = (d === 'easy') ? 3 : 4;
    const streakHard = (d === 'hard') ? 10 : 8;
    const scoreEarly = (d === 'hard') ? 240 : 200;

    return [
      {
        id: 'fg_streak_basic',
        icon: '⚡',
        text: 'แตะอาหารถูกหมู่ติดกัน ≥ 3 ครั้ง',
        kind: 'streak',
        threshold: 3
      },
      {
        id: 'fg_streak_soft',
        icon: '⚡',
        text: 'ต่อคอมโบยาว ๆ ≥ ' + streakSoft + ' ครั้ง',
        kind: 'streak',
        threshold: streakSoft
      },
      {
        id: 'fg_streak_hard',
        icon: '⚡',
        text: 'คอมโบสุดโหด ≥ ' + streakHard + ' ครั้ง',
        kind: 'streak',
        threshold: streakHard
      },
      {
        id: 'fg_fast',
        icon: '⏱',
        text: 'แตะอาหารถูกหมู่ให้ทัน ≤ 1 วิ อย่างน้อย 1 ครั้ง',
        kind: 'fast',
        threshold: 1.0
      },
      {
        id: 'fg_nobad5',
        icon: '🛡',
        text: 'เล่นโดยไม่ตอบผิดเลย 5 วินาที',
        kind: 'noBadFor',
        threshold: 5
      },
      {
        id: 'fg_nobad10',
        icon: '🛡',
        text: 'เล่นโดยไม่ตอบผิดเลย 10 วินาที',
        kind: 'noBadFor',
        threshold: 10
      },
      {
        id: 'fg_power1',
        icon: '⭐',
        text: 'เก็บ Power-up ให้ได้อย่างน้อย 1 ครั้ง',
        kind: 'power',
        threshold: 1
      },
      {
        id: 'fg_fever1',
        icon: '🔥',
        text: 'เข้าโหมด Fever อย่างน้อย 1 ครั้ง',
        kind: 'fever',
        threshold: 1
      },
      {
        id: 'fg_score_early',
        icon: '💥',
        text: 'ทำคะแนน ≥ ' + scoreEarly + ' ภายใน 20 วิแรก',
        kind: 'scoreIn',
        threshold: scoreEarly
      },
      {
        id: 'fg_rainbow',
        icon: '🌈',
        text: 'เก็บ Rainbow อย่างน้อย 1 ครั้ง',
        kind: 'powerType',
        threshold: 1,
        powerType: 'rainbow'
      }
    ];
  }

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.groups = {
    id: 'groups',
    label: 'Food Groups',

    setupForDiff: function (diff) {
      currentGroup = pickRandomGroup();
      return configForDiff(diff);
    },

    missionText: function (target) {
      if (currentGroup) {
        return (
          'ภารกิจวันนี้: เลือกอาหารให้ตรงกับหมู่เป้าหมาย ' +
          '“' + currentGroup.icon + ' ' + currentGroup.label +
          '” ให้ครบ ' + target + ' ชิ้น'
        );
      }
      return 'ภารกิจวันนี้: เลือกอาหารให้ตรงกับหมู่เป้าหมายให้ครบ ' + target + ' ชิ้น';
    },

    goalDefs: function (diff) {
      return goalDefs(diff);
    },

    questDefs: function (diff) {
      return questDefs(diff);
    },

    // ข้อมูล context ของรอบนี้ สำหรับ main.js เอาไปเขียนลง CSV
    sessionInfo: function () {
      if (!currentGroup) return {};
      return {
        targetGroupId: currentGroup.id,
        targetGroupLabel: currentGroup.label,
        targetGroupIcon: currentGroup.icon
      };
    },

    pickEmoji: function (type) {
      if (type === 'good') {
        const pool = currentGroup && currentGroup.items && currentGroup.items.length
          ? currentGroup.items
          : (FOOD_GROUPS[0] ? FOOD_GROUPS[0].items : ['🍎']);
        return pickRandom(pool);
      }

      if (type === 'junk') {
        let pool = getOtherGroupItems(currentGroup);
        if (!pool.length) {
          pool = EXTRA_JUNK.slice();
        }
        return pickRandom(pool);
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
