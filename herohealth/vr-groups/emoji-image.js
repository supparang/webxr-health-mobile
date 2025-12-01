// vr-groups/emoji-image.js
// กำหนดข้อมูล "หมู่ 1–5" สำหรับ Food Groups VR (หมู่ละหลายเมนู)
// - all  = ใช้กับ UI / สถิติ (มีแค่ 5 หมู่)
// - pickRandomGroup() = สุ่มเมนูย่อยในหมู่นั้น ๆ

(function (ns) {
  'use strict';

  ns = ns || (window.GAME_MODULES = window.GAME_MODULES || {});

  // ===== หมู่หลัก + emoji ย่อยแต่ละหมู่ =====
  const GROUP_TYPES = [
    {
      id: 1,
      label: 'หมู่ 1 ข้าว-แป้ง',
      color: '#22c55e',
      emojis: ['🍚','🍙','🍞','🥖','🥨']
    },
    {
      id: 2,
      label: 'หมู่ 2 เนื้อ-โปรตีน',
      color: '#eab308',
      emojis: ['🍗','🥚','🥩','🍣','🥜']
    },
    {
      id: 3,
      label: 'หมู่ 3 ผัก',
      color: '#16a34a',
      emojis: ['🥦','🥕','🥒','🧄','🧅']
    },
    {
      id: 4,
      label: 'หมู่ 4 ผลไม้',
      color: '#f97316',
      emojis: ['🍎','🍌','🍉','🍇','🍓']
    },
    {
      id: 5,
      label: 'หมู่ 5 นม-ผลิตภัณฑ์นม',
      color: '#38bdf8',
      emojis: ['🥛','🧀','🍦','🍨','🍧']
    }
  ];

  // ให้แต่ละหมู่มี emoji ตัวแทน (ตัวแรก) สำหรับใช้ใน legend / สถิติ
  GROUP_TYPES.forEach(function (g) {
    g.emoji = g.emojis[0] || '🍽️';
  });

  // ===== ฟังก์ชันสุ่มเมนูย่อยในหมู่ =====
  function pickRandomGroup() {
    if (!GROUP_TYPES.length) return null;
    const typeIdx = Math.floor(Math.random() * GROUP_TYPES.length);
    const type = GROUP_TYPES[typeIdx];

    const list = type.emojis || [];
    const emIdx = list.length ? Math.floor(Math.random() * list.length) : 0;
    const emoji = list[emIdx] || type.emoji;

    // คืน object สำหรับใช้สร้างเป้า
    return {
      id: type.id,
      label: type.label,
      color: type.color,
      emoji: emoji,
      img: ''   // ถ้ามี sprite PNG ค่อยมาใส่ทีหลัง
    };
  }

  function getGroupTypeById(id) {
    id = parseInt(id, 10);
    return GROUP_TYPES.find(g => g.id === id) || null;
  }

  // export เข้า namespace:
  //  - all   → มีแค่ 5 หมู่ (ใช้กับ resetGroupStats + legend)
  //  - types → alias ชื่อเดิม ถ้าอยากใช้ต่อ
  ns.foodGroupsEmoji = {
    all: GROUP_TYPES,       // สำหรับ UI / groupStats (5 หมู่)
    types: GROUP_TYPES,
    pickRandomGroup,
    getGroupTypeById
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
