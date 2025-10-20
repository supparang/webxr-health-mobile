export const name='จัดจานสุขภาพ';

const QUOTA = { grain:2, veg:2, protein:1, fruit:1, dairy:1 };
const GROUPS = {
  grain:['🍞','🍚','🥖','🥨'],
  veg:['🥦','🥕','🥒','🥬'],
  protein:['🥩','🍗','🥚','🐟'],
  fruit:['🍎','🍌','🍇','🍊'],
  dairy:['🥛','🧀']
};
const LABELS = { grain:'ธัญพืช', veg:'ผัก', protein:'โปรตีน', fruit:'ผลไม้', dairy:'นม' };

export function init(state,hud){
  // set plate state (กันพัง)
  state.plate = state.plate || { grain:0, veg:0, protein:0, fruit:0, dairy:0 };

  // แสดง tracker & pills
  const wrap=document.getElementById('plateTracker');
  if(wrap) wrap.style.display='block';
  renderPills(state);

  // ✅ แสดง badge แนะนำหมวดที่ควรเก็บก่อน
  updatePlateHUD(state);
}

function remainingCounts(state){
  const plate = state.plate || {};
  const rem = {};
  for(const k of Object.keys(QUOTA)){
    rem[k] = Math.max(0, (QUOTA[k]||0) - (plate[k]||0));
  }
  return rem;
}

function nextRecommended(state){
  const rem = remainingCounts(state);
  // เลือกหมวดที่เหลือมากที่สุด (ถ้าเสมอ เลือกตัวแรกในลำดับนี้)
  const order = ['veg','grain','protein','fruit','dairy']; // เรียงให้เริ่มที่ "ผัก" เป็นหลัก
  let best = null, bestVal = -1;
  for(const k of order){
    if(rem[k] > bestVal){
      best = rem[k] > 0 ? k : best; // เฉพาะที่ยังต้องเก็บ
      bestVal = rem[k];
    }
  }
  return best; // อาจเป็น null ถ้าครบแล้ว
}

function updatePlateHUD(state){
  const wrap = document.getElementById('targetWrap');
  if(wrap) wrap.style.display = 'block';

  const badge = document.getElementById('targetBadge');
  if(!badge) return;

  const next = nextRecommended(state);
  if(next){
    const cur = (state.plate?.[next]||0), need=(QUOTA[next]||0);
    // แสดง “หมวดที่ควรเก็บก่อน (ปัจจุบัน/โควตา)”
    badge.textContent = `${LABELS[next]} (${cur}/${need})`;
  }else{
    badge.textContent = 'ครบโควตาแล้ว!'; // all set
  }
}

function renderPills(state){
  state.plate = state.plate || { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  const pills=document.getElementById('platePills'); if(!pills) return;
  pills.innerHTML='';
  Object.keys(QUOTA).forEach(k=>{
    const cur=state.plate[k]||0, need=QUOTA[k];
    const el=document.createElement('div');
    el.className='pill'+(cur>=need?' done':'');
    el.textContent=`${LABELS[k]} ${cur}/${need}`;
    pills.appendChild(el);
  });
}

export function pickMeta(diff,state){
  const keys=Object.keys(GROUPS);
  const k=keys[Math.floor(Math.random()*keys.length)] || 'fruit';
  const arr=GROUPS[k] || GROUPS.fruit;
  const char=arr[Math.floor(Math.random()*arr.length)];
  return {type:'plate', group:k, char};
}

export function onHit(meta,systems,state){
  // กันพัง
  state.plate = state.plate || { grain:0, veg:0, protein:0, fruit:0, dairy:0 };

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
      // reset จานใหม่
      state.plate={grain:0,veg:0,protein:0,fruit:0,dairy:0};
    }
  }else{
    systems.score.add(-2);
    state.timeLeft=Math.max(0,(state.timeLeft||0)-1);
    state.ctx.overfillCount=(state.ctx.overfillCount||0)+1;
    if(systems.score.combo>0) systems.score.bad();
  }

  // อัปเดต HUD ทั้งสองส่วน
  renderPills(state);
  updatePlateHUD(state);
}
