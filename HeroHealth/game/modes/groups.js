// game/modes/groups.js
// โหมด: จาน 5 หมู่ (target + mission + power-ups) → คืนค่า 'good'|'ok'|'bad'|'power'
const GROUPS = {
  grain:{ th:'ธัญพืช', em:['🍚','🍞','🥖','🥯','🍜'] },
  veg:{ th:'ผัก', em:['🥦','🥕','🥬','🌽','🫑'] },
  protein:{ th:'โปรตีน', em:['🥩','🍗','🍖','🥚','🐟'] },
  fruit:{ th:'ผลไม้', em:['🍎','🍌','🍇','🍓','🍊'] },
  dairy:{ th:'นม', em:['🥛','🧀','🍦','🍨'] }
};
const KEYS = Object.keys(GROUPS);
const rnd = (arr)=>arr[(Math.random()*arr.length)|0];

const POWER_RATE={ Easy:0.09, Normal:0.11, Hard:0.13 };
const POWER = [
  {type:'power_dual', w:4, icon:'✨'},
  {type:'power_scorex2', w:3, icon:'✖️2'},
  {type:'power_freeze', w:2, icon:'🧊'},
  {type:'power_rotate', w:2, icon:'🔄'}
];
function rollPower(){ const tot=POWER.reduce((s,x)=>s+x.w,0); let r=Math.random()*tot; for(const p of POWER){ if((r-=p.w)<=0) return p; } return POWER[0]; }
function rotTarget(exA, exB){ const pool=KEYS.filter(k=>k!==exA && k!==exB); return rnd(pool.length?pool:KEYS); }
function wantTarget(diff){ return diff==='Easy'?0.5: diff==='Hard'?0.7:0.6; }

export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.groups = {
    target1: rotTarget(),
    target2: null,
    targetHits:0,
    dualRemain:0, scorex2Remain:0, freezeRemain:0
  };
  // แสดงป้าย
  const wrap=document.getElementById('targetWrap'); if(wrap) wrap.style.display='block';
  const badge=document.getElementById('targetBadge'); if(badge) badge.textContent = GROUPS[state.ctx.groups.target1].th;
}
export function pickMeta(diff, state){
  // power?
  if (Math.random() < (POWER_RATE[state.difficulty]||0.1)){
    const p = rollPower();
    return { type:'power', char:p.icon, p:p.type, life: Math.max(2000, diff?.life ?? 2500) };
  }
  const gctx = state.ctx.groups;
  const useDual = !!gctx.target2;
  const want = Math.random() < wantTarget(state.difficulty);
  let groupKey;
  if (useDual && want){ groupKey = Math.random()<0.5?gctx.target1:gctx.target2; }
  else if (want){ groupKey = gctx.target1; }
  else { groupKey = rotTarget(gctx.target1, gctx.target2); }
  const char = rnd(GROUPS[groupKey].em);
  return { type:'food', char, life: diff?.life ?? 3000, groupKey, good: groupKey===gctx.target1 || groupKey===gctx.target2 };
}
export function onHit(meta, sys, state){
  const { score, sfx, fx, power } = sys || {};
  const gctx = state.ctx.groups;

  if (meta.type==='power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.p==='power_dual'){
      gctx.target2 = rotTarget(gctx.target1);
      gctx.dualRemain = 12; fx?.popText?.('DUAL',{color:'#ffd54a'}); score?.add?.(3); return 'power';
    }
    if (meta.p==='power_scorex2'){ power?.apply?.('boost'); gctx.scorex2Remain=7; fx?.popText?.('SCORE ×2',{color:'#b0ff66'}); return 'power'; }
    if (meta.p==='power_freeze'){
      state.freezeUntil = (performance.now()) + 2000;
      gctx.freezeRemain=2; fx?.popText?.('FREEZE!',{color:'#66e0ff'}); return 'power';
    }
    if (meta.p==='power_rotate'){ gctx.target1 = rotTarget(gctx.target1, gctx.target2); fx?.popText?.('ROTATE',{color:'#ffdd66'}); return 'power'; }
  }

  if (meta.type!=='food') return 'ok';

  if (meta.good){
    score?.add?.(0); // คะแนนรวมไปคิดที่ main.js
    gctx.targetHits = (gctx.targetHits||0) + 1;
    if (gctx.targetHits>=3){ gctx.target1 = rotTarget(gctx.target1, gctx.target2); gctx.targetHits=0; }
    try{ sfx?.good?.(); }catch{}
    return 'good';
  }
  try{ sfx?.bad?.(); }catch{}
  return 'bad';
}
export function tick(state){
  const g = state.ctx.groups; if(!g) return;
  if (g.dualRemain>0) g.dualRemain--;
  if (g.scorex2Remain>0) g.scorex2Remain--;
  if (g.freezeRemain>0) g.freezeRemain--;
}
export function cleanup(){ const badge=document.getElementById('targetBadge'); if(badge) badge.textContent='—'; }
