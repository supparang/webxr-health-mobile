// === จัดจานสุขภาพ (Healthy Plate) ===
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

function renderPills(state){
  state.plate = state.plate || { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  const pills=document.getElementById('platePills'); if(!pills) return;
  pills.innerHTML='';
  Object.keys(QUOTA).forEach(k=>{
    const cur=state.plate[k]||0, need=QUOTA[k];
    const el=document.createElement('div');
    el.className='pill'+(cur>=need?' done':'' );
    el.textContent=`${LABELS[k]} ${cur}/${need}`;
    pills.appendChild(el);
  });
}
function updatePlateHUD(state){
  const wrap=document.getElementById('targetWrap'); if(wrap) wrap.style.display='block';
  const badge=document.getElementById('targetBadge'); if(!badge) return;
  // แนะนำหมวดที่ “ยังขาดมากสุด”
  const rem = {};
  for(const k of Object.keys(QUOTA)){
    rem[k] = Math.max(0, (QUOTA[k]||0) - ((state.plate?.[k])||0));
  }
  const order=['veg','grain','protein','fruit','dairy'];
  let best=null, bestVal=-1;
  for(const k of order){ if(rem[k]>bestVal){ best = rem[k]>0 ? k : best; bestVal = rem[k]; } }
  badge.textContent = best ? `${LABELS[best]} (${state.plate[best]||0}/${QUOTA[best]||0})` : 'ครบโควตาแล้ว!';
}

export function init(state, hud){
  state.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  // reset ตัวนับภารกิจ
  state.ctx = state.ctx || {};
  state.ctx.perfectPlates = 0;   // ใช้กับ mission: perfect_plates
  state.ctx.plateFills    = 0;   // ใช้โชว์สถิติ/ภารกิจอื่น

  const wrap=document.getElementById('plateTracker'); if(wrap) wrap.style.display='block';
  renderPills(state); updatePlateHUD(state);
}

export function pickMeta(diff, state){
  const keys=Object.keys(GROUPS);
  const k=keys[(Math.random()*keys.length)|0] || 'fruit';
  const arr=GROUPS[k] || GROUPS.fruit;
  const char=arr[(Math.random()*arr.length)|0];
  return { type:'plate', group:k, char };
}

export function onHit(meta, systems, state){
  const k = meta.group;
  const need = QUOTA[k] ?? 0;
  const cur = state.plate[k] || 0;

  if(cur < need){
    state.plate[k] = cur + 1;
    systems.score.add(6);
    state.ctx.plateFills = (state.ctx.plateFills||0) + 1;
    systems.fx?.spawn3D?.(null, '+6', 'good');
    systems.sfx?.play?.('sfx-good');

    const done = Object.keys(QUOTA).every(g => (state.plate[g]||0) >= QUOTA[g]);
    if(done){
      systems.score.add(14);
      state.ctx.perfectPlates = (state.ctx.perfectPlates||0) + 1; // นับภารกิจ
      systems.fx?.spawn3D?.(null, 'PERFECT +14', 'good');
      systems.sfx?.play?.('sfx-perfect');
      // จานใหม่
      state.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
    }
  }else{
    systems.score.add(-2);
    state.timeLeft = Math.max(0, (state.timeLeft||0) - 1); // โทษเวลาเมื่อ “เกินโควตา”
    systems.fx?.spawn3D?.(null, '-2 • -1s', 'bad');
    systems.sfx?.play?.('sfx-bad');
    systems.score.bad?.();
  }

  renderPills(state); updatePlateHUD(state);
}
// ===== Helper: แสดงพิลล์โควตาทั้งจานให้เห็นครบ ๆ =====
export function renderPlatePills(state){
  const wrap = document.getElementById('platePills'); if(!wrap) return;
  const L = [
    { key:'grain',   label:'ธัญพืช', need:2 },
    { key:'veg',     label:'ผัก',    need:2 },
    { key:'protein', label:'โปรตีน', need:1 },
    { key:'fruit',   label:'ผลไม้',  need:1 },
    { key:'dairy',   label:'นม',     need:1 },
  ];
  const get = (k)=> (state?.ctx?.plate?.[k] || 0);
  wrap.innerHTML = L.map(({key,label,need})=>{
    const got = get(key);
    return Array.from({length:need},(_,i)=>{
      const done = i < got ? 'done' : '';
      // ตัวย่อภาษาไทยให้กระชับ เช่น ธ2-1, ผ2-2
      const ab = label[0] + (i+1);
      return `<span class="pill ${done}" title="${label} ${i+1}/${need}">${ab}</span>`;
    }).join('');
  }).join(' ');
}

// ===== Init (เสริมส่วนเปิด HUD + สร้าง state.ctx.plate ถ้ายังไม่มี) =====
export function init(state, hud /*, diff */){
  try{ hud.showPills?.(); }catch{}
  if (!state.ctx) state.ctx = {};
  if (!state.ctx.plate){
    state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  }
  // โชว์โควตาทั้งหมดตั้งแต่เริ่ม
  renderPlatePills(state);
}

// ===== Cleanup หลังจบเกม เพื่อไม่ให้ค้าง =====
export function cleanup(state, hud){
  try{ hud.hidePills?.(); }catch{}
  const wrap = document.getElementById('platePills'); if(wrap) wrap.innerHTML='';
  if (state?.ctx?.plate){
    state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  }
}
