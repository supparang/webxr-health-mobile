export const name='ดี vs ขยะ';
const goods=['🥦','🍎','🍇','🥕','🍅','🌽','🥚']; const junks=['🍔','🍟','🍕','🥤','🍩'];
export function pickMeta(diff,state){ const good=Math.random()<0.6; const char=good?goods[Math.floor(Math.random()*goods.length)]:junks[Math.floor(Math.random()*junks.length)]; return {type:'gj',good,char}; }
export function onHit(meta,systems){ const base=meta.good?5:-2; const mult=meta.good?(1+systems.power.scoreBoost):1; const delta=Math.round(base*mult); systems.score.add(delta);
  if(meta.good){ systems.sfx.play('sfx-good'); systems.fx.spawn3D(null,`+${delta}`,'good'); } else { if(!systems.power.consumeShield()){ systems.sfx.play('sfx-bad'); systems.fx.spawn3D(null,`${delta}`,'bad'); } } }