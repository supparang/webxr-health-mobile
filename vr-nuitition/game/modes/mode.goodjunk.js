// === Hero Health — mode.goodjunk.js ===
// โหมดพื้นฐาน: Good vs Junk + Power-ups (+ Rainbow) + Diff Table + ACC_TARGET

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- Emoji Sets ----------
  const GOOD = [
    '🍎','🍓','🍇','🥦','🥕','🍅','🥬',
    '🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝',
    '🍚','🥛','🍞','🐟','🥗'
  ];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const STAR = ['⭐','🌟'];
  const GOLD = ['🥇','🏅','🪙'];
  const DIAMOND = ['💎'];
  const SHIELD = ['🛡️'];
  const FEVER = ['🔥'];
  const RAINBOW = ['🌈'];
  const BOSS_ICON = ['👾','😈'];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Diff config ----------
  const GJ_DIFF_TABLE = {
    easy: {
      SPAWN_INTERVAL: 1050,
      ITEM_LIFETIME: 2200,
      MAX_ACTIVE: 3,
      MISSION_GOOD_TARGET: 14,
      SIZE_FACTOR: 1.30,
      TYPE_WEIGHTS: {
        good:   70,
        junk:   10,
        star:    8,
        gold:    5,
        diamond: 3,
        shield:  3,
        fever:   1,
        rainbow: 0
      },
      FEVER_DURATION: 5,
      DIAMOND_TIME_BONUS: 3,
      ACC_TARGET: { min: 0.80, max: 1.00 }  // 80–100%
    },

    normal: {
      SPAWN_INTERVAL: 650,
      ITEM_LIFETIME: 1400,
      MAX_ACTIVE: 4,
      MISSION_GOOD_TARGET: 20,
      SIZE_FACTOR: 1.00,
      TYPE_WEIGHTS: {
        good:   45,
        junk:   30,
        star:    8,
        gold:    6,
        diamond: 4,
        shield:  4,
        fever:   3,
        rainbow: 0
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2,
      ACC_TARGET: { min: 0.55, max: 0.75 }  // 55–75%
    },

    hard: {
      SPAWN_INTERVAL: 380,
      ITEM_LIFETIME: 800,
      MAX_ACTIVE: 8,
      MISSION_GOOD_TARGET: 32,
      SIZE_FACTOR: 0.80,
      TYPE_WEIGHTS: {
        good:   28,
        junk:   46,
        star:    6,
        gold:    5,
        diamond: 4,
        shield:  3,
        fever:   6,
        rainbow: 2
      },
      FEVER_DURATION: 8,
      DIAMOND_TIME_BONUS: 1,
      ACC_TARGET: { min: 0.35, max: 0.55 }  // 35–55%
    }
  };

  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();
    const base = GJ_DIFF_TABLE[d] || GJ_DIFF_TABLE.normal;
    return JSON.parse(JSON.stringify(base));
  }

  // ---------- Register mode ----------
  window.HH_MODES.goodjunk = {
    id: 'goodjunk',
    label: 'Good vs Junk',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    missionText: function (target) {
      return 'ภารกิจวันนี้: คลิกของดีให้ครบ ' + target + ' ชิ้น แล้วหลบของขยะให้ได้เยอะที่สุด!';
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
      if (type === 'boss')    return pickRandom(BOSS_ICON);
      return '❓';
    }
  };
})();
