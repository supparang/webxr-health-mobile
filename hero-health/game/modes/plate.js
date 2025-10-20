export const name='plate';
const QUOTA={grain:2,veg:2,protein:1,fruit:1,dairy:1};
const GROUPS={grain:['🍞','🍚','🥖','🥨'],veg:['🥦','🥕','🥒','🥬'],protein:['🥩','🍗','🥚','🐟'],fruit:['🍎','🍌','🍇','🍊'],dairy:['🥛','🧀']};
export function init(state,hud){
  state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0};
  const wrap=document.getElementById('plateTracker'); if(wrap) wrap.style.display='block';
  renderPills(state);
}
function renderPills(state){
  const pills=document.getElementById('platePills'); if(!pills) return;
  pills.innerHTML='';
  const labels= state.L==='TH'? {grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'} : {grain:'Grain',veg:'Vegetable',protein:'Protein',fruit:'Fruit',dairy:'Dairy'};
  Object.keys(QUOTA).forEach(k=>{
    const cur=state.plate?.[k]||0, need=QUOTA[k];
    const el=document.createElement('div'); el.className='pill'+(cur>=need?' done':'');
    el.textContent=`${labels[k]} ${cur}/${need}`;
    pills.appendChild(el);
  });
}
export function pickMeta(diff,state){
  const keys=Object.keys(GROUPS); const k=keys[Math.floor(Math.random()*keys.length)];
  const char=GROUPS[k][Math.floor(Math.random()*GROUPS[k].length)];
  return {type:'plate', group:k, char};
}
export function onHit(meta,systems,state){
  const k=meta.group, need=QUOTA[k], cur=state.plate[k]||0;
  if(cur<need){
    state.plate[k]=cur+1; systems.score.add(6);
    state.ctx.plateFills=(state.ctx.plateFills||0)+1;
    const done=Object.keys(QUOTA).every(g=>state.plate[g]>=QUOTA[g]);
    if(done){ systems.score.add(14); state.ctx.perfectPlates=(state.ctx.perfectPlates||0)+1; state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0}; }
  }else{
    systems.score.add(-2); state.timeLeft=Math.max(0,(state.timeLeft||0)-1);
    state.ctx.overfillCount=(state.ctx.overfillCount||0)+1;
  }
  renderPills(state);
}