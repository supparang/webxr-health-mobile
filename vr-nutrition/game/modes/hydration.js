// modes/hydration.js
export const name='สมดุลน้ำ';
const WATER=["💧","🚰"], SWEET=["🥤","🧃","🧋"];
export function pickMeta(diff){
  const rate = diff==='Easy'?0.78: diff==='Hard'?0.55:0.66;
  const water = Math.random()<rate;
  const arr = water? WATER : SWEET;
  return {type:'hydra', water, char:arr[0]};
}
export function onHit(meta, systems){
  if(meta.water){ systems.score.add(5); systems.score.good(); systems.fever.onGood(); systems.fx.ding(); }
  else{ systems.score.add(-3); systems.score.bad(); systems.fever.onBad(); systems.fx.thud(); }
}
