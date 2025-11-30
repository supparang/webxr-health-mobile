// vr-goodjunk/emoji-image.js
(function (ns) {
  'use strict';

  const GROUPS = [
    { id: 1, emoji: '🍚', label: 'ข้าว-แป้ง',    color: '#f97316' },
    { id: 2, emoji: '🍗', label: 'เนื้อ-ถั่ว',   color: '#22c55e' },
    { id: 3, emoji: '🥛', label: 'นม',           color: '#38bdf8' },
    { id: 4, emoji: '🥦', label: 'ผัก',          color: '#16a34a' },
    { id: 5, emoji: '🍌', label: 'ผลไม้',        color: '#eab308' }
  ];

  function pickRandomGroup() {
    return GROUPS[Math.floor(Math.random() * GROUPS.length)];
  }

  function getById(id) {
    return GROUPS.find(g => g.id === id) || null;
  }

  ns.foodGroupsEmoji = {
    pickRandomGroup,
    getById,
    all: GROUPS
  };
})(window.GAME_MODULES);
