// vr-groups/emoji-image.js
// ข้อมูลหมู่อาหาร 1–5 + ลิงก์รูป emoji (Twemoji PNG) สำหรับใช้บนเป้า

(function (ns) {
  'use strict';

  ns = ns || (window.GAME_MODULES = window.GAME_MODULES || {});

  // ใช้ Twemoji จาก CDNJS แทน maxcdn (อันเก่ามัก 404 แล้ว)
  const T_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/';

  const GROUP_TYPES = [
    {
      id: 1,
      label: 'หมู่ 1 ข้าว-แป้ง',
      color: '#22c55e',
      legendEmoji: '🍚',
      emojis: [
        { emoji: '🍚', code: '1f35a' },
        { emoji: '🍙', code: '1f359' },
        { emoji: '🍞', code: '1f35e' },
        { emoji: '🥖', code: '1f956' },
        { emoji: '🥨', code: '1f968' }
      ]
    },
    {
      id: 2,
      label: 'หมู่ 2 เนื้อ-โปรตีน',
      color: '#eab308',
      legendEmoji: '🍗',
      emojis: [
        { emoji: '🍗', code: '1f357' },
        { emoji: '🥚', code: '1f95a' },
        { emoji: '🥩', code: '1f969' },
        { emoji: '🍣', code: '1f363' },
        { emoji: '🥜', code: '1f95c' }
      ]
    },
    {
      id: 3,
      label: 'หมู่ 3 ผัก',
      color: '#16a34a',
      legendEmoji: '🥦',
      emojis: [
        { emoji: '🥦', code: '1f966' },
        { emoji: '🥕', code: '1f955' },
        { emoji: '🥒', code: '1f952' },
        { emoji: '🧄', code: '1f9c4' },
        { emoji: '🧅', code: '1f9c5' }
      ]
    },
    {
      id: 4,
      label: 'หมู่ 4 ผลไม้',
      color: '#f97316',
      legendEmoji: '🍎',
      emojis: [
        { emoji: '🍎', code: '1f34e' },
        { emoji: '🍌', code: '1f34c' },
        { emoji: '🍉', code: '1f349' },
        { emoji: '🍇', code: '1f347' },
        { emoji: '🍓', code: '1f353' }
      ]
    },
    {
      id: 5,
      label: 'หมู่ 5 นม-ผลิตภัณฑ์นม',
      color: '#38bdf8',
      legendEmoji: '🥛',
      emojis: [
        { emoji: '🥛', code: '1f95b' },
        { emoji: '🧀', code: '1f9c0' },
        { emoji: '🍦', code: '1f366' },
        { emoji: '🍨', code: '1f368' },
        { emoji: '🍧', code: '1f367' }
      ]
    }
  ];

  function pngUrl(code) {
    // code เช่น '1f35a' → .../1f35a.png
    return T_BASE + code + '.png';
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ใช้ตอน spawn เป้า
  function pickRandomGroup() {
    if (!GROUP_TYPES.length) return null;
    const base = pickRandom(GROUP_TYPES);
    const item = pickRandom(base.emojis);

    return {
      id: base.id,
      label: base.label,
      color: base.color,
      emoji: item.emoji,
      img: pngUrl(item.code)   // สำคัญ: ให้ GameEngine ใช้ a-image
    };
  }

  function getGroupTypeById(id) {
    id = parseInt(id, 10);
    return GROUP_TYPES.find(g => g.id === id) || null;
  }

  // สำหรับ legend และ groupStats (ใช้ emoji ตัวแทนหมู่)
  const ALL_FOR_LEGEND = GROUP_TYPES.map(g => ({
    id: g.id,
    label: g.label,
    color: g.color,
    emoji: g.legendEmoji,
    img: pngUrl(g.emojis[0].code)
  }));

  ns.foodGroupsEmoji = {
    all: ALL_FOR_LEGEND,
    groups: GROUP_TYPES,
    pickRandomGroup,
    getGroupTypeById
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
