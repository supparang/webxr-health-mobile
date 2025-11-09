// emoji-sprite.js — drop-in patch (ระบบเดิมของคุณยังใช้เหมือนเดิมได้)
const POOLS = {
  GOOD:['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'],
  JUNK:['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'],
  STAR:['⭐'], DIAMOND:['💎'], SHIELD:['🛡️']
};

const _texCache = new Map(); // key -> {src,w,h}

function _emojiWithVS16(s){ // บังคับ emoji presentation ถ้าเป็นตัวกำกวม
  return /\uFE0F$/.test(s) ? s : s + '\uFE0F';
}

function _setEmojiFont(ctx, px){
  ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Android Emoji",system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

function _canvasForEmoji(char, px=96, fx={glow:true, shadow:true}){
  const key = `${char}@${px}@${fx.glow?'g':'-'}@${fx.shadow?'s':'-'}`;
  if (_texCache.has(key)) return _texCache.get(key);

  const pad = Math.floor(px*0.45), W = px + pad*2, H = px + pad*2;
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx = cv.getContext('2d');

  // 1) ลองวาดด้วยฟอนต์อีโมจิของระบบ
  const ch = _emojiWithVS16(char);
  _setEmojiFont(ctx, px);

  if (fx.glow){ ctx.save(); ctx.shadowColor='rgba(255,255,255,.55)'; ctx.shadowBlur=px*.25; ctx.fillText(ch, W/2, H/2); ctx.restore(); }
  if (fx.shadow){ ctx.save(); ctx.shadowColor='rgba(0,0,0,.35)'; ctx.shadowBlur=px*.18; ctx.shadowOffsetX=px*.04; ctx.shadowOffsetY=px*.06; ctx.fillText(ch, W/2, H/2); ctx.restore(); }

  ctx.fillText(ch, W/2, H/2);

  // ตรวจว่ามันวาดได้จริงไหม (ดูค่า alpha ตรงกลาง ๆ)
  const mid = ctx.getImageData(W>>1, H>>1, 1, 1).data[3] > 0;

  // 2) ถ้า “ไม่ได้” → ใช้ Twemoji fallback (คืนเป็น URL โดยตรงไม่ต้องผ่านแคนวาส)
  if (!mid){
    const tw = twemojiUrl(char); // png 72x72 จาก CDN
    const out = { src: tw, w:72, h:72, external:true };
    _texCache.set(key, out);
    return out;
  }

  const out = { src: cv.toDataURL('image/png'), w:W, h:H };
  _texCache.set(key, out); return out;
}

// แปลงอีโมจิเป็น codepoints-hyphen แล้วคืนลิงก์ Twemoji PNG
function twemojiUrl(emoji){
  // แปลง surrogate pairs → code point
  const cps = Array.from(emoji).map(c=>c.codePointAt(0).toString(16)).join('-');
  return `https://twemoji.maxcdn.com/v/latest/72x72/${cps}.png`;
}

function _makeImageEntity(tex, scale=0.6){
  const el = document.createElement('a-image');
  // ถ้าเป็น external twemoji ไม่ต้อง transparent:true (PNG โปร่งใสอยู่แล้ว)
  el.setAttribute('src', tex.src);
  el.setAttribute('material', tex.external ? 'side:double' : 'transparent:true; alphaTest:0.01; side:double');
  el.setAttribute('scale', `${scale} ${scale} ${scale}`);
  el.setAttribute('animation__pop', {
    property:'scale',
    from: `${scale*0.7} ${scale*0.7} ${scale*0.7}`,
    to:   `${scale} ${scale} ${scale}`,
    dur: 140, easing:'easeOutCubic', startEvents:'spawned'
  });
  setTimeout(()=>el.emit('spawned'), 0);
  return el;
}

export const Emoji = {
  create({type='GOOD', char=null, size=96, scale=0.6, glow=true, shadow=true}={}){
    const pool = POOLS[type] || POOLS.GOOD;
    const symbol = char || pool[(Math.random()*pool.length)|0];
    const tex = _canvasForEmoji(symbol, size, {glow, shadow});
    const el  = _makeImageEntity(tex, scale);
    el.dataset.emoji = symbol; el.dataset.type = type;
    return el;
  },
  fromChar(char, {size=96, scale=0.6, glow=true, shadow=true}={}){
    const tex = _canvasForEmoji(char, size, {glow, shadow});
    return _makeImageEntity(tex, scale);
  }
};
export default Emoji;
