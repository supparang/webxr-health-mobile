// === /herohealth/vr/emoji-image.js ===
// วาด Emoji ลง canvas แล้วเอาไปเป็น texture ใช้กับ A-Frame
// ใช้ได้ทั้ง GoodJunk VR, Food Groups VR ฯลฯ

'use strict';

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

  // แสงเงานิดหน่อยให้ดูฟู ๆ
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur  = Math.round(px * 0.22 * dpr);
  ctx.fillText(char, cv.width / 2, cv.height / 2);
  ctx.restore();

  // เติมซ้ำอีกรอบให้สีแน่นขึ้น
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
 * emojiTexture(char, px?)
 * - char : emoji เช่น '🥦'
 * - px   : ขนาดฐานตอนวาดลง canvas (เริ่มต้น 128)
 * คืนค่า: dataURL ('data:image/png;base64,...')
 * ใช้กับ <a-plane> / <a-image> ใน GameEngine ต่าง ๆ
 */
export function emojiTexture(char, px = 128) {
  const img = drawEmoji(char, px);
  return img.src;
}

/**
 * emojiImage(char, scale?, px?)
 * - char  : emoji เช่น '🥦'
 * - scale : scale ของ a-image (เริ่มต้น 0.65)
 * - px    : ขนาดฐานตอนวาดลง canvas (เริ่มต้น 128)
 * คืนค่า: <a-image> พร้อม texture emoji
 */
export function emojiImage(char, scale = 0.65, px = 128) {
  const src = emojiTexture(char, px);

  const el = document.createElement('a-image');
  el.setAttribute('src', src);
  el.setAttribute('transparent', true);
  el.setAttribute(
    'material',
    'transparent:true; alphaTest:0.01; side:double'
  );
  el.setAttribute('scale', `${scale} ${scale} ${scale}`);
  el.dataset.emoji = char; // เผื่อดีบัก / เช็กภายหลัง

  return el;
}

// เผื่ออนาคตอยาก import default
export default { emojiImage, emojiTexture };