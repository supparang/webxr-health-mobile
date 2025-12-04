// === /herohealth/vr-groups/emoji-image.js ===
// Port จาก GoodJunk emojiImage ให้ใช้แบบ global (ไม่ใช้ ES module)
// 2025-12-05

(function (ns) {
  'use strict';https://github.com/supparang/webxr-health-mobile/blob/main/herohealth/vr-groups/emoji-image.js

  const CACHE = new Map();

  function drawEmoji(char, px = 128) {
    const key = `${char}@${px}`;
    if (CACHE.has(key)) return CACHE.get(key);

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const W = Math.round(px * dpr);
    const H = Math.round(px * dpr);
    const pad = Math.round(px * 0.30 * dpr);

    const cv = document.createElement('canvas');
    cv.width  = W + pad * 2;
    cv.height = H + pad * 2;
    const ctx = cv.getContext('2d');

    const fontPx = Math.round(px * dpr);
    const fontFamily =
      'system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';

    ctx.font = `${fontPx}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // เงาให้ฟู ๆ หน่อย
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur  = Math.round(px * 0.22 * dpr);
    ctx.fillText(char, cv.width / 2, cv.height / 2);
    ctx.restore();

    // เติมรอบสองให้สีแน่น
    ctx.fillText(char, cv.width / 2, cv.height / 2);

    const out = {
      src: cv.toDataURL('image/png'),
      w:   cv.width,
      h:   cv.height
    };
    CACHE.set(key, out);
    return out;
  }

  /**
   * emojiImage(char, scale?, px?)
   * - char  : emoji เช่น '🥦'
   * - scale : scale ของ a-image (เริ่มต้น 0.65)
   * - px    : ขนาดฐาน canvas (เริ่มต้น 128)
   */
  function emojiImage(char, scale = 0.65, px = 128) {
    const img = drawEmoji(char, px);

    const el = document.createElement('a-image');
    el.setAttribute('src', img.src);
    el.setAttribute('transparent', true);
    el.setAttribute(
      'material',
      'transparent:true; alphaTest:0.01; side:double'
    );
    el.setAttribute('scale', `${scale} ${scale} ${scale}`);
    el.dataset.emoji = char; // เผื่อดีบัก

    return el;
  }

  // expose แบบ global สำหรับ Food Groups
  ns.foodGroupsEmojiImage = {
    emojiImage,
    drawEmoji
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
