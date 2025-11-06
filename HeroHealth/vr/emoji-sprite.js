// === vr/emoji-sprite.js (color emoji via canvas texture + glow) ===
// คุณสมบัติ
// • แสดงอีโมจิแบบสีจริง (เรนเดอร์ลง <canvas> แล้วใช้เป็น texture กับ <a-image>)
// • มี glow/เงาแบบเบา ๆ ด้วย shadow filter ของ canvas
// • มีระบบ cache ต่ออีโมจิ/ขนาด → เร็วขึ้นมากเมื่อสปอนหลายชิ้น
// • API: Emoji.create({type, size, char, glow, shadow, scale, noRepeatFrom})
//    - type: 'GOOD'|'JUNK'|'STAR'|'DIAMOND' (ถ้าใส่ char จะไม่ใช้ type)
//    - size: ขนาดตัวอักษรเป็น "px" ของ canvas (ดีฟอลต์ 96)
//    - scale: สเกล A-Frame (เมตร) ของ plane (ดีฟอลต์ 0.6)
//    - glow: true/false เพิ่ม outer-glow (ดีฟอลต์ true)
//    - shadow: true/false เงาเล็กน้อย (ดีฟอลต์ true)
//    - noRepeatFrom: Set เพื่อกันซ้ำอีโมจิชิ้นก่อนหน้า (ถ้ามี)
// คืนค่า: <a-image> พร้อม material map/transparent ใช้งานได้ทันที

const POOLS = {
  GOOD:   ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'],
  JUNK:   ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'],
  STAR:   ['⭐'],
  DIAMOND:['💎']
};

const _texCache = new Map(); // key: `${char}@${size}@${glow}@${shadow}` -> {src, w, h}

function _pick(pool, noRepeatFrom){
  if (!Array.isArray(pool) || pool.length===0) return '⭐';
  if (noRepeatFrom && noRepeatFrom.size < pool.length){
    // เลือกตัวที่ "ไม่ซ้ำ" ล่าสุดถ้าเป็นไปได้
    const choices = pool.filter(c => !noRepeatFrom.has(c));
    return choices[Math.floor(Math.random()*choices.length)];
  }
  return pool[Math.floor(Math.random()*pool.length)];
}

function _canvasForEmoji(char, px=96, {glow=true, shadow=true}={}){
  const key = `${char}@${px}@${glow?'g':'-'}@${shadow?'s':'-'}`;
  if (_texCache.has(key)) return _texCache.get(key);

  // สร้างแคนวาสกำหนดพื้นที่เหลือสำหรับ glow/เงา
  const pad = Math.floor(px*0.45);
  const W = px + pad*2;
  const H = px + pad*2;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // พื้นหลังโปร่งใส
  ctx.clearRect(0,0,W,H);

  // เงา/กลาวแบบเบา ๆ
  if (glow) {
    // outer glow (soft)
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.55)';
    ctx.shadowBlur = Math.floor(px*0.25);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.font = `${px}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, W/2, H/2);
    ctx.restore();
  }

  if (shadow) {
    // drop shadow ลึกเล็กน้อย
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = Math.floor(px*0.18);
    ctx.shadowOffsetX = Math.floor(px*0.04);
    ctx.shadowOffsetY = Math.floor(px*0.06);
    ctx.font = `${px}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, W/2, H/2);
    ctx.restore();
  }

  // ตัวอักษรหลัก (สีตามฟอนต์อีโมจิของระบบ)
  ctx.font = `${px}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, W/2, H/2);

  const dataURL = cv.toDataURL('image/png');
  const out = { src: dataURL, w: W, h: H };
  _texCache.set(key, out);
  return out;
}

function _makeImageEntity(src, scale=0.6, w=256, h=256){
  const el = document.createElement('a-image');
  el.setAttribute('src', src);
  el.setAttribute('transparent', true);
  el.setAttribute('material', { transparent: true, alphaTest: 0.01, side: 'double' });
  // ให้รูปรักษาอัตราส่วน 1:1 เสมอ → ใช้ scale XYZ เป็นเมตร
  el.setAttribute('scale', `${scale} ${scale} ${scale}`);
  // เอฟเฟกต์ป๊อปตอนเกิด
  el.setAttribute('animation__pop', {
    property: 'scale',
    from: `${scale*0.7} ${scale*0.7} ${scale*0.7}`,
    to:   `${scale} ${scale} ${scale}`,
    dur:  140,
    easing: 'easeOutCubic',
    startEvents: 'spawned'
  });
  // ส่งอีเวนต์ให้เริ่มแอนิเมชัน
  setTimeout(()=>el.emit('spawned'), 0);
  return el;
}

export const Emoji = {
  /**
   * สร้างอีโมจิเป็น <a-image> สีจริง
   * @param {object} opt
   *  - type: 'GOOD'|'JUNK'|'STAR'|'DIAMOND'
   *  - char: override ตัวอักษร (ข้าม type)
   *  - size: ขนาดตัวอักษรบน canvas (px) default 96
   *  - scale: ขนาด plane ใน A-Frame (เมตร) default 0.6
   *  - glow, shadow: เปิด/ปิดเอฟเฟกต์
   *  - noRepeatFrom: Set ของตัวล่าสุดเพื่อกันซ้ำ (อัปเดตเองภายนอก)
   */
  create({
    type='GOOD',
    char=null,
    size=96,
    scale=0.6,
    glow=true,
    shadow=true,
    noRepeatFrom=null
  } = {}){
    const pool = POOLS[type] || POOLS.GOOD;
    const symbol = char || _pick(pool, noRepeatFrom);
    const tex = _canvasForEmoji(symbol, size, {glow, shadow});
    const el = _makeImageEntity(tex.src, scale, tex.w, tex.h);
    // แนบข้อมูลไว้ใช้ตอนสปอน/ฮิต
    el.dataset.emoji = symbol;
    el.dataset.type  = type;
    return el;
  },

  // utility เผื่อบางโหมดอยากระบุ char ตรง ๆ
  fromChar(char, {size=96, scale=0.6, glow=true, shadow=true}={}){
    const tex = _canvasForEmoji(char, size, {glow, shadow});
    return _makeImageEntity(tex.src, scale, tex.w, tex.h);
  }
};

export default Emoji;
