// vr-groups/emoji-image.js
// เก็บ emoji ของอาหารแต่ละหมู่ + helper ให้ GameEngine ใช้

(function (ns) {
  'use strict';

  ns = ns || (window.GAME_MODULES = window.GAME_MODULES || {});

  // ใช้ไอเดียเหมือน GOOD / BAD ใน Hydration
  const G1 = ['🍚', '🍙', '🍞', '🥖', '🥨'];            // หมู่ 1 ข้าว-แป้ง
  const G2 = ['🍗', '🥚', '🥩', '🍣', '🥜'];            // หมู่ 2 เนื้อ-โปรตีน
  const G3 = ['🥦', '🥕', '🥒', '🧄', '🧅'];            // หมู่ 3 ผัก
  const G4 = ['🍎', '🍌', '🍉', '🍇', '🍓'];            // หมู่ 4 ผลไม้
  const G5 = ['🥛', '🧀', '🍦', '🍨', '🍧'];            // หมู่ 5 นม-ผลิตภัณฑ์นม

  const GROUPS = [
    { id: 1, label: 'หมู่ 1 ข้าว-แป้ง',       color: '#22c55e', emojiList: G1, legendEmoji: '🍚' },
    { id: 2, label: 'หมู่ 2 เนื้อ-โปรตีน',    color: '#eab308', emojiList: G2, legendEmoji: '🍗' },
    { id: 3, label: 'หมู่ 3 ผัก',             color: '#16a34a', emojiList: G3, legendEmoji: '🥦' },
    { id: 4, label: 'หมู่ 4 ผลไม้',           color: '#f97316', emojiList: G4, legendEmoji: '🍎' },
    { id: 5, label: 'หมู่ 5 นม-ผลิตภัณฑ์นม',  color: '#38bdf8', emojiList: G5, legendEmoji: '🥛' }
  ];

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ใช้ตอน spawn เป้า
  function pickRandomGroup() {
    const g = pickRandom(GROUPS);
    return {
      id: g.id,
      label: g.label,
      color: g.color,
      emoji: pickRandom(g.emojiList),  // ตัวที่จะขึ้นบนเป้าจริง
      img: null                         // ไม่ใช้รูปภาพแล้ว
    };
  }

  function getGroupTypeById(id) {
    id = parseInt(id, 10);
    return GROUPS.find(g => g.id === id) || null;
  }

  // ใช้กับ legend + groupStats: ให้มี emoji ตัวแทน 1 ตัวต่อหมู่
  const ALL_FOR_LEGEND = GROUPS.map(g => ({
    id: g.id,
    label: g.label,
    color: g.color,
    emoji: g.legendEmoji,
    img: null
  }));

  ns.foodGroupsEmoji = {
    all: ALL_FOR_LEGEND,
    groups: GROUPS,
    pickRandomGroup,
    getGroupTypeById
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
