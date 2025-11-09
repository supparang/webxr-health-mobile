// === modes/emoji-sprite.js ===
const CACHE = new Map();

function drawEmoji(char, px=128) {
  const key = `${char}@${px}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const W = Math.round(px * dpr), H = Math.round(px * dpr);
  const pad = Math.round(px * 0.30 * dpr);

  const cv = document.createElement('canvas');
  cv.width  = W + pad*2;
  cv.height = H + pad*2;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);

  const font = `${Math.round(px*dpr)}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // outer glow
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,.5)';
  ctx.shadowBlur = Math.round(px*0.2*dpr);
  ctx.fillText(char, cv.width/2, cv.height/2);
  ctx.restore();

  // main
  ctx.fillText(char, cv.width/2, cv.height/2);

  const out = { src: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
  CACHE.set(key, out);
  return out;
}

export function emojiImage(char, scale=0.65, px=128) {
  const {src} = drawEmoji(char, px);
  const el = document.createElement('a-image');
  el.setAttribute('src', src);
  el.setAttribute('transparent', true);
  el.setAttribute('material', 'transparent:true; alphaTest:0.01; side:double');
  el.setAttribute('scale', `${scale} ${scale} ${scale}`);
  el.dataset.emoji = char;
  return el;
}
export default { emojiImage };
