// === emoji-sprite.js (release-safe build, UTF-8) ===
// รองรับ fallback Twemoji และกันปัญหา encoding/font override

const POOLS = {
  GOOD:['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'],
  JUNK:['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'],
  STAR:['⭐'], DIAMOND:['💎'], SHIELD:['🛡️']
};

const _cache = new Map();

function _emojiWithVS16(s){ return /\uFE0F$/.test(s)?s:s+'\uFE0F'; }

function _setEmojiFont(ctx, px){
  ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Android Emoji",system-ui,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
}

function twemojiUrl(emoji){
  const cps = Array.from(emoji).map(c=>c.codePointAt(0).toString(16)).join('-');
  return `https://twemoji.maxcdn.com/v/latest/72x72/${cps}.png`;
}

function _canvasForEmoji(char, px=96, fx={glow:true, shadow:true}){
  const key = `${char}@${px}@${fx.glow?'g':'-'}@${fx.shadow?'s':'-'}`;
  if (_cache.has(key)) return _cache.get(key);

  const pad = Math.floor(px*0.45), W = px + pad*2, H = px + pad*2;
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx = cv.getContext('2d');

  const ch = _emojiWithVS16(char);
  _setEmojiFont(ctx, px);

  if (fx.glow){ ctx.save(); ctx.shadowColor='rgba(255,255,255,.55)'; ctx.shadowBlur=px*.25; ctx.fillText(ch,W/2,H/2); ctx.restore(); }
  if (fx.shadow){ ctx.save(); ctx.shadowColor='rgba(0,0,0,.35)'; ctx.shadowBlur=px*.18; ctx.shadowOffsetX=px*.04; ctx.shadowOffsetY=px*.06; ctx.fillText(ch,W/2,H/2); ctx.restore(); }

  ctx.fillText(ch,W/2,H/2);

  // ตรวจว่ามันวาดได้จริงไหม (ดู alpha)
  const ok = ctx.getImageData(W>>1,H>>1,1,1).data[3]>0;
  let tex;
  if(!ok){
    tex = {src:twemojiUrl(char),w:72,h:72,external:true};
  }else{
    tex = {src:cv.toDataURL('image/png'),w:W,h:H,external:false};
  }
  _cache.set(key,tex);
  return tex;
}

function _makeImageEntity(tex,scale=0.6){
  const el = document.createElement('a-image');
  el.setAttribute('src',tex.src);
  el.setAttribute('material',tex.external?'side:double':'transparent:true;alphaTest:0.01;side:double');
  el.setAttribute('scale',`${scale} ${scale} ${scale}`);
  el.setAttribute('crossorigin','anonymous');
  el.setAttribute('animation__pop',{
    property:'scale',
    from:`${scale*0.7} ${scale*0.7} ${scale*0.7}`,
    to:`${scale} ${scale} ${scale}`,
    dur:140,easing:'easeOutCubic',startEvents:'spawned'
  });
  setTimeout(()=>el.emit('spawned'),0);
  return el;
}

export const Emoji={
  create({type='GOOD',char=null,size=96,scale=0.6,glow=true,shadow=true}={}){
    const pool=POOLS[type]||POOLS.GOOD;
    const symbol=char||pool[(Math.random()*pool.length)|0];
    const tex=_canvasForEmoji(symbol,size,{glow,shadow});
    const el=_makeImageEntity(tex,scale);
    el.dataset.emoji=symbol; el.dataset.type=type;
    return el;
  },
  fromChar(char,{size=96,scale=0.6,glow=true,shadow=true}={}){
    const tex=_canvasForEmoji(char,size,{glow,shadow});
    return _makeImageEntity(tex,scale);
  }
};
export default Emoji;
