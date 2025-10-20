export const name='groups';
const groups=[
 {key:'grain',labelTH:'ธัญพืช',labelEN:'Grain',icons:['🍞','🍚','🥖','🥨']},
 {key:'veg',labelTH:'ผัก',labelEN:'Vegetable',icons:['🥦','🥕','🥒','🥬']},
 {key:'protein',labelTH:'โปรตีน',labelEN:'Protein',icons:['🥩','🍗','🥚','🐟']},
 {key:'fruit',labelTH:'ผลไม้',labelEN:'Fruit',icons:['🍎','🍌','🍇','🍊']},
 {key:'dairy',labelTH:'นม',labelEN:'Dairy',icons:['🥛','🧀']}
];
export function init(state,hud,diff){
  state.currentTarget=groups[Math.floor(Math.random()*groups.length)].key;
  const wrap=document.getElementById('targetWrap'); if(wrap) wrap.style.display='block';
  updateBadge(state);
}
function updateBadge(state){
  const badge=document.getElementById('targetBadge'); if(!badge) return;
  const isTH=state.L==='TH';
  const g=groups.find(x=>x.key===state.currentTarget);
  badge.textContent = g ? (isTH? g.labelTH : g.labelEN) : state.currentTarget;
}
export function pickMeta(diff,state){
  const g=groups[Math.floor(Math.random()*groups.length)];
  const char=g.icons[Math.floor(Math.random()*g.icons.length)];
  return {type:'groups',group:g.key,char};
}
export function onHit(meta,systems,state){
  const ok=state.currentTarget && meta.group===state.currentTarget;
  if(ok){
    systems.score.add(7);
    state.ctx.targetHitsTotal=(state.ctx.targetHitsTotal||0)+1;
    if((state.ctx.targetHitsTotal%3)===0){
      const all=['grain','veg','protein','fruit','dairy'];
      let next=state.currentTarget; while(next===state.currentTarget){ next=all[Math.floor(Math.random()*all.length)]; }
      state.currentTarget=next; updateBadge(state);
    }
  }else{
    systems.score.add(-2);
    state.ctx.groupWrong=(state.ctx.groupWrong||0)+1;
  }
}