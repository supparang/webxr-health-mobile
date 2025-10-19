export const name='จาน 5 หมู่';
const G={ grains:["🍞","🍚","🥖","🥨"], protein:["🍗","🥚","🫘","🐟"], veggies:["🥦","🥕","🥬","🍅"], fruits:["🍎","🍌","🍇","🍊"], dairy:["🥛","🧀"] };
const ORDER=['grains','protein','veggies','fruits','dairy'];
const ICON=k=> k==='grains'?'🍞':k==='protein'?'🍗':k==='veggies'?'🥦':k==='fruits'?'🍎':'🥛';
export function init(state, hud){ state.currentTarget='grains'; state.targetHits=0; hud.setTarget(`${ICON(state.currentTarget)} ธัญพืช`); }
export function pickMeta(diff, state){
  const favor = Math.random()<0.65 ? state.currentTarget : ORDER[Math.floor(Math.random()*ORDER.length)];
  const arr=G[favor]; return {type:'groups', group:favor, char: arr[Math.floor(Math.random()*arr.length)]};
}
export function onHit(meta, systems, state, hud){
  if(meta.group===state.currentTarget){
    systems.score.add(7); systems.score.good(); systems.fever.onGood(); systems.fx.ding();
    state.targetHits=(state.targetHits||0)+1;
    if(state.targetHits>=3){
      state.targetHits=0;
      const others=ORDER.filter(x=>x!==state.currentTarget);
      state.currentTarget = others[Math.floor(Math.random()*others.length)];
      hud.setTarget(`${ICON(state.currentTarget)} ${state.currentTarget==='grains'?'ธัญพืช':state.currentTarget==='protein'?'โปรตีน':state.currentTarget==='veggies'?'ผัก':state.currentTarget==='fruits'?'ผลไม้':'นม'}`);
    }
  }else{
    systems.score.add(-2); systems.score.bad(); systems.fever.onBad(); systems.fx.thud();
  }
}