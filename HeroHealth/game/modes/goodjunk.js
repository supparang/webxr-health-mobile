// game/modes/goodjunk.js
// โหมด: ดี vs ขยะ — ปรับ meta.life แบบ adaptive กัน "หายไวคลิกไม่ทัน"

const HEALTHY = ['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒'];
const JUNK    = ['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁'];

export function init(state, hud, diff){
  // reset คอนเท็กซ์ย่อย
  state.ctx = state.ctx || {};
  state.ctx.hits = 0;
  state.ctx.miss = 0;
}

export function pickMeta(diff, state){
  // 65% อาหารดี, 35% อาหารขยะ
  const isGood = Math.random() < 0.65;
  const char = isGood
    ? HEALTHY[(Math.random()*HEALTHY.length)|0]
    : JUNK[(Math.random()*JUNK.length)|0];

  const meta = { char, good:isGood };

  // ===== ปรับอายุไอเท็มแบบ adaptive =====
  const hits = state.ctx?.hits||0, miss = state.ctx?.miss||0;
  const acc  = (hits+miss)>0 ? (hits/(hits+miss)) : 1;

  // ยืด life หากความแม่นต่ำ เพื่อให้คลิกทันขึ้น
  const lifeBoost = acc < 0.60 ? 1.20 : (acc < 0.80 ? 1.10 : 1.00);
  const baseLife  = (diff?.life || 3000) * lifeBoost;

  // ขั้นต่ำตามระดับความยาก (กันหายไวเกิน)
  const minLife = (state.difficulty === 'Hard') ? 2000
               : (state.difficulty === 'Easy') ? 2600
               : 2200;

  meta.life = Math.max(minLife, Math.round(baseLife));

  return meta;
}

export function onHit(meta, sys, state, hud){
  const { score, sfx, fx } = sys;

  if (meta.good){
    score.add(7);
    try{ fx.popText?.('+7', { color:'#7fffd4' }); }catch{}
    try{ sfx.good(); }catch{}
  }else{
    score.add(-3);
    state.ctx.miss = (state.ctx.miss||0) + 1;
    try{ fx.popText?.('-3', { color:'#ff8080' }); }catch{}
    try{ sfx.bad(); }catch{}
  }

  state.ctx.hits = (state.ctx.hits||0) + 1;
}

export function tick(state, sys, hud){
  // ไม่จำเป็นต้องทำอะไรทุกวินาทีสำหรับโหมดนี้
}
