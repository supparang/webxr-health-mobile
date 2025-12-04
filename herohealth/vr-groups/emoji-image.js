// === /herohealth/vr-groups/emoji-image.js ===
// Food Groups VR — Emoji → Canvas → dataURL (non-module)
// ใช้ร่วมกับ GameEngine.js (item.url)

(function (ns) {
  'use strict';

  // วาด emoji ลง canvas แล้วคืนเป็น dataURL
  function makeEmojiTexture(emojiChar) {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, size, size);

    // ฟอนต์ emoji ทั่วไป
    ctx.font = '200px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // เงานิดหน่อยให้ดูฟู
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur  = 28;
    ctx.fillText(emojiChar, size / 2, size / 2 + 8);
    ctx.restore();

    // ทับอีกครั้งให้สีแน่น
    ctx.fillText(emojiChar, size / 2, size / 2 + 8);

    return canvas.toDataURL('image/png');
  }

  // ------------------------------------------------------------------
  // ข้อมูลกลุ่มอาหาร (Good = 5 หมู่, Bad = ของที่ควรลด)
  // group: 1–5 = หมู่หลัก, 9 = ของหวาน/ของมันของทอด
  // ------------------------------------------------------------------

  const GOOD = [
    // หมู่ 1 ข้าว-แป้ง
    { emoji: '🍚', group: 1, isGood: true, name: 'ข้าวสวย' },
    { emoji: '🍞', group: 1, isGood: true, name: 'ขนมปัง' },
    { emoji: '🍜', group: 1, isGood: true, name: 'ก๋วยเตี๋ยว' },
    { emoji: '🥔', group: 1, isGood: true, name: 'มันฝรั่ง' },
    { emoji: '🌽', group: 1, isGood: true, name: 'ข้าวโพด' },

    // หมู่ 2 ผัก
    { emoji: '🥬', group: 2, isGood: true, name: 'ผักใบเขียว' },
    { emoji: '🥦', group: 2, isGood: true, name: 'บรอกโคลี' },
    { emoji: '🥕', group: 2, isGood: true, name: 'แครอท' },
    { emoji: '🍅', group: 2, isGood: true, name: 'มะเขือเทศ' },
    { emoji: '🥗', group: 2, isGood: true, name: 'สลัดผัก' },

    // หมู่ 3 ผลไม้
    { emoji: '🍉', group: 3, isGood: true, name: 'แตงโม' },
    { emoji: '🍓', group: 3, isGood: true, name: 'สตรอว์เบอร์รี' },
    { emoji: '🍌', group: 3, isGood: true, name: 'กล้วย' },
    { emoji: '🍊', group: 3, isGood: true, name: 'ส้ม' },
    { emoji: '🍇', group: 3, isGood: true, name: 'องุ่น' },

    // หมู่ 4 เนื้อสัตว์-ถั่ว-ไข่
    { emoji: '🐟', group: 4, isGood: true, name: 'ปลา' },
    { emoji: '🍗', group: 4, isGood: true, name: 'ไก่' },
    { emoji: '🫘', group: 4, isGood: true, name: 'ถั่ว' },
    { emoji: '🥚', group: 4, isGood: true, name: 'ไข่' },
    { emoji: '🥩', group: 4, isGood: true, name: 'เนื้อแดง' },

    // หมู่ 5 นม-ผลิตภัณฑ์จากนม
    { emoji: '🥛', group: 5, isGood: true, name: 'นม' },
    { emoji: '🧀', group: 5, isGood: true, name: 'ชีส' },
    { emoji: '🍦', group: 5, isGood: true, name: 'ไอศกรีม' },
    { emoji: '🧃', group: 5, isGood: true, name: 'นมเปรี้ยว/โยเกิร์ต' },
    { emoji: '🥤', group: 5, isGood: true, name: 'นมรสหวาน' }
  ];

  const BAD = [
    { emoji: '🍟', group: 9, isGood: false, name: 'มันฝรั่งทอด' },
    { emoji: '🍔', group: 9, isGood: false, name: 'เบอร์เกอร์' },
    { emoji: '🍕', group: 9, isGood: false, name: 'พิซซ่า' },
    { emoji: '🍩', group: 9, isGood: false, name: 'โดนัท' },
    { emoji: '🍫', group: 9, isGood: false, name: 'ช็อกโกแลต' },
    { emoji: '🧋', group: 9, isGood: false, name: 'ชานมไข่มุก' },
    { emoji: '🥤', group: 9, isGood: false, name: 'น้ำอัดลม' }
  ];

  const ALL = GOOD.concat(BAD);

  // สร้าง texture ล่วงหน้าให้ทุกตัว
  ALL.forEach(item => {
    try {
      item.url = makeEmojiTexture(item.emoji);
    } catch (e) {
      console.warn('[GroupsVR] makeEmojiTexture error', item.emoji, e);
      item.url = null;
    }
  });

  // random 75% ของดี / 25% มีของไม่ดีปน
  function pickRandom() {
    const r = Math.random();
    if (r < 0.75) {
      return GOOD[Math.floor(Math.random() * GOOD.length)];
    }
    return ALL[Math.floor(Math.random() * ALL.length)];
  }

  ns.foodGroupsEmoji = {
    good: GOOD,
    bad: BAD,
    all: ALL,
    pickRandom
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
