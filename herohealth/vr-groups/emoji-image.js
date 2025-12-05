// === /herohealth/vr-groups/emoji-image.js ===
// Food Groups emoji pool (non-module, global)
// 2025-12-06

(function (root) {
  'use strict';

  const GOOD_ITEMS = [
    // หมู่ 1 ข้าว-แป้ง
    { emoji: '🍚', group: 1, isGood: true,  name: 'ข้าวสวย' },
    { emoji: '🍞', group: 1, isGood: true,  name: 'ขนมปังโฮลวีต' },
    { emoji: '🥖', group: 1, isGood: true,  name: 'ขนมปัง' },

    // หมู่ 2 ผัก
    { emoji: '🥦', group: 2, isGood: true,  name: 'บรอกโคลี' },
    { emoji: '🥬', group: 2, isGood: true,  name: 'ผักใบเขียว' },
    { emoji: '🥕', group: 2, isGood: true,  name: 'แครอต' },

    // หมู่ 3 ผลไม้
    { emoji: '🍎', group: 3, isGood: true,  name: 'แอปเปิล' },
    { emoji: '🍌', group: 3, isGood: true,  name: 'กล้วย' },
    { emoji: '🍇', group: 3, isGood: true,  name: 'องุ่น' },

    // หมู่ 4 โปรตีน
    { emoji: '🍗', group: 4, isGood: true,  name: 'ไก่' },
    { emoji: '🥚', group: 4, isGood: true,  name: 'ไข่' },
    { emoji: '🐟', group: 4, isGood: true,  name: 'ปลา' },

    // หมู่ 5 นม
    { emoji: '🥛', group: 5, isGood: true,  name: 'นม' },
    { emoji: '🧀', group: 5, isGood: true,  name: 'ชีส' }
  ];

  const JUNK_ITEMS = [
    { emoji: '🍩', group: 0, isGood: false, name: 'โดนัท' },
    { emoji: '🍪', group: 0, isGood: false, name: 'คุกกี้' },
    { emoji: '🍟', group: 0, isGood: false, name: 'เฟรนช์ฟราย' },
    { emoji: '🍕', group: 0, isGood: false, name: 'พิซซ่า' },
    { emoji: '🥤', group: 0, isGood: false, name: 'น้ำอัดลม' },
    { emoji: '🍰', group: 0, isGood: false, name: 'เค้ก' }
  ];

  function pickRandom() {
    // good 70% / junk 30% เป็น default
    const r = Math.random();
    const pool = r < 0.7 ? GOOD_ITEMS : JUNK_ITEMS;
    const idx = (Math.random() * pool.length) | 0;
    return pool[idx];
  }

  const mod = {
    GOOD_ITEMS,
    JUNK_ITEMS,
    pickRandom
  };

  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.foodGroupsEmoji = mod;

})(window);
