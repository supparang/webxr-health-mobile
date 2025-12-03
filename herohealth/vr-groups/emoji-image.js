// vr-groups/emoji-image.js
// กำหนด emoji สำหรับหมู่อาหาร + flag isGood
(function (ns) {
  'use strict';

  // หมู่หลัก (อาหารดี)
  const MAIN_GOOD = [
    // หมู่ 1: ข้าว-แป้ง ธัญพืช
    { id: 1,  group: 1, label: 'ข้าว-แป้ง',    emoji: '🍚', color: '#facc15', isGood: true },
    { id: 2,  group: 1, label: 'ขนมปังโฮลวีต', emoji: '🍞', color: '#facc15', isGood: true },
    { id: 3,  group: 1, label: 'เส้นหมี่ข้าวกล้อง', emoji: '🍜', color: '#facc15', isGood: true },
    { id: 4,  group: 1, label: 'มันฝรั่ง',      emoji: '🥔', color: '#facc15', isGood: true },
    { id: 5,  group: 1, label: 'ข้าวโพด',      emoji: '🌽', color: '#facc15', isGood: true },

    // หมู่ 2: ผัก
    { id: 10, group: 2, label: 'ผักใบเขียว',   emoji: '🥬', color: '#22c55e', isGood: true },
    { id: 11, group: 2, label: 'บรอกโคลี',     emoji: '🥦', color: '#22c55e', isGood: true },
    { id: 12, group: 2, label: 'แครอท',        emoji: '🥕', color: '#22c55e', isGood: true },
    { id: 13, group: 2, label: 'มะเขือเทศ',    emoji: '🍅', color: '#22c55e', isGood: true },
    { id: 14, group: 2, label: 'สลัดผัก',      emoji: '🥗', color: '#22c55e', isGood: true },

    // หมู่ 3: ผลไม้
    { id: 20, group: 3, label: 'แตงโม',        emoji: '🍉', color: '#f97316', isGood: true },
    { id: 21, group: 3, label: 'สตรอว์เบอร์รี', emoji: '🍓', color: '#f97316', isGood: true },
    { id: 22, group: 3, label: 'กล้วย',        emoji: '🍌', color: '#f97316', isGood: true },
    { id: 23, group: 3, label: 'ส้ม',          emoji: '🍊', color: '#f97316', isGood: true },
    { id: 24, group: 3, label: 'องุ่น',        emoji: '🍇', color: '#f97316', isGood: true },

    // หมู่ 4: โปรตีน
    { id: 30, group: 4, label: 'ปลา',          emoji: '🐟', color: '#38bdf8', isGood: true },
    { id: 31, group: 4, label: 'ไก่',          emoji: '🍗', color: '#38bdf8', isGood: true },
    { id: 32, group: 4, label: 'เต้าหู้',      emoji: '🧈', color: '#38bdf8', isGood: true },
    { id: 33, group: 4, label: 'ถั่ว',         emoji: '🫘', color: '#38bdf8', isGood: true },
    { id: 34, group: 4, label: 'ไข่',          emoji: '🥚', color: '#38bdf8', isGood: true },

    // หมู่ 5: นม
    { id: 40, group: 5, label: 'นม',           emoji: '🥛', color: '#a855f7', isGood: true },
    { id: 41, group: 5, label: 'โยเกิร์ต',     emoji: '🍦', color: '#a855f7', isGood: true },
    { id: 42, group: 5, label: 'ชีส',          emoji: '🧀', color: '#a855f7', isGood: true },
    { id: 43, group: 5, label: 'นมถั่วเหลือง', emoji: '🥤', color: '#a855f7', isGood: true },
    { id: 44, group: 5, label: 'นมเปรี้ยวไขมันต่ำ', emoji: '🧃', color: '#a855f7', isGood: true }
  ];

  // กลุ่ม “อาหารควรลด” / junk / หวาน มัน เค็ม
  const BAD_FOODS = [
    { id: 100, group: 9, label: 'น้ำอัดลม',    emoji: '🥤', color: '#ef4444', isGood: false },
    { id: 101, group: 9, label: 'ชานมไข่มุก', emoji: '🧋', color: '#ef4444', isGood: false },
    { id: 102, group: 9, label: 'ของทอด',     emoji: '🍟', color: '#ef4444', isGood: false },
    { id: 103, group: 9, label: 'พิซซ่า',     emoji: '🍕', color: '#ef4444', isGood: false },
    { id: 104, group: 9, label: 'โดนัท',      emoji: '🍩', color: '#ef4444', isGood: false }
  ];

  const ALL = MAIN_GOOD.concat(BAD_FOODS);

  function pickRandom(arr) {
    const n = arr.length;
    if (!n) return null;
    const idx = Math.floor(Math.random() * n);
    return arr[idx];
  }

  ns.foodGroupsEmoji = {
    all: ALL,

    // ใช้สุ่มแบบ simple: good:bad ≈ 3:1
    pickRandomGroup() {
      // 75% โอกาสได้ของดี 25% ได้ของไม่ดี
      const useGood = Math.random() < 0.75;
      const pool = useGood ? MAIN_GOOD : ALL; // ALL ทำให้มี bad ปนอยู่, แต่ good เยอะกว่า
      return pickRandom(pool);
    }
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
