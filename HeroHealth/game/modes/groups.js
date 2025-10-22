// === จาน 5 หมู่ (Target Group) ===
export const name = 'จาน 5 หมู่';

const groups = [
  {key:'grain',  label:'ธัญพืช', icons:['🍞','🍚','🥖','🥨']},
  {key:'veg',    label:'ผัก',     icons:['🥦','🥕','🥒','🥬']},
  {key:'protein',label:'โปรตีน',  icons:['🥩','🍗','🥚','🐟']},
  {key:'fruit',  label:'ผลไม้',   icons:['🍎','🍌','🍇','🍊']},
  {key:'dairy',  label:'นม',      icons:['🥛','🧀']}
];

// แปะ badge HUD
function setTargetBadge(key){
  const labels={grain:'ธัญพืช',veg:'ผัก',protein:'โปรตีน',fruit:'ผลไม้',dairy:'นม'};
  const wrap=document.getElementById('targetWrap'); if(wrap) wrap.style.display='block';
  const badge=document.getElementById('targetBadge'); if(badge) badge.textContent = labels[key] || key;
}

export function init(state, hud, diff){
  // reset ตัวนับภารกิจ
  state.ctx = state.ctx || {};
  state.ctx.targetHitsTotal = 0; // ใช้กับ mission: target_hits

  // ตั้งหมวดเริ่มต้น
  const pick = groups[(Math.random()*groups.length)|0] || groups[3];
  state.currentTarget = (pick && pick.key) ? pick.key : 'fruit';
  setTargetBadge(state.currentTarget);
}

export function pickMeta(diff, state){
  const g = groups[(Math.random()*groups.length)|0] || groups[3];
  const icons = g.icons || ['🍎'];
  const char = icons[(Math.random()*icons.length)|0];
  return { type:'groups', group:g.key, char };
}

export function onHit(meta, systems, state){
  const ok = state.currentTarget && (meta.group === state.currentTarget);
  if(ok){
    systems.score.add(7);
    state.ctx.targetHitsTotal = (state.ctx.targetHitsTotal||0) + 1; // นับภารกิจ
    systems.fx?.spawn3D?.(null, '+7', 'good');
    systems.sfx?.play?.('sfx-good');

    // เปลี่ยนหมวดทุก 3 ครั้ง
    if((state.ctx.targetHitsTotal % 3)===0){
      const all=['grain','veg','protein','fruit','dairy'];
      let next=state.currentTarget;
      while(next===state.currentTarget){ next = all[(Math.random()*all.length)|0]; }
      state.currentTarget = next;
      setTargetBadge(next);
    }
  }else{
    systems.score.add(-2);
    systems.fx?.spawn3D?.(null, '-2', 'bad');
    systems.sfx?.play?.('sfx-bad');
    systems.score.bad?.();
  }
}
