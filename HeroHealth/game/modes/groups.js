// game/modes/groups.js
// โหมด: จาน 5 หมู่ + เป้า + ภารกิจ 45s + พาวเวอร์อัป
// main.js จะให้คะแนนจากผลลัพธ์ที่ return: 'good'|'ok'|'bad'|'power'

const GROUPS = {
  grain:   { th:'ธัญพืช', em:['🍚','🍞','🥖','🥯','🍜'] },
  veg:     { th:'ผัก',    em:['🥦','🥕','🥬','🌽','🫑'] },
  protein: { th:'โปรตีน', em:['🥩','🍗','🍖','🥚','🐟'] },
  fruit:   { th:'ผลไม้',  em:['🍎','🍌','🍇','🍓','🍊'] },
  dairy:   { th:'นม',     em:['🥛','🧀','🍦','🍨'] }
};
const KEYS = Object.keys(GROUPS);
const pick = (arr)=>arr[(Math.random()*arr.length)|0];

const MISSION_NEED = { Easy:6, Normal:8, Hard:10 };
const POWERUP_RATE = { Easy:0.09, Normal:0.11, Hard:0.13 };
const POWERUP_MIX = [
  { type:'dual',   w:4, icon:'✨'  },
  { type:'scorex2',w:3, icon:'✖️2' },
  { type:'freeze', w:2, icon:'🧊'  },
  { type:'rotate', w:2, icon:'🔄'  }
];

function rollPower(){
  const tot = POWERUP_MIX.reduce((s,x)=>s+x.w,0);
  let r = Math.random()*tot;
  for (const it of POWERUP_MIX){ if ((r-=it.w)<=0) return it; }
  return POWERUP_MIX[0];
}

function labelTH(k){ return GROUPS[k]?.th || '—'; }
function rotateSingle(exA, exB){
  const pool = KEYS.filter(k=>k!==exA && k!==exB);
  return pick(pool.length?pool:KEYS);
}
function wantTarget(diff){ return diff==='Easy'?0.5 : diff==='Hard'?0.7 : 0.6; }

function setTargetHUD(text){
  const w = document.getElementById('targetWrap');
  const b = document.getElementById('targetBadge');
  if (w) w.style.display = 'block';
  if (b) b.textContent = text || '—';
}
function refreshHUD(state){
  const g = state.ctx.groups;
  const keys = [g.target1, g.target2].filter(Boolean);
  let text = keys.length ? keys.map(labelTH).join(' + ') : '—';
  const tags = [];
  if(g.dualRemain>0)    tags.push(`DUAL ${g.dualRemain|0}s`);
  if(g.freezeRemain>0)  tags.push(`FREEZE ${g.freezeRemain|0}s`);
  if(g.scorex2Remain>0) tags.push(`x2 ${g.scorex2Remain|0}s`);
  if(tags.length) text += ' • ' + tags.join(' | ');
  setTargetHUD(text);
}
function updateMissionLine(state){
  const el = document.getElementById('missionLine');
  const m = state.ctx?.groups?.mission;
  if (!el || !m) return;
  el.style.display='block';
  if (m.done) el.textContent = m.fail ? '⌛ Mission Failed' : '🏁 Mission Complete';
  else el.textContent = `🎯 ตรงเป้า ${m.progress}/${m.need} • ${m.remain|0}s`;
}

export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.groups = {
    target1: rotateSingle(),
    target2: null,
    targetHits: 0,
    dualRemain: 0,
    scorex2Remain: 0,
    freezeRemain: 0,
    mission: { need: MISSION_NEED[state.difficulty] ?? 8, progress:0, remain:45, done:false, fail:false }
  };
  refreshHUD(state);
  updateMissionLine(state);
}

export function pickMeta(diff, state){
  // powerup roll
  if (Math.random() < (POWERUP_RATE[state.difficulty] || 0.1)){
    const p = rollPower();
    return { type:'power', kind:p.type, char:p.icon, life: Math.max(2000, diff?.life ?? 2500) };
  }

  const g = state.ctx.groups;
  const useDual = !!g.target2;
  const want = Math.random() < wantTarget(state.difficulty);
  let key;
  if (useDual && want) key = Math.random()<0.5 ? g.target1 : g.target2;
  else if (want) key = g.target1;
  else key = rotateSingle(g.target1, g.target2);

  return { type:'food', char: pick(GROUPS[key].em), groupKey:key, good: (key===g.target1 || key===g.target2), life: diff?.life ?? 3000 };
}

export function onHit(meta, sys, state){
  const { sfx, power, fx } = sys || {};
  const g = state.ctx.groups;

  if (meta.type === 'power'){
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    if (meta.kind==='dual'){ g.target2 = rotateSingle(g.target1); g.dualRemain = 12; fx?.popText?.('DUAL!',{color:'#ffd54a'}); }
    if (meta.kind==='scorex2'){ g.scorex2Remain = 7; fx?.popText?.('SCORE ×2',{color:'#b0ff66'}); try{ power?.apply?.('boost'); }catch{} }
    if (meta.kind==='freeze'){ g.freezeRemain = 2; const t = performance?.now?.()||Date.now(); state.freezeUntil = t + 2000; fx?.popText?.('FREEZE!',{color:'#66e0ff'}); }
    if (meta.kind==='rotate'){ g.target1 = rotateSingle(g.target1, g.target2); fx?.popText?.('ROTATE!',{color:'#ffdd66'}); }
    refreshHUD(state);
    return 'power';
  }

  if (meta.type!=='food') return 'ok';

  if (meta.good){
    // on-target
    g.targetHits = (g.targetHits||0) + 1;
    if (g.mission && !g.mission.done){ g.mission.progress++; }
    if (g.targetHits >= 3){ g.target1 = rotateSingle(g.target1, g.target2); g.targetHits = 0; }
    refreshHUD(state); updateMissionLine(state);
    try{ sfx?.good?.(); }catch{}
    return 'good';
  }

  // same group but not on the current target → ok
  if (GROUPS[meta.groupKey]){
    try{ sfx?.play?.('sfx-tick'); }catch{}
    return 'ok';
  }

  // wrong group → bad
  try{ sfx?.bad?.(); }catch{}
  return 'bad';
}

export function tick(state){
  const g = state.ctx?.groups; if(!g) return;

  let needHUD = false;
  if (g.dualRemain>0){ g.dualRemain--; needHUD=true; if(g.dualRemain===0) g.target2=null; }
  if (g.scorex2Remain>0){ g.scorex2Remain--; needHUD=true; }
  if (g.freezeRemain>0){ g.freezeRemain--; needHUD=true; }

  if (g.mission && !g.mission.done){
    g.mission.remain = Math.max(0, g.mission.remain-1);
    if (g.mission.progress >= g.mission.need){ g.mission.done = true; }
    else if (g.mission.remain===0){ g.mission.done=true; g.mission.fail=true; }
  }

  if (needHUD) refreshHUD(state);
  updateMissionLine(state);
}

export function cleanup(state){
  try{ document.getElementById('targetWrap').style.display='none'; }catch{}
  try{ document.getElementById('missionLine').style.display='none'; }catch{}
}
