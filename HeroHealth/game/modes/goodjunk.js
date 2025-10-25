// โหมด ดี vs ขยะ (Good vs Trash)
const HEALTHY=['🥦','🍎','🥕','🍅','🍇','🍉','🥗','🥒'];
const JUNK=['🍔','🍟','🍩','🍕','🥤','🍫','🌭','🧁'];

export function init(state){state.ctx.hits=0;state.ctx.miss=0;}
export function pickMeta(diff){const isGood=Math.random()<0.65;
  const char=isGood?HEALTHY[(Math.random()*HEALTHY.length)|0]:JUNK[(Math.random()*JUNK.length)|0];
  return {char,good:isGood,life:diff.life};}
export function onHit(meta,sys){
  const {sfx,fx}=sys;
  if(meta.good){try{sfx.good();fx?.popText?.('GOOD');}catch{} return 'good';}
  else{try{sfx.bad();fx?.popText?.('MISS',{color:'#ff7a7a'});}catch{} return 'bad';}
}
export function tick(){}
