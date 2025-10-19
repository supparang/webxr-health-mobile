export const name='ดี vs ขยะ';
const GOOD=["🥦","🍎","🍌","🍅","🥕","🍇","🍗","🥛","🍠","🌽","🥬","🍊"];
const JUNK=["🍟","🍔","🍕","🌭","🍰","🍩","🧁","🥤","🍫"];
export function pickMeta(diff){
  const bias = diff==='Easy'?0.72: diff==='Hard'?0.46:0.6;
  const good = Math.random()<bias;
  return {type:'gj', good, char:(good? GOOD: JUNK)[Math.floor(Math.random()*(good?GOOD:JUNK).length)]};
}
export function onHit(meta, systems){
  if(meta.good){ systems.score.add(5); systems.score.good(); systems.fever.onGood(); systems.fx.ding(); }
  else{ systems.score.add(-2); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); }
}