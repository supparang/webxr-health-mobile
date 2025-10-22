// === ดี vs ขยะ (Good vs Junk) ===
export const name = 'ดี vs ขยะ';

const goods = ['🥦','🍎','🍇','🥕','🍅','🌽','🥚'];
const junks = ['🍔','🍟','🍕','🥤','🍩'];

export function init(state, hud, diff){
  // reset ตัวนับภารกิจ (กันพังถ้ามาจากโหมดอื่น)
  state.ctx = state.ctx || {};
  state.ctx.goodHits = 0;  // ใช้กับ mission: collect_goods
}

export function pickMeta(diff, state){
  const good = Math.random() < 0.6;
  const char = good
    ? goods[(Math.random()*goods.length)|0]
    : junks[(Math.random()*junks.length)|0];
  return { type:'gj', good, char };
}

export function onHit(meta, systems, state){
  if(meta.good){
    systems.score.add(5);
    // นับสำหรับภารกิจ
    state.ctx.goodHits = (state.ctx.goodHits||0) + 1;
    systems.fx?.spawn3D?.(null, '+5', 'good');
    systems.sfx?.play?.('sfx-good');
  }else{
    // ขยะ
    // ถ้ามีเกราะ (optional): systems.power?.consumeShield?.() แล้วลดโทษ
    systems.score.add(-2);
    systems.fx?.spawn3D?.(null, '-2', 'bad');
    systems.sfx?.play?.('sfx-bad');
  }
}
