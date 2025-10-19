export const name='จัดจานสุขภาพ';
const G={ grains:["🍞","🍚","🥖","🥨"], protein:["🍗","🥚","🫘","🐟"], veggies:["🥦","🥕","🥬","🍅"], fruits:["🍎","🍌","🍇","🍊"], dairy:["🥛","🧀"] };
const ORDER=['grains','veggies','protein','fruits','dairy'];
const ICON=k=> k==='grains'?'🍞':k==='protein'?'🍗':k==='veggies'?'🥦':k==='fruits'?'🍎':'🥛';
export function init(state, hud, diff){
  const base={grains:2, veggies:(diff==='Hard'?3:2), protein:1, fruits:1, dairy:1};
  state.plateTarget={...base}; state.plateQuota={...base}; render(hud,state);
}
function render(hud, state){
  const q=state.plateQuota||{}, t=state.plateTarget||{};
  const html=ORDER.map(k=>{ const need=t[k]||0; const left=q[k]||0; const have=Math.max(0,need-left); const done=left<=0;
    return `<span class="pill ${done?'done':''}" title="${k}"><span>${ICON(k)}</span><span>${have}</span>/<span>${need}</span></span>`; }).join('');
  hud.setPills(html);
}
export function pickMeta(diff){ const g=ORDER[Math.floor(Math.random()*ORDER.length)]; const arr=G[g]; return {type:'plate', group:g, char: arr[Math.floor(Math.random()*arr.length)]}; }
export function onHit(meta, systems, state, hud){
  if(!state.plateQuota) return;
  if(state.plateQuota[meta.group]>0){
    state.plateQuota[meta.group]-=1; render(hud,state);
    systems.score.add(6); systems.score.good(); systems.fever.onGood(); systems.fx.ding();
    if(Object.values(state.plateQuota).every(v=>v<=0)){
      systems.score.add(14); // Perfect bonus
      state.ctx.perfectPlates=(state.ctx.perfectPlates||0)+1;
      const el=document.getElementById('sfx-perfect'); try{ el.currentTime=0; el.play(); }catch{}
      init(state, hud, 'Normal');
    }
  }else{
    systems.score.add(2); systems.score.good(); systems.fx.ding();
  }
}