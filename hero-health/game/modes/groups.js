export const name = 'จาน 5 หมู่';

const groups = [
  { key:'grain',   label:'ธัญพืช', icons:['🍞','🍚','🥖','🥨'] },
  { key:'veg',     label:'ผัก',     icons:['🥦','🥕','🥒','🥬'] },
  { key:'protein', label:'โปรตีน',  icons:['🥩','🍗','🥚','🐟'] },
  { key:'fruit',   label:'ผลไม้',   icons:['🍎','🍌','🍇','🍊'] },
  { key:'dairy',   label:'นม',      icons:['🥛','🧀'] }
];

export function init(state, hud, diff){
  state.currentTarget = groups[Math.floor(Math.random()*groups.length)].key;

  const el = document.getElementById('targetWrap');
  if (el) el.style.display = 'block';

  const badge = document.getElementById('targetBadge');
  if (badge){
    const g = groups.find(x => x.key === state.currentTarget);
    badge.textContent = g ? g.label : state.currentTarget;
  }
}

export function pickMeta(diff, state){
  const g = groups[Math.floor(Math.random()*groups.length)];
  const char = g.icons[Math.floor(Math.random()*g.icons.length)];
  return { type:'groups', group:g.key, char };
}

export function onHit(meta, systems, state){
  const ok = state.currentTarget && meta.group === state.currentTarget;

  if (ok){
    systems.score.add(7);
    state.ctx.targetHitsTotal = (state.ctx.targetHitsTotal || 0) + 1;

    if ((state.ctx.targetHitsTotal % 3) === 0){
      const all = ['grain','veg','protein','fruit','dairy'];
      let next = state.currentTarget;
      while (next === state.currentTarget){
        next = all[Math.floor(Math.random()*all.length)];
      }
      state.currentTarget = next;

      const labels = { grain:'ธัญพืช', veg:'ผัก', protein:'โปรตีน', fruit:'ผลไม้', dairy:'นม' };
      const badge = document.getElementById('targetBadge');
      if (badge) badge.textContent = labels[next] || next;
    }
  } else {
    systems.score.add(-2);
  }
}
