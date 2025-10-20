// ./game/modes/plate.js
export const name='จัดจานสุขภาพ';

const QUOTA={grain:2,veg:2,protein:1,fruit:1,dairy:1};
const GROUPS={
  grain:['🍞','🍚','🥖','🥨'],
  veg:['🥦','🥕','🥒','🥬'],
  protein:['🥩','🍗','🥚','🐟'],
  fruit:['🍎','🍌','🍇','🍊'],
  dairy:['🥛','🧀']
};

export function init(state,hud){
  // ✅ ตั้งค่า plate เสมอ
  state.plate = state.plate || {grain:0,veg:0,protein:0,fruit:0,dairy:0};
  const wrap=document.getElementById('plateTracker');
  if(wrap) wrap.style.display='block';
  renderPills(state);
}

function renderPills(state){
  // เผื่อเรียกก่อน init
  state.plate = state.plate || {grain:0,veg:0,protein:0,fruit:0,dairy:0};
  const pills=document.getElementById('platePills'); if(!pills) return;
  pills.innerHTML='';
  const labels={grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'};
  Object.keys(QUOTA).forEach(k=>{
    const cur=state.plate[k]||0, need=QUOTA[k];
    const el=document.createElement('div');
    el.className='pill'+(cur>=need?' done':'');
    el.textContent=`${labels[k]} ${cur}/${need}`;
    pills.appendChild(el);
  });
}

export function pickMeta(diff,state){
  const keys=Object.keys(GROUPS);
  const k=keys[Math.floor(Math.random()*keys.length)] || 'fruit';
  const arr=GROUPS[k] || GROUPS.fruit;
  const char=arr[Math.floor(Math.random()*arr.length)];
  return {type:'plate',group:k,char};
}

export function onHit(meta,systems,state){
  // ✅ กันไว้หากยังไม่มี plate
  state.plate = state.plate || {grain:0,veg:0,protein:0,fruit:0,dairy:0};

  const k=meta.group;
  const need=QUOTA[k] ?? 0;
  const cur=state.plate[k]||0;

  if(cur<need){
    state.plate[k]=cur+1;
    systems.score.add(6);
    state.ctx.plateFills=(state.ctx.plateFills||0)+1;

    const done=Object.keys(QUOTA).every(g=> (state.plate[g]||0) >= QUOTA[g]);
    if(done){
      systems.score.add(14);
      state.ctx.perfectPlates=(state.ctx.perfectPlates||0)+1;
      // reset จาน
      state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0};
    }
  }else{
    systems.score.add(-2);
    state.timeLeft=Math.max(0,(state.timeLeft||0)-1);
    state.ctx.overfillCount=(state.ctx.overfillCount||0)+1;
    if(systems.score.combo>0) systems.score.bad();
  }
  renderPills(state);
}
