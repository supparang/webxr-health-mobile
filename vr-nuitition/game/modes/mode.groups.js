// === Hero Health — mode.groups.js ===
// โหมด Food Groups: เลือกอาหารให้ตรง "หมู่เป้าหมาย" + Diff Table + ACC_TARGET

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

  const EXTRA_JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫'];

  const STAR    = ['⭐','🌟'];
  const GOLD    = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD  = ['🛡️'];
  const FEVER   = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS_ICON = ['👹','👾'];

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

  // state ต่อรอบ
  let currentGroup = null;

  // ---------- Diff config ----------
  const GROUPS_DIFF_TABLE = {
    easy: {
      SPAWN_INTERVAL: 1200,
      ITEM_LIFETIME: 2300,
      MAX_ACTIVE: 3,
      MISSION_GOOD_TARGET: 12,
      SIZE_FACTOR: 1.20,
      TYPE_WEIGHTS: {
        good:   68,
        junk:   15,
        star:    7,
        gold:    4,
        diamond: 3,
        shield:  5,
        fever:   3,
        rainbow: 0
      },
      FEVER_DURATION: 5,
      DIAMOND_TIME_BONUS: 3,
      ACC_TARGET: { min: 0.80, max: 1.00 }
    },

    normal: {
      SPAWN_INTERVAL: 750,
      ITEM_LIFETIME: 1650,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 18,
      SIZE_FACTOR: 1.00,
      TYPE_WEIGHTS: {
        good:   50,
        junk:   26,
        star:    7,
        gold:    5,
        diamond: 4,
        shield:  4,
        fever:   4,
        rainbow: 2
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2,
      ACC_TARGET: { min: 0.55, max: 0.75 }
    },

    hard: {
      SPAWN_INTERVAL: 520,
      ITEM_LIFETIME: 1200,
      MAX_ACTIVE: 6,
      MISSION_GOOD_TARGET: 24,
      SIZE_FACTOR: 0.90,
      TYPE_WEIGHTS: {
        good:   34,
        junk:   42,
        star:    6,
        gold:    5,
        diamond: 5,
        shield:  3,
        fever:   8,
        rainbow: 3
      },
      FEVER_DURATION: 7,
      DIAMOND_TIME_BONUS: 1,
      ACC_TARGET: { min: 0.35, max: 0.55 }
    }
  };

  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const base = GROUPS_DIFF_TABLE[d] || GROUPS_DIFF_TABLE.normal;
    return JSON.parse(JSON.stringify(base));
  }

  // ---------- Register mode ----------
  window.HH_MODES.groups = {
    id: 'groups',
    label: 'Food Groups',

    setupForDiff: function (diff) {
      currentGroup = pickRandomGroup();
      const cfg = configForDiff(diff);
      // แนบข้อมูลหมู่เป้าหมายไว้เผื่อ coach หรือระบบอื่นใช้
      cfg.sessionInfo = {
        groupId: currentGroup.id,
        groupLabel: currentGroup.label,
        groupIcon: currentGroup.icon
      };
      return cfg;
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

    pickEmoji: function (type) {
      if (type === 'good') {
        const pool = currentGroup && currentGroup.items && currentGroup.items.length
          ? currentGroup.items
          : (FOOD_GROUPS[0] ? FOOD_GROUPS[0].items : ['🍎']);
        return pickRandom(pool);
      }

      if (type === 'junk') {
        let pool = getOtherGroupItems(currentGroup);
        if (!pool.length) pool = EXTRA_JUNK.slice();
        return pickRandom(pool);
      }

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
