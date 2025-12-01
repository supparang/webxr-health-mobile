// vr-groups/emoji-image.js
// ข้อมูลหมู่อาหาร 1–5 + ลิงก์รูป emoji (Twemoji) สำหรับใช้บนเป้า

(function (ns) {
  'use strict';

  ns = ns || (window.GAME_MODULES = window.GAME_MODULES || {});

  const T_BASE = 'https://twemoji.maxcdn.com/v/latest/svg/';

  const GROUP_TYPES = [
    {
      id: 1,
      label: 'หมู่ 1 ข้าว-แป้ง',
      color: '#22c55e',
      emoji: '🍚',
      img: T_BASE + '1f35a.svg',
      emojis: [
        { emoji: '🍚', img: T_BASE + '1f35a.svg' },
        { emoji: '🍙', img: T_BASE + '1f359.svg' },
        { emoji: '🍞', img: T_BASE + '1f35e.svg' },
        { emoji: '🥖', img: T_BASE + '1f956.svg' },
        { emoji: '🥨', img: T_BASE + '1f968.svg' }
      ]
    },
    {
      id: 2,
      label: 'หมู่ 2 เนื้อ-โปรตีน',
      color: '#eab308',
      emoji: '🍗',
      img: T_BASE + '1f357.svg',
      emojis: [
        { emoji: '🍗', img: T_BASE + '1f357.svg' },
        { emoji: '🥚', img: T_BASE + '1f95a.svg' },
        { emoji: '🥩', img: T_BASE + '1f969.svg' },
        { emoji: '🍣', img: T_BASE + '1f363.svg' },
        { emoji: '🥜', img: T_BASE + '1f95c.svg' }
      ]
    },
    {
      id: 3,
      label: 'หมู่ 3 ผัก',
      color: '#16a34a',
      emoji: '🥦',
      img: T_BASE + '1f966.svg',
      emojis: [
        { emoji: '🥦', img: T_BASE + '1f966.svg' },
        { emoji: '🥕', img: T_BASE + '1f955.svg' },
        { emoji: '🥒', img: T_BASE + '1f952.svg' },
        { emoji: '🧄', img: T_BASE + '1f9c4.svg' },
        { emoji: '🧅', img: T_BASE + '1f9c5.svg' }
      ]
    },
    {
      id: 4,
      label: 'หมู่ 4 ผลไม้',
      color: '#f97316',
      emoji: '🍎',
      img: T_BASE + '1f34e.svg',
      emojis: [
        { emoji: '🍎', img: T_BASE + '1f34e.svg' },
        { emoji: '🍌', img: T_BASE + '1f34c.svg' },
        { emoji: '🍉', img: T_BASE + '1f349.svg' },
        { emoji: '🍇', img: T_BASE + '1f347.svg' },
        { emoji: '🍓', img: T_BASE + '1f353.svg' }
      ]
    },
    {
      id: 5,
      label: 'หมู่ 5 นม-ผลิตภัณฑ์นม',
      color: '#38bdf8',
      emoji: '🥛',
      img: T_BASE + '1f95b.svg',
      emojis: [
        { emoji: '🥛', img: T_BASE + '1f95b.svg' },
        { emoji: '🧀', img: T_BASE + '1f9c0.svg' },
        { emoji: '🍦', img: T_BASE + '1f366.svg' },
        { emoji: '🍨', img: T_BASE + '1f368.svg' },
        { emoji: '🍧', img: T_BASE + '1f367.svg' }
      ]
    }
  ];

  // สุ่มเมนูย่อยในหมู่
  function pickRandomGroup() {
    if (!GROUP_TYPES.length) return null;
    const t = GROUP_TYPES[Math.floor(Math.random() * GROUP_TYPES.length)];
    const list = t.emojis && t.emojis.length ? t.emojis : [{ emoji: t.emoji, img: t.img }];
    const item = list[Math.floor(Math.random() * list.length)];

    return {
      id: t.id,
      label: t.label,
      color: t.color,
      emoji: item.emoji,
      img: item.img
    };
  }

  function getGroupTypeById(id) {
    id = parseInt(id, 10);
    return GROUP_TYPES.find(g => g.id === id) || null;
  }

  ns.foodGroupsEmoji = {
    all: GROUP_TYPES,   // legend + groupStats
    types: GROUP_TYPES,
    pickRandomGroup,
    getGroupTypeById
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
