// game/modes/plate.js
// === จัดจานสุขภาพ (Healthy Plate) ===
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

// ---------- HUD helpers ----------
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
  const remPairs = Object.keys(QUOTA).map(k=>{
    const rem = Math.max(0, QUOTA[k] - (plate[k]||0));
    return [k, rem];
  }).sort((a,b)=>b[1]-a[1]);

  const [bestKey, bestRem] = remPairs[0];
  if (bestRem>0){
    badge.textContent = `${LABELS_TH[bestKey]} (${plate[bestKey]||0}/${QUOTA[bestKey]})`;
  }else{
    badge.textContent = 'ครบโควตาแล้ว!';
  }
}

// ---------- Public API ----------
export function init(state, hud /*, diff */){
  state.ctx = state.ctx || {};
  state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  state.ctx.perfectPlates = 0;
  state.ctx.plateFills    = 0;

  try{ hud?.showPills?.(); }catch{}
  renderPills(state);
  updatePlateBadge(state);
}

export function pickMeta(diff, state){
  const key  = rnd(Object.keys(GROUPS)) || 'fruit';
  const char = rnd(GROUPS[key] || GROUPS.fruit);
  return {
    type: 'plate',
    group: key,
    char,
    life: diff?.life ?? 3000   // main.js จะใช้ TTL จาก meta.life
  };
}

export function onHit(meta, sys, state){
  const { sfx } = sys || {};
  const plate = state.ctx.plate;
  const k = meta.group;
  const need = QUOTA[k] ?? 0;
  const cur  = plate[k] || 0;

  // ยังไม่ครบโควตา → เก็บได้
  if (cur < need){
    plate[k] = cur + 1;
    state.ctx.plateFills = (state.ctx.plateFills||0) + 1;
    try{ sfx?.good?.(); }catch{}

    const done = Object.keys(QUOTA).every(g => (plate[g]||0) >= QUOTA[g]);
    if (done){
      state.ctx.perfectPlates = (state.ctx.perfectPlates||0) + 1;
      try{ sfx?.perfect?.(); }catch{}
      // เริ่มจานใหม่หลัง PERFECT
      state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
      renderPills(state); updatePlateBadge(state);
      return 'perfect';
    }

    renderPills(state); updatePlateBadge(state);
    return 'good';
  }

  // เกินโควตา → ถือว่า 'bad' และลงโทษเวลา -1s (คะแนนให้ main.js จัด)
  state.timeLeft = Math.max(0, (state.timeLeft||0) - 1);
  try{ sfx?.bad?.(); }catch{}
  renderPills(state); updatePlateBadge(state);
  return 'bad';
}

export function tick(/* state, sys, hud */){
  // ไม่ต้องทำทุกวินาที
}

export function cleanup(state, hud){
  try{ hud?.hidePills?.(); }catch{}
  const pills = document.getElementById('platePills'); if (pills) pills.innerHTML = '';
  const badge = document.getElementById('targetBadge'); if (badge) badge.textContent = '—';
  if (state?.ctx?.plate){
    state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  }
}
