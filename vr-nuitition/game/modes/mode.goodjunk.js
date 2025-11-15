// === Hero Health — mode.goodjunk.js ===
// โหมด Nutrition World: "Junk Invasion"
// เด็กเป็น Guardian ปัดขยะอาหาร เก็บของดี + Power-ups

(function () {
  'use strict';

  window.HH_MODES = window.HH_MODES || {};

  // ---------- Emoji Pools ----------
  const GOOD = [
    '🍎','🍓','🍇','🥦','🥕','🍅','🥬',
    '🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝',
    '🍚','🥛','🍞','🐟','🥗'
  ];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  const STAR = ['⭐','🌟'];      // คอมโบ boost
  const GOLD = ['🥇','🏅','🪙']; // คะแนนสูง
  const DIAMOND = ['💎'];       // เวลาเพิ่ม + คะแนนเยอะ
  const SHIELD = ['🛡️'];       // กันโดนขยะ
  const FEVER = ['🔥'];         // Ultra Mode
  const RAINBOW = ['🌈'];       // Super power – main.js กำหนด effect ไว้แล้ว

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- Config per diff ----------
  function configForDiff(diff) {
    const d = (diff || 'normal').toLowerCase();

    // default: NORMAL
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
        rainbow: 0 // เปิดใน hard
      },
      FEVER_DURATION: 6,
      DIAMOND_TIME_BONUS: 2
    };

    if (d === 'easy') {
      // เด็ก ป.4–5 / เริ่มต้น
      cfg.SPAWN_INTERVAL = 950;
      cfg.ITEM_LIFETIME = 2100;
      cfg.MAX_ACTIVE = 3;
      cfg.MISSION_GOOD_TARGET = 15;
      cfg.SIZE_FACTOR = 1.25;
      cfg.TYPE_WEIGHTS = {
        good:   65,  // ของดีเยอะ
        junk:   15,
        star:    8,
        gold:    6,
        diamond: 3,
        shield:  4,
        fever:   3,
        rainbow: 0
      };
      cfg.FEVER_DURATION = 5;
      cfg.DIAMOND_TIME_BONUS = 3;
    } else if (d === 'hard') {
      // โหมดมันส์ B-Mode
      cfg.SPAWN_INTERVAL = 420;
      cfg.ITEM_LIFETIME = 900;
      cfg.MAX_ACTIVE = 7;
      cfg.MISSION_GOOD_TARGET = 30;
      cfg.SIZE_FACTOR = 0.85;
      cfg.TYPE_WEIGHTS = {
        good:   32,
        junk:   40,
        star:    6,
        gold:    6,
        diamond: 5,
        shield:  3,
        fever:   6,
        rainbow: 2  // มีโอกาสเจอ power สุด
      };
      cfg.FEVER_DURATION = 7;
      cfg.DIAMOND_TIME_BONUS = 1;
    }

    return cfg;
  }

  window.HH_MODES.goodjunk = {
    id: 'goodjunk',
    label: 'Junk Invasion',

    setupForDiff: function (diff) {
      return configForDiff(diff);
    },

    // แสดงบน HUD บรรทัดภารกิจหลัก
    missionText: function (target) {
      return 'ภารกิจ Junk Invasion: เก็บอาหารดีให้ครบ ' +
        target + ' ชิ้น และปัดขยะให้ได้มากที่สุด!';
    },

    // main.js เรียกทุกครั้งที่ spawn
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
    },

    // ใช้สำหรับ CSV / วิจัย
    sessionInfo: function () {
      return {
        topic: 'Nutrition',
        world: 'Junk Invasion',
        groupId: 'goodjunk',
        groupLabel: 'Guardian of Nutrition World',
        groupIcon: '🍎'
      };
    }
  };
})();
