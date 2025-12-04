// === /herohealth/vr-groups/emoji-image.js ===
// Food Groups VR — ชุด emoji + random picker (ไม่ยุ่งกับ shader/texture)
// 2025-12-05

(function (ns) {
  'use strict';

  ns = ns || (window.GAME_MODULES = window.GAME_MODULES || {});

  // -------------------------------------------------------------------
  // ข้อมูลอาหาร: emoji + หมู่ + ดี/ควรลด
  // group: 1–5 = อาหาร 5 หมู่, 9 = ของหวาน/ของมัน/น้ำหวาน
  // -------------------------------------------------------------------
  const ITEMS = [
    // หมู่ 1 ข้าว-แป้ง
    { emoji: '🍚',  group: 1, isGood: true },
    { emoji: '🍞',  group: 1, isGood: true },
    { emoji: '🥔',  group: 1, isGood: true },
    { emoji: '🌽',  group: 1, isGood: true },
    { emoji: '🍜',  group: 1, isGood: true },

    // หมู่ 2 ผัก
    { emoji: '🥬',  group: 2, isGood: true },
    { emoji: '🥦',  group: 2, isGood: true },
    { emoji: '🥕',  group: 2, isGood: true },
    { emoji: '🍅',  group: 2, isGood: true },
    { emoji: '🥗',  group: 2, isGood: true },

    // หมู่ 3 ผลไม้
    { emoji: '🍉',  group: 3, isGood: true },
    { emoji: '🍓',  group: 3, isGood: true },
    { emoji: '🍌',  group: 3, isGood: true },
    { emoji: '🍊',  group: 3, isGood: true },
    { emoji: '🍇',  group: 3, isGood: true },

    // หมู่ 4 เนื้อสัตว์/ถั่ว
    { emoji: '🐟',  group: 4, isGood: true },
    { emoji: '🍗',  group: 4, isGood: true },
    { emoji: '🫘',  group: 4, isGood: true },
    { emoji: '🥚',  group: 4, isGood: true },
    { emoji: '🥜',  group: 4, isGood: true },

    // หมู่ 5 นม
    { emoji: '🥛',  group: 5, isGood: true },
    { emoji: '🧀',  group: 5, isGood: true },
    { emoji: '🍦',  group: 5, isGood: true },

    // ของหวาน/มัน/น้ำหวาน (กลุ่มควรลด)
    { emoji: '🍔',  group: 9, isGood: false },
    { emoji: '🍟',  group: 9, isGood: false },
    { emoji: '🍕',  group: 9, isGood: false },
    { emoji: '🍩',  group: 9, isGood: false },
    { emoji: '🍪',  group: 9, isGood: false },
    { emoji: '🧁',  group: 9, isGood: false },
    { emoji: '🍫',  group: 9, isGood: false },
    { emoji: '🍰',  group: 9, isGood: false },
    { emoji: '🥤',  group: 9, isGood: false },
    { emoji: '🧋',  group: 9, isGood: false }
  ];

  const GOOD = ITEMS.filter(i => i.isGood);
  const BAD  = ITEMS.filter(i => !i.isGood);

  // goodRatio ~ โอกาสออก “อาหารดี” (0–1)
  function pickRandom(goodRatio) {
    goodRatio = typeof goodRatio === 'number' ? goodRatio : 0.75;
    if (Math.random() < goodRatio && GOOD.length) {
      return GOOD[Math.floor(Math.random() * GOOD.length)];
    }
    const pool = ITEMS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  ns.foodGroupsEmoji = {
    ITEMS,
    GOOD,
    BAD,
    pickRandom
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
