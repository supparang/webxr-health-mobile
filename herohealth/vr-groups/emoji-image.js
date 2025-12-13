// === /herohealth/vr-groups/emoji-image.js ===
// Emoji → PNG dataURL (ใช้เป็น texture ให้เป้า VR)
// ES module สำหรับใช้ร่วมกับ GameEngine.js

'use strict';

const CACHE = new Map();

/**
 * สร้าง dataURL ของรูป emoji 1 ตัว
 * @param {string} emoji - ตัวอีโมจิ เช่น '🍎'
 * @param {object} opts  - { size?: number }
 * @returns {string} dataURL ของภาพ PNG
 */
export function emojiImage(emoji, opts = {}) {
  if (!emoji) return '';

  const size = Number(opts.size) > 0 ? Number(opts.size) : 256;
  const key = `${emoji}|${size}`;

  if (CACHE.has(key)) return CACHE.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, size, size);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(size * 0.72)}px system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI Emoji", "Apple Color Emoji",
    "Noto Color Emoji", sans-serif`;

  ctx.fillText(emoji, size / 2, size / 2);

  const url = canvas.toDataURL('image/png');
  CACHE.set(key, url);
  return url;
}

// เผื่ออยาก import แบบ default
export default { emojiImage };
