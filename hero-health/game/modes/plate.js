export const name = 'จัดจานสุขภาพ';

const QUOTA = { grain:2, veg:2, protein:1, fruit:1, dairy:1 };
const GROUPS = {
  grain:['🍞','🍚','🥖','🥨'],
  veg:['🥦','🥕','🥒','🥬'],
  protein:['🥩','🍗','🥚','🐟'],
  fruit:['🍎','🍌','🍇','🍊'],
  dairy:['🥛','🧀']
};

export function init(state, hud){
  state.plate = {grain:0, veg:0, protein:0, fruit:0, dairy:0};
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'block';
  renderPills(state);
}

function renderPills(state){
  const pills = document.getElementById('platePills'); if(!pills) return;
  pills.innerHTML = '';
  const labels = {grain:'ธัญพืช', veg:'ผัก', protein:'โปรตีน', fruit:'ผลไม้', dairy:'นม'};
  Object.keys(QUOTA).forEach(k=>{
    const cur = state.plate[k], need = QUOTA[k];
    const el = document.createElement('div');
    el.className = 'pill' + (cur>=need ? ' done' : '');
    el.textContent = `${labels[k]} ${cur}/${need}`;
    pills.appendChild(el);
  });
}

export function pickMeta(diff, state){
  const keys = Object.keys(GROUPS);
  const k = keys[Math.floor(Math.random()*keys.length)];
  const char = GROUPS[k][Math.floor(Math.random()*GROUPS[k].length)];
  return { type:'plate', group:k, char };
}

export function onHit(meta, systems, state){
  const k = meta.group;
  const need = QUOTA[k];
  const cur = state.plate[k] || 0;

  if (cur < need){
    state.plate[k] = cur + 1;
    systems.score.add(6);
