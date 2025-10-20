export const name='goodjunk';
const goods=['🥦','🍎','🍇','🥕','🍅','🌽','🥚'];
const junks=['🍔','🍟','🍕','🥤','🍩'];
export function pickMeta(diff,state){
  const good=Math.random()<0.6;
  const char=good?goods[Math.floor(Math.random()*goods.length)]:junks[Math.floor(Math.random()*junks.length)];
  return {type:'gj',good,char};
}
export function onHit(meta,systems,state){
  if(meta.good){ systems.score.add(5); state.ctx.goodHits=(state.ctx.goodHits||0)+1; }
  else{ systems.score.add(-2); state.ctx.junkHits=(state.ctx.junkHits||0)+1; }
}