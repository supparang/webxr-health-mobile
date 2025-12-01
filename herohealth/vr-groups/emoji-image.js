// vr-groups/emoji-image.js
// กำหนดข้อมูล "หมู่ 1–5" สำหรับ Food Groups VR

(function (ns) {
  'use strict';

  // ถ้ามี namespace อยู่แล้วก็ใช้ต่อ ไม่งั้นสร้างใหม่
  ns = ns || (window.GAME_MODULES = window.GAME_MODULES || {});

  // ===== รายการหมู่อาหาร (แก้ emoji / สี / label ได้เลย) =====
  const GROUPS = [
    {
      id: 1,
      label: 'หมู่ 1 ข้าว-แป้ง',
      emoji: '🍚',
      color: '#22c55e',   // เขียวอ่อน
      img: ''             // ถ้ามีรูปเช่น '#fg-g1' ใส่ตรงนี้
    },
    {
      id: 2,
      label: 'หมู่ 2 เนื้อ-โปรตีน',
      emoji: '🍗',
      color: '#eab308',   // เหลือง
      img: ''
    },
    {
      id: 3,
      label: 'หมู่ 3 ผัก',
      emoji: '🥦',
      color: '#16a34a',
      img: ''
    },
    {
      id: 4,
      label: 'หมู่ 4 ผลไม้',
      emoji: '🍉',
      color: '#f97316',
      img: ''
    },
    {
      id: 5,
      label: 'หมู่ 5 นม',
      emoji: '🥛',
      color: '#38bdf8',
      img: ''
    }
  ];

  // ===== ฟังก์ชันสุ่มหมู่ =====
  function pickRandomGroup() {
    if (!GROUPS.length) return null;
    const idx = Math.floor(Math.random() * GROUPS.length);
    return GROUPS[idx];
  }

  function getById(id) {
    id = parseInt(id, 10);
    return GROUPS.find(g => g.id === id) || null;
  }

  // export เข้า namespace กลาง
  ns.foodGroupsEmoji = {
    all: GROUPS,
    pickRandomGroup,
    getById
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
