// game/modes/plate.js
// Healthy Plate — คืนค่า 'good' | 'perfect' | 'bad' เพื่อให้ main.js ทำคะแนนรวม

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

export function init(state, hud){
  state.ctx = state.ctx || {};
  state.ctx.plate = { grain:0, veg:0, protein:0, fruit:0, dairy:0 };
  state.ctx.perfectPlates = 0; state.ctx.plateFills = 0;
  try{ hud?.showPills?.(); }catch{}
  renderPills(state); updatePlateBadge(state);
}

export function pickMeta(diff){
  const key = rnd(Object.keys(GROUPS)) || 'fruit';
  const char= rnd(GROUPS[key] || GROUPS.fruit);
  return { type:'plate', group:key, char, life: diff?.life ?? 3000 };
}

export function onHit(meta, sys, state, hud){
  const plate = state.ctx.plate;
  const k = meta.group; const need = QUOTA[k] ?? 0; const cur = plate[k] || 0;

  if (cur < need){
    plate[k] = cur + 1;
    state.ctx.plateFills = (state.ctx.plateFills||0) + 1;

    const done = Object.keys(QUOTA).every(g => (plate[g]||0) >= QUOTA[g]);
    renderPills(state); updatePlateBadge(state);

    if (done){
      state.ctx.perfectPlates = (state.ctx.perfectPlates||0) + 1
