// game/modes/groups.js
// โหมด: จาน 5 หมู่ + เป้าหมาย + มิชชัน 45s + พาวเวอร์
// ส่งผลลัพธ์ให้ main.js: 'good' | 'ok' | 'bad' | 'power'

const GROUPS = {
  grain:   { th:'ธัญพืช',  em:['🍚','🍞','🥖','🥯','🍜'] },
  veg:     { th:'ผัก',     em:['🥦','🥕','🥬','🌽','🫑'] },
  protein: { th:'โปรตีน',  em:['🥩','🍗','🍖','🥚','🐟'] },
  fruit:   { th:'ผลไม้',   em:['🍎','🍌','🍇','🍓','🍊'] },
  dairy:   { th:'นม',      em:['🥛','🧀','🍦','🍨'] }
};
const KEYS = Object.keys(GROUPS);
const pick = (arr)=>arr[(Math.random()*arr.length)|0];

const MISSION_NEED = { Easy:6, Normal:8, Hard:10 };
const POWER_RATE   = { Easy:0.09, Normal:0.11, Hard:0.13 };
const POWER_MIX = [
  { type:'dual',   w:4, icon:'✨' },
  { type:'scorex2',w:3, icon:'✖️2' },
  { type:'freeze', w:2, icon:'🧊' },
  { type:'rotate', w:2, icon:'🔄' },
];
const FREEZE_SECONDS = 2;
const DUAL_DURATION  = { Easy:10, Normal:12, Hard:14 };
const SCOREX2_SECONDS= 7;

export function init(state, hud){
  state.ctx = state.ctx || {};
  state.ctx.groups = {
    target1: rotate(null,null),
    target2: null,
    targetHits: 0,
    dualRemain: 0,
    scorex2Remain: 0,
    freezeRemain: 0,
    mission: { need: MISSION_NEED[state.difficulty] ?? 8, progress:0, remain:45, done:false, fail:false }
  };
  refreshHUD(state, hud);
  updateMissionHUD(state);
}

export function tick(state, sys, hud){
  const g = state.ctx?.groups; if(!g) return;
  const { power, coach, sfx, fx } = sys || {};

  let need = false;
  if (g.dualRemain>0){ g.dualRemain--; if(g.dualRemain===0){ g.target2=null; coach?.say?.(state.lang==='TH'?'หมดพลัง Dual':'Dual over'); } need=true; }
  if (g.scorex2Remain>0){ g.scorex2Remain--; need=true; }
  if (g.freezeRemain>0){
    g.freezeRemain--; need=true;
    if (g.freezeRemain===0){ coach?.say?.(state.lang==='TH'?'เลิก Freeze':'Freeze over'); }
  }

  // Mission
  const m = g.mission;
  if (m && !m.done){
    m.remain = Math.max(0, m.remain - 1);
    if (m.progress >= m.need){ m.done=true; fx?.popText?.('🏁 Mission Complete',{color:'#7fffd4'}); sfx?.play?.('sfx-perfect'); }
    else if (m.remain===0){ m.done=true; m.fail=true; fx?.popText?.('⌛ Mission Failed',{color:'#ff9b9b'}); }
  }
  updateMissionHUD(state);
  if (need) refreshHUD(state, hud);
}

export function pickMeta(diff, state){
  // roll power
  if (Math.random() < (POWER_RATE[state.difficulty] || POWER_RATE.Normal)){
    const p = rollPower();
    return { type:'power', power:p.type, char:p.icon, life: Math.max(2000, diff?.life ?? 2500) };
  }

  // food
  const g = state.ctx?.groups || {};
  const useDual = !!g.target2;
  const wantTarget = Math.random() < targetChance(state.difficulty);

  let key;
  if (useDual && wantTarget) key = Math.random()<0.5 ? g.target1 : g.target2;
  else if (wantTarget) key = g.target1;
  else key = rotate(g.target1, g.target2);

  const char = pick(GROUPS[key].em);
  return { type:'food', char, life:(diff?.life ?? 3000), groupKey:key, good: isOnTarget(key, g) };
}

export function onHit(meta, sys, state, hud){
  const g = state.ctx?.groups; const { coach, sfx, fx, power } = sys || {};
  const lang = state.lang || 'TH';

  if (meta.type === 'power'){
    if (meta.power==='dual'){
      g.target2 = rotate(g.target1, g.target2);
      g.dualRemain = DUAL_DURATION[state.difficulty] || 12;
      fx?.popText?.('DUAL TARGET!', { color:'#ffd54a' }); sfx?.play?.('sfx-powerup');
      refreshHUD(state, hud); return 'power';
    }
    if (meta.power==='scorex2'){
      g.scorex2Remain = SCOREX2_SECONDS;
      power?.apply?.('boost');
      fx?.popText?.('SCORE ×2', { color:'#b0ff66' }); sfx?.play?.('sfx-powerup');
      refreshHUD(state, hud); return 'power';
    }
    if (meta.power==='freeze'){
      const now = performance?.now?.() ?? Date.now();
      state.freezeUntil = now + FREEZE_SECONDS*1000;
      g.freezeRemain = FREEZE_SECONDS;
      fx?.popText?.('FREEZE!', { color:'#66e0ff' }); sfx?.play?.('sfx-powerup');
      refreshHUD(state, hud); return 'power';
    }
    if (meta.power==='rotate'){
      g.target1 = rotate(g.target1, g.target2);
      fx?.popText?.('ROTATE!', { color:'#ffdd66' }); sfx?.play?.('sfx-tick');
      refreshHUD(state, hud); return 'power';
    }
    return 'power';
  }

  if (meta.type !== 'food'){ sfx?.play?.('sfx-bad'); return 'bad'; }

  if (meta.good){
    sfx?.play?.('sfx-good'); coach?.say?.(lang==='TH'?'เข้าเป้า!':'On target!');
    g.targetHits = (g.targetHits||0) + 1;
    if (g.mission && !g.mission.done){ g.mission.progress++; }
    if (g.targetHits>=3){ g.target1 = rotate(g.target1, g.target2); g.targetHits=0; refreshHUD(state, hud); }
    return 'good';
  }

  // ถูกหมู่แต่ไม่ตรงเป้า? -> OK (+2)
  if (GROUPS[meta.groupKey]){
    sfx?.play?.('sfx-tick'); coach?.say?.(lang==='TH'?'ดี แต่ไม่ตรงเป้า':'OK, not target');
    return 'ok';
  }

  sfx?.play?.('sfx-bad'); coach?.say?.(lang==='TH'?'ผิดหมวด!':'Wrong group!');
  return 'bad';
}

export function cleanup(state, hud){
  try{ hud?.hideTarget?.(); }catch{}
  const b = document.getElementById('targetBadge'); if (b) b.textContent='—';
}

/* Helpers */
function labelTH(k){ return GROUPS[k]?.th || '—'; }
function rotate(exA, exB){ const pool = KEYS.filter(k=>k!==exA && k!==exB); return pick(pool.length?pool:KEYS); }
function isOnTarget(k, g){ return k===g.target1 || (!!g.target2 && k===g.target2); }
function targetChance(diff){ if(diff==='Easy')return 0.5; if(diff==='Hard')return 0.7; return 0.6; }

function rollPower(){
  const total = POWER_MIX.reduce((s,x)=>s+x.w,0);
  let r = Math.random()*total;
  for (const it of POWER_MIX){ if((r-=it.w)<=0) return it; }
  return POWER_MIX[0];
}
function refreshHUD(state, hud){
  const g = state.ctx.groups;
  const keys = [g.target1, g.target2].filter(Boolean);
  let text = keys.length ? keys.map(labelTH).join(' + ') : '—';
  const tags = [];
  if (g.dualRemain>0)    tags.push(`DUAL ${pad(g.dualRemain)}s`);
  if (g.freezeRemain>0)  tags.push(`FREEZE ${pad(g.freezeRemain)}s`);
  if (g.scorex2Remain>0) tags.push(`x2 ${pad(g.scorex2Remain)}s`);
  if (tags.length) text += ' • ' + tags.join(' | ');
  try{ hud?.showTarget?.(); hud?.setTargetBadge?.(text); }catch{
    const w=document.getElementById('targetWrap'); if(w) w.style.display='block';
    const b=document.getElementById('targetBadge'); if(b) b.textContent=text;
  }
}
function updateMissionHUD(state){
  const el = document.getElementById('missionLine'); if(!el) return;
  const m = state.ctx.groups.mission; if(!m){ el.style.display='none'; return; }
  el.style.display='block';
  if (m.done) el.textContent = m.fail ? '⌛ Mission Failed' : '🏁 Mission Complete';
  else el.textContent = `🎯 ตรงเป้า ${m.progress}/${m.need} • ${m.remain|0}s`;
}
function pad(n){ n|=0; return n<10?('0'+n):(''+n); }
