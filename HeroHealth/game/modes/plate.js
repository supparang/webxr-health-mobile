// game/modes/plate.js
// Healthy Plate — main.js จะคิดคะแนนจากผลลัพธ์ที่ return:
//   'good' = เก็บเข้าจานได้, 'perfect' = ครบจาน, 'bad' = เกินโควตา (และโดน -เวลา ที่นี่)

export const name = 'จัดจานสุขภาพ';

const QUOTA = { grain:2, veg:2, protein:1, fruit:1, dairy:1 };
const GROUPS = {
  grain:['🍞','🍚','🥖','🥨'],
  veg:['🥦','🥕','🥒','🥬'],
  protein:['🥩','🍗','🥚','🐟'],
  fruit:['🍎','🍌','🍇','🍊'],
  dairy:['🥛','🧀']
};
const LABELS_TH = { grain:'ธัญพืช', veg:'ผัก', protein:'โปรตีน', fruit:'ผลไม้', dairy:'นม' };

const rnd = (arr)=>arr[(Math.random()*arr.length)|0];

function renderPills(state){
  const pills = document.getElementById('platePills'); if(!pills) return;
  const plate = state.ctx.plate;
  pills.innerHTML = Object.keys(QUOTA).map(k=>{
    const cur = plate[k]||0, need = QUOTA[k];
    const done = cur>=need ? ' done' : '';
    return `<span class="pill${done}" title="${LABELS_TH[k]} ${cur}/${need}">${LABELS_TH[k]} ${cur}/${need}</span>`;
  }).join(' ');
}
function updatePlateBadge(state){
  const wrap  = document.getElementById('targetWrap');
  const badge = document.getElementById('targetBadge');
  if (wrap) wrap.style.display = 'block';
  if (!badge) return;
  const plate = state.ctx.plate;
  const remPairs = Object.keys(QUOTA).map(k=>[k, Math.max(0, QUOTA[k] - (plate[k]||0))]).sort((a,b)=>b[1]-a[1]);
  const [bestKey, bestRem] = remPairs[0];
  badge.textContent = bestRem>0 ? `${LABELS_TH[bestKey]} (${plate[bestKey]||0}/${QUOTA[bestKey]})` : 'ครบโควตาแล้ว!';
}

export function init(state, hud){
  state.ctx = state.ctx || {};
  state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  state.ctx.perfectPlates = 0;
  state.ctx.plateFills    = 0;
  try{ hud?.showPills?.(); }catch{}
  renderPills(state);
  updatePlateBadge(state);
}

export function pickMeta(diff){
  const key  = rnd(Object.keys(GROUPS)) || 'fruit';
  const char = rnd(GROUPS[key] || GROUPS.fruit);
  return { type:'plate', group:key, char, life: diff?.life ?? 3000 };
}

export function onHit(meta, sys, state){
  const plate = state.ctx.plate;
  const k = meta.group;
  const need = QUOTA[k] ?? 0;
  const cur  = plate[k] || 0;

  if (cur < need){
    plate[k] = cur + 1;
    state.ctx.plateFills = (state.ctx.plateFills||0) + 1;

    const done = Object.keys(QUOTA).every(g => (plate[g]||0) >= QUOTA[g]);
    renderPills(state);
    updatePlateBadge(state);

    if (done){
      state.ctx.perfectPlates = (state.ctx.perfectPlates||0) + 1;
      // reset plate
      state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
      renderPills(state);
      updatePlateBadge(state);
      return 'perfect';
    }
    return 'good';
  }else{
    // overfill → time penalty
    state.timeLeft = Math.max(0, (state.timeLeft||0) - 1);
    renderPills(state);
    updatePlateBadge(state);
    return 'bad';
  }
}

export function tick(){}

export function cleanup(state, hud){
  try{ hud?.hidePills?.(); }catch{}
  const pills = document.getElementById('platePills'); if (pills) pills.innerHTML = '';
  const badge = document.getElementById('targetBadge'); if (badge) badge.textContent = '—';
  if (state?.ctx?.plate){
    state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  }
}
