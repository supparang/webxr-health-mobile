// vr-groups/emoji-image.js
// สร้าง sprite emoji เป็นรูปภาพ แล้วให้ GameEngine เอาไปใช้เป็นเป้า

(function (ns) {
  'use strict';

  // ---- กำหนดหมู่ 1–5 + power-ups แบบมี emoji หลายแบบต่อหมู่ ----
  const RAW_GROUPS = [
    {
      id: 1,
      label: 'หมู่ 1 ข้าว-แป้ง',
      color: '#f97316',
      emojis: ['🍚','🍙','🍞','🥨','🥯']
    },
    {
      id: 2,
      label: 'หมู่ 2 โปรตีน',
      color: '#22c55e',
      emojis: ['🍗','🍖','🥚','🧀','🐟']
    },
    {
      id: 3,
      label: 'หมู่ 3 ผัก',
      color: '#22c55e',
      emojis: ['🥦','🥕','🥒','🥬','🍅']
    },
    {
      id: 4,
      label: 'หมู่ 4 ผลไม้',
      color: '#eab308',
      emojis: ['🍎','🍌','🍇','🍉','🍓']
    },
    {
      id: 5,
      label: 'หมู่ 5 นม-ไขมันดี',
      color: '#0ea5e9',
      emojis: ['🥛','🧈','🥜','🥥','🧃']
    }
    // ถ้าอยากมีเป้าประเภทพิเศษ เช่น ⭐ / 💎 เพิ่มเป็น id 6,7 ได้
  ];

  // ---- helper: วาด emoji ลง canvas → dataURL ----
  const emojiCache = {};

  function makeEmojiTexture(emoji, size) {
    size = size || 256;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    // พื้นหลังใส (transparent)
    // ถ้าอยากให้มีแผ่นกลม ๆ ด้านหลังก็เติมได้
    // ctx.fillStyle = 'rgba(0,0,0,0)';
    // ctx.fillRect(0,0,size,size);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = (size * 0.7) + 'px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';

    ctx.fillText(emoji, size / 2, size / 2 + size * 0.06);

    return canvas.toDataURL('image/png');
  }

  function getEmojiImage(emoji) {
    if (emojiCache[emoji]) return emojiCache[emoji];
    const url = makeEmojiTexture(emoji, 256);
    emojiCache[emoji] = url;
    return url;
  }

  // ---- เตรียมรายการหมู่แบบพื้นฐาน (ใช้กับ legend / สรุปผล) ----
  const baseGroups = RAW_GROUPS.map(g => {
    const em = g.emojis && g.emojis.length ? g.emojis[0] : '❓';
    return {
      id: g.id,
      label: g.label,
      color: g.color,
      emoji: em,
      img: getEmojiImage(em),
      emojiChoices: g.emojis.slice()
    };
  });

  // ---- เลือกหมู่แบบสุ่ม + สุ่ม emoji ในหมู่นั้นทุกครั้งที่ spawn ----
  function pickRandomGroup() {
    const g = baseGroups[Math.floor(Math.random() * baseGroups.length)];
    const choices = g.emojiChoices && g.emojiChoices.length ? g.emojiChoices : [g.emoji];
    const emoji = choices[Math.floor(Math.random() * choices.length)];
    return {
      id: g.id,
      label: g.label,
      color: g.color,
      emoji: emoji,
      img: getEmojiImage(emoji)
    };
  }

  ns.foodGroupsEmoji = {
    all: baseGroups,         // ใช้โชว์ legend / HUD
    pickRandomGroup          // ใช้ตอนสร้างเป้าแต่ละลูก
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));