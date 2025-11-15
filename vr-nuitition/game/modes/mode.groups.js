// === Hero Health — mode.groups.js ===
// โหมด Food Groups: เลือกอาหารให้ตรง "หมู่เป้าหมาย"
// ใช้ร่วมกับ engine กลางใน game/main.js ผ่าน window.HH_MODES.groups

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

  // ---------- ลงทะเบียนโหมด ----------
  window.HH_MODES.groups = {
    id: 'groups',
    label: 'Food Groups',

    /**
     * เรียกทุกครั้งที่เริ่มเกมใหม่จาก engine:
     * - สุ่มหมู่เป้าหมายใหม่ 1 หมู่
     * - คืน config สำหรับ engine ตั้งค่า SPAWN_INTERVAL ฯลฯ
     */
    setupForDiff: function (diff) {
      currentGroup = pickRandomGroup();
      return configForDiff(diff);
    },

    /** mission text บน HUD */
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

    /**
     * ให้ engine เรียกทุกครั้งที่ spawn เป้าใหม่:
     * - type = 'good' → ใช้อาหารในหมู่เป้าหมาย
     * - type = 'junk' → ใช้อาหารจากหมู่อื่น + EXTRA_JUNK
     * - power-ups ใช้ชุด emoji ทั่วไป
     */
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
