// vr-groups/emoji-image.js
(function (ns) {
  'use strict';

  // ใช้ Twemoji PNG (ผ่าน jsDelivr CDN)
  // หมู่ 1–5: 🍚 🍗 🥛 🥦 🍌
  const GROUPS = [
    {
      id: 1,
      emoji: '🍚',
      label: 'ข้าว-แป้ง',
      color: '#f97316',
      img: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/1f35a.png' // 🍚
    },
    {
      id: 2,
      emoji: '🍗',
      label: 'เนื้อ-ถั่ว',
      color: '#22c55e',
      img: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/1f357.png' // 🍗
    },
    {
      id: 3,
      emoji: '🥛',
      label: 'นม',
      color: '#38bdf8',
      img: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/1f95b.png' // 🥛
    },
    {
      id: 4,
      emoji: '🥦',
      label: 'ผัก',
      color: '#16a34a',
      img: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/1f966.png' // 🥦
    },
    {
      id: 5,
      emoji: '🍌',
      label: 'ผลไม้',
      color: '#eab308',
      img: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14/assets/72x72/1f34c.png' // 🍌
    }
  ];

  function pickRandomGroup() {
    return GROUPS[Math.floor(Math.random() * GROUPS.length)];
  }

  function getById(id) {
    return GROUPS.find(g => g.id === id) || null;
  }

  ns.foodGroupsEmoji = {
    all: groups,
    pickRandomGroup: function () {
      return groups[Math.floor(Math.random() * groups.length)];
    }
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
