// === /herohealth/vr-groups/emoji-image.js ===
// Emoji + Food Groups helper (non-module)
// ใช้ได้ทั้งโหมด Food Groups / Good vs Junk / Hydration
//  - emojiImage.pick(kind)  → คืน emoji ตัวหนึ่ง
//  - emojiImage.getInfo(ch) → คืน metadata { group, isGood, type, label }
//
// kind ที่รองรับ (อย่างน้อย):
//   'good'     : อาหารดีทุกหมู่
//   'junk'     : อาหารขยะ / ขนม
//   'star'     : ไอเท็มดาว (คะแนน+fever)
//   'diamond'  : ไอเท็มเพชร (คะแนน/feverสูง)
//   'shield'   : ไอเท็มเกราะ
//   'good:grain' | 'good:protein' | 'good:veggie' | 'good:fruit' | 'good:milk'
//      → อาหารดีเฉพาะหมู่
//
// GameEngine ของ Groups ตอนนี้เรียกแค่ pick('good') / pick('junk')
// ถ้าไม่มีโมดูลนี้จะ fallback ไปใช้ GOOD_EMOJI / JUNK_EMOJI ภายในเอง

(function (ns) {
  'use strict';

  // type: 'food' | 'star' | 'diamond' | 'shield'
  // group:
  //   - grain   : ข้าว-แป้ง
  //   - protein : เนื้อ-ถั่ว-ไข่
  //   - veggie  : ผัก
  //   - fruit   : ผลไม้
  //   - milk    : นม
  //   - junk    : อาหารขยะ
  //   - power   : ไอเท็มพิเศษ
  const ITEMS = [
    // ----- Grain / ข้าว-แป้ง -----
    { ch: '🍚', group: 'grain',  isGood: true,  type: 'food', label: 'ข้าวสวย' },
    { ch: '🍞', group: 'grain',  isGood: true,  type: 'food', label: 'ขนมปัง' },
    { ch: '🍙', group: 'grain',  isGood: true,  type: 'food', label: 'ข้าวปั้น' },
    { ch: '🥐', group: 'grain',  isGood: true,  type: 'food', label: 'ขนมปังอบ' },

    // ----- Protein / เนื้อ-ถั่ว-ไข่ -----
    { ch: '🍳', group: 'protein', isGood: true, type: 'food', label: 'ไข่ดาว' },
    { ch: '🍗', group: 'protein', isGood: true, type: 'food', label: 'ไก่อบ' },
    { ch: '🥩', group: 'protein', isGood: true, type: 'food', label: 'สเต็กเนื้อ' },
    { ch: '🥜', group: 'protein', isGood: true, type: 'food', label: 'ถั่ว' },

    // ----- Veggie / ผัก -----
    { ch: '🥦', group: 'veggie', isGood: true, type: 'food', label: 'บรอกโคลี' },
    { ch: '🥕', group: 'veggie', isGood: true, type: 'food', label: 'แครอท' },
    { ch: '🥬', group: 'veggie', isGood: true, type: 'food', label: 'ผักใบเขียว' },
    { ch: '🥗', group: 'veggie', isGood: true, type: 'food', label: 'สลัดผัก' },

    // ----- Fruit / ผลไม้ -----
    { ch: '🍎', group: 'fruit',  isGood: true, type: 'food', label: 'แอปเปิล' },
    { ch: '🍌', group: 'fruit',  isGood: true, type: 'food', label: 'กล้วย' },
    { ch: '🍇', group: 'fruit',  isGood: true, type: 'food', label: 'องุ่น' },
    { ch: '🍉', group: 'fruit',  isGood: true, type: 'food', label: 'แตงโม' },

    // ----- Milk / นม -----
    { ch: '🥛', group: 'milk',   isGood: true, type: 'food', label: 'นม' },
    { ch: '🧀', group: 'milk',   isGood: true, type: 'food', label: 'ชีส' },
    { ch: '🍨', group: 'milk',   isGood: true, type: 'food', label: 'โยเกิร์ตแข็งเบา ๆ' },

    // ----- Junk / ขนม-น้ำหวาน -----
    { ch: '🍩', group: 'junk',   isGood: false, type: 'food', label: 'โดนัท' },
    { ch: '🍰', group: 'junk',   isGood: false, type: 'food', label: 'เค้ก' },
    { ch: '🍫', group: 'junk',   isGood: false, type: 'food', label: 'ช็อกโกแลตแท่ง' },
    { ch: '🍟', group: 'junk',   isGood: false, type: 'food', label: 'เฟรนช์ฟรายส์' },
    { ch: '🍕', group: 'junk',   isGood: false, type: 'food', label: 'พิซซ่า' },
    { ch: '🥤', group: 'junk',   isGood: false, type: 'food', label: 'น้ำอัดลม' },
    { ch: '🍭', group: 'junk',   isGood: false, type: 'food', label: 'ลูกอม' },

    // ----- Power items (star / diamond / shield) -----
    { ch: '⭐', group: 'power',  isGood: true, type: 'star',    label: 'เมนูดาวพิเศษ' },
    { ch: '💎', group: 'power',  isGood: true, type: 'diamond', label: 'เมนูคุณค่าเยี่ยม' },
    { ch: '🛡️', group: 'power', isGood: true, type: 'shield',  label: 'เมนูเสริมเกราะสุขภาพ' }
  ];

  // สร้าง index เพื่อให้ค้นย้อนกลับจาก emoji → info ได้เร็ว
  const BY_CHAR = {};
  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    BY_CHAR[it.ch] = it;
  }

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function filterByKind(kind) {
    const k = String(kind || 'any').toLowerCase();
    const parts = k.split(':');     // เช่น 'good:grain'
    const base  = parts[0];
    const sub   = parts[1] || '';

    let list = ITEMS;

    if (base === 'good') {
      list = ITEMS.filter(function (it) {
        return it.type === 'food' && it.isGood;
      });
    } else if (base === 'junk') {
      list = ITEMS.filter(function (it) {
        return it.type === 'food' && !it.isGood;
      });
    } else if (base === 'star') {
      list = ITEMS.filter(function (it) { return it.type === 'star'; });
    } else if (base === 'diamond') {
      list = ITEMS.filter(function (it) { return it.type === 'diamond'; });
    } else if (base === 'shield') {
      list = ITEMS.filter(function (it) { return it.type === 'shield'; });
    } else if (base === 'any') {
      list = ITEMS.slice();
    }

    // ถ้ามีระบุ group ต่อท้าย เช่น good:protein
    if (sub) {
      list = list.filter(function (it) {
        return it.group === sub;
      });
    }

    if (!list.length) {
      // กันพัง — ถ้า filter แล้วไม่เหลืออะไร ให้กลับไปใช้ ITEMS ทั้งหมด
      list = ITEMS.slice();
    }

    return list;
  }

  // คืน emoji ตัวหนึ่ง
  function pick(kind) {
    const list = filterByKind(kind);
    return list[randInt(list.length)].ch;
  }

  // คืน metadata ของ emoji นั้น
  function getInfo(ch) {
    return BY_CHAR[ch] || null;
  }

  // utility เล็ก ๆ เพิ่มเติม (เผื่อใช้ในอนาคต)
  function isGood(ch) {
    const info = getInfo(ch);
    return info ? !!info.isGood : false;
  }

  function getGroup(ch) {
    const info = getInfo(ch);
    return info ? info.group : null;
  }

  // expose ออกไปให้ GameEngine ใช้
  const api = {
    pick,        // pick('good'), pick('junk'), pick('good:fruit'), pick('star') ฯลฯ
    getInfo,     // getInfo('🍌') → { group:'fruit', isGood:true, ... }
    isGood,
    getGroup
  };

  ns.emojiImage = api;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
