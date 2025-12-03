// === /herohealth/vr-groups/emoji-image.js ===
// Production-ready 2025-12-05
// Emoji → Canvas → Texture URL (เหมาะกับมือถือ Samsung A15)

(function (ns) {
  'use strict';

  // ---------------------------------------------------------------------
  // วาด emoji ลง Canvas แล้วแปลงเป็น dataURL ให้ A-Frame ใช้งานต่อ
  // ---------------------------------------------------------------------
  function makeEmojiTexture(emojiChar) {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, size, size);

    ctx.font = '180px "Noto Color Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emojiChar, size / 2, size / 2 + 12);

    return canvas.toDataURL('image/png');
  }

  // ---------------------------------------------------------------------
  // Data: หมวดอาหารดี (5 หมู่)
  // ---------------------------------------------------------------------
  const GOOD = [
    // หมู่ 1
    { emoji: '🍚', group: 1, isGood: true },
    { emoji: '🍞', group: 1, isGood: true },
    { emoji: '🍜', group: 1, isGood: true },
    { emoji: '🥔', group: 1, isGood: true },
    { emoji: '🌽', group: 1, isGood: true },

    // หมู่ 2
    { emoji: '🥬', group: 2, isGood: true },
    { emoji: '🥦', group: 2, isGood: true },
    { emoji: '🥕', group: 2, isGood: true },
    { emoji: '🍅', group: 2, isGood: true },
    { emoji: '🥗', group: 2, isGood: true },

    // หมู่ 3
    { emoji: '🍉', group: 3, isGood: true },
    { emoji: '🍓', group: 3, isGood: true },
    { emoji: '🍌', group: 3, isGood: true },
    { emoji: '🍊', group: 3, isGood: true },
    { emoji: '🍇', group: 3, isGood: true },

    // หมู่ 4
    { emoji: '🐟', group: 4, isGood: true },
    { emoji: '🍗', group: 4, isGood: true },
    { emoji: '🧈', group: 4, isGood: true },
    { emoji: '🫘', group: 4, isGood: true },
    { emoji: '🥚', group: 4, isGood: true },

    // หมู่ 5
    { emoji: '🥛', group: 5, isGood: true },
    { emoji: '🍦', group: 5, isGood: true },
    { emoji: '🧀', group: 5, isGood: true },
    { emoji: '🥤', group: 5, isGood: true },
    { emoji: '🧃', group: 5, isGood: true }
  ];

  // ---------------------------------------------------------------------
  // อาหารควรลด (Bad Food)
  // ---------------------------------------------------------------------
  const BAD = [
    { emoji: '🥤', group: 9, isGood: false },
    { emoji: '🧋', group: 9, isGood: false },
    { emoji: '🍟', group: 9, isGood: false },
    { emoji: '🍕', group: 9, isGood: false },
    { emoji: '🍩', group: 9, isGood: false }
  ];

  const ALL = GOOD.concat(BAD);

  // Pre-generate textures เพื่อความเร็วตอนเล่นเกม
  ALL.forEach(item => {
    item.url = makeEmojiTexture(item.emoji);
  });

  // ---------------------------------------------------------------------
  // Random pick (Good 75% / Bad 25%)
  // ---------------------------------------------------------------------
  function pickRandom() {
    const rnd = Math.random();

    // 75% → good foods
    if (rnd < 0.75) {
      return GOOD[Math.floor(Math.random() * GOOD.length)];
    }
    // 25% → ALL (มี bad เจือปน)
    return ALL[Math.floor(Math.random() * ALL.length)];
  }

  ns.foodGroupsEmoji = {
    good: GOOD,
    bad: BAD,
    all: ALL,
    pickRandom
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));