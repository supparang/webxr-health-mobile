// game/modes/groups.js
// โหมด: จาน 5 หมู่ (มีเป้าหมาย + ภารกิจ 45s + power-ups) พร้อมผลลัพธ์สำหรับระบบคอมโบ/ฟีเวอร์

/* =========================
   1) คอนฟิก / คงที่
   ========================= */
const GROUPS = {
  grain:   { labelTH:'ธัญพืช',  em:['🍚','🍞','🥖','🥯','🍜'] },
  veg:     { labelTH:'ผัก',     em:['🥦','🥕','🥬','🌽','🫑'] },
  protein: { labelTH:'โปรตีน',  em:['🥩','🍗','🍖','🥚','🐟'] },
  fruit:   { labelTH:'ผลไม้',   em:['🍎','🍌','🍇','🍓','🍊'] },
  dairy:   { labelTH:'นม',      em:['🥛','🧀','🍦','🍨'] }
};
const KEYS = Object.keys(GROUPS);
const pick = (arr)=>arr[(Math.random()*arr.length)|0];

// ภารกิจ 45 วิ—จำนวนที่ต้องเก็บตามความยาก
const MISSION_NEED = { Easy:6, Normal:8, Hard:10 };

// โอกาสเกิด power-up ต่อการสแปวน์
const POWERUP_RATE  = { Easy:0.09, Normal:0.11, Hard:0.13 };
// น้ำหนักชนิดพาวเวอร์
const POWERUP_MIX = [
  { type:'power_dual',    w:4, icon:'✨'  }, // มีเป้า 2 หมวด
  { type:'power_scorex2', w:3, icon:'✖️2' }, // คูณคะแนนชั่วคราว
  { type:'power_freeze',  w:2, icon:'🧊'  }, // ชะลอสแปวน์
  { type:'power_rotate',  w:2, icon:'🔄'  }  // เปลี่ยนเป้าทันที
];

// สุ่มชนิด power-up ตามน้ำหนัก
function rollPower(){
  const total = POWERUP_MIX.reduce((s,x)=>s+x.w,0);
  let r = Math.random()*total;
  for(const it of POWERUP_MIX){ if((r-=it.w)<=0) return it; }
  return POWERUP_MIX[0];
}

/* =========================
   2) HUD helpers (fallback DOM)
   ========================= */
function setTargetBadge(text){
  const w = document.getElementById('targetWrap');
  const b = document.getElementById('targetBadge');
  if (w) w.style.display = 'block';
  if (b) b.textContent = text || '—';
}
function labelTH(k){ return GROUPS[k]?.labelTH || '—'; }
function rotateSingleTarget(exceptA, exceptB){
  const pool = KEYS.filter(k=>k!==exceptA && k!==exceptB);
  return pick(pool.length?pool:KEYS);
}
function targetChanceByDiff(diff){
  if (diff==='Easy') return 0.5;
  if (diff==='Hard') return 0.7;
  return 0.6;
}
function isOnTarget(k, gctx){ return k===gctx.target1 || (!!gctx.target2 && k===gctx.target2); }
function pad(n){ n|=0; return n<10?('0'+n):(''+n); }

function refreshTargetHUD(state){
  const g = state.ctx.groups;
  const keys = [g.target1, g.target2].filter(Boolean);
  let text = keys.length ? keys.map(labelTH).join(' + ') : '—';
  const tags = [];
  if (g.dualRemain>0)    tags.push(`DUAL ${pad(g.dualRemain)}s`);
  if (g.freezeRemain>0)  tags.push(`FREEZE ${pad(g.freezeRemain)}s`);
  if (g.scorex2Remain>0) tags.push(`x2 ${pad(g.scorex2Remain)}s`);
  if (tags.length) text += ' • ' + tags.join(' | ');
  setTargetBadge(text);
}

function updateMissionLine(state){
  const el = document.getElementById('missionLine');
  if (!el) return;
  const m = state.ctx.groups.mission;
  if (!m){ el.style.display='none'; return; }
  el.style.display = 'block';
  if (m.done) el.textContent = m.fail ? '⌛ Mission Failed' : '🏁 Mission Complete';
  else el.textContent = `🎯 ตรงเป้า ${m.progress}/${m.need} • ${m.remain|0}s`;
}

/* =========================
   3) Public API
   ========================= */
export function init(state){
  state.ctx = state.ctx || {};
  state.ctx.groups = {
    target1: rotateSingleTarget(), // เป้าเริ่มต้น
    target2: null,
    targetHits: 0,
    // timers
    dualRemain: 0,
    scorex2Remain: 0,
    freezeRemain: 0,
    // mission
    mission: {
      need: MISSION_NEED[state.difficulty] ?? 8,
      progress: 0,
      remain: 45,
      done: false,
      fail: false
    }
  };
  refreshTargetHUD(state);
  updateMissionLine(state);
}

export function tick(state, sys){
  const { power, coach, sfx, fx } = sys || {};
  const g = state.ctx?.groups; if (!g) return;

  // Mission countdown
  if (g.mission && !g.mission.done){
    g.mission.remain = Math.max(0, g.mission.remain - 1);
    if (g.mission.progress >= g.mission.need){
      g.mission.done = true;
      fx?.popText?.('🏁 Mission Complete', { color:'#7fffd4' });
      try{ sfx?.play?.('sfx-perfect'); }catch{}
      coach?.say?.(state.lang==='TH'?'มิชชันผ่าน!':'Mission complete!');
    }else if (g.mission.remain === 0){
      g.mission.done = true; g.mission.fail = true;
      fx?.popText?.('⌛ Mission Failed', { color:'#ff9b9b' });
      coach?.say?.(state.lang==='TH'?'มิชชันพลาด':'Mission failed');
    }
  }

  // Timers for power-ups
  let needHUD = false;
  if (g.dualRemain>0){ g.dualRemain--; needHUD=true; if (g.dualRemain===0){ g.target2=null; coach?.say?.(state.lang==='TH'?'หมดพลัง Dual':'Dual over'); } }
  if (g.scorex2Remain>0){ g.scorex2Remain--; needHUD=true; }
  if (g.freezeRemain>0){
    g.freezeRemain--; needHUD=true;
    if (g.freezeRemain===0 && power){ power.timeScale = 1; coach?.say?.(state.lang==='TH'?'เลิก Freeze':'Freeze over'); }
  }

  if (needHUD) refreshTargetHUD(state);
  updateMissionLine(state);
}

export function pickMeta(diff, state){
  const g = state.ctx?.groups || {};

  // roll power-up
  if (Math.random() < (POWERUP_RATE[state.difficulty] || 0.1)){
    const p = rollPower();
    return { type:p.type, char:p.icon, life: Math.max(2000, diff?.life ?? 2500) };
  }

  // food item
  const useDual = !!g.target2;
  const wantTarget = Math.random() < targetChanceByDiff(state.difficulty);

  let key;
  if (useDual && wantTarget) key = Math.random()<0.5 ? g.target1 : g.target2;
  else if (wantTarget)       key = g.target1;
  else                       key = rotateSingleTarget(g.target1, g.target2);

  const char = pick(GROUPS[key].em);
  const life = diff?.life ?? 3000;
  return { type:'food', char, life, groupKey:key, good: isOnTarget(key, g) };
}

export function onHit(meta, sys, state){
  const { score, sfx, fx, coach, power } = sys || {};
  const g = state.ctx?.groups;
  const lang = state.lang || 'TH';

  // ----- Power-ups -----
  if (meta.type === 'power_dual'){
    g.target2 = rotateSingleTarget(g.target1);
    g.dualRemain = ({Easy:10,Normal:12,Hard:14}[state.difficulty]) || 12;
    refreshTargetHUD(state);
    fx?.popText?.('DUAL TARGET!', { color:'#ffd54a' });
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    coach?.say?.(lang==='TH'?'เป้า ×2 ชั่วคราว!':'Dual targets!');
    score?.add?.(3);
    return 'power';
  }
  if (meta.type === 'power_scorex2'){
    g.scorex2Remain = 7;
    refreshTargetHUD(state);
    fx?.popText?.('SCORE ×2', { color:'#b0ff66' });
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    coach?.say?.(lang==='TH'?'คะแนน x2 ชั่วคราว!':'Score x2!');
    return 'power';
  }
  if (meta.type === 'power_freeze'){
    g.freezeRemain = 2;
    if (power) power.timeScale = 99; // แทบหยุด 2 วิ
    refreshTargetHUD(state);
    fx?.popText?.('FREEZE!', { color:'#66e0ff' });
    try{ sfx?.play?.('sfx-powerup'); }catch{}
    coach?.say?.(lang==='TH'?'แช่แข็ง!':'Freeze!');
    return 'power';
  }
  if (meta.type === 'power_rotate'){
    g.target1 = rotateSingleTarget(g.target1, g.target2);
    refreshTargetHUD(state);
    fx?.popText?.('ROTATE!', { color:'#ffdd66' });
    try{ sfx?.play?.('sfx-tick'); }catch{}
    coach?.say?.(lang==='TH'?'เปลี่ยนเป้าแล้ว!':'Target rotated!');
    return 'power';
  }

  // ----- Food -----
  if (meta.type !== 'food') return 'ok';

  if (meta.good){
    // ถูกเป้า
    const isX2 = g.scorex2Remain>0;
    const kind = isX2 ? 'perfect' : 'good'; // ให้ main.js เร่งฟีเวอร์
    score?.add?.(isX2 ? 0 : 0); // การคูณให้ main.js จัดการ
    fx?.popText?.(isX2?'+(x2)':'+' , { color: isX2 ? '#ccff88' : '#7fffd4' });
    try{ sfx?.good?.(); }catch{}
    coach?.say?.(lang==='TH'?'เข้าเป้า!':'On target!');

    // mission progress
    const m = g.mission;
    if (m && !m.done) m.progress++;

    // หมุนเป้าทุก 3 ชิ้นที่เข้าเป้า
    g.targetHits = (g.targetHits||0)+1;
    if (g.targetHits>=3){
      g.target1 = rotateSingleTarget(g.target1, g.target2);
      g.targetHits = 0;
      refreshTargetHUD(state);
    }
    return kind;
  }

  // ไม่ตรงเป้าแต่ยัง “อยู่ในหมวด” → ok (คะแนนเล็กน้อย)
  if (GROUPS[meta.groupKey]){
    try{ sfx?.play?.('sfx-tick'); }catch{}
    fx?.popText?.('+', { color:'#9fdcff' });
    coach?.say?.(lang==='TH'?'ดี แต่ไม่ตรงเป้า':'OK, not target');
    return 'ok';
  }

  // กรณีอื่น ๆ (แทบไม่เกิด) → bad
  try{ sfx?.bad?.(); }catch{}
  fx?.popText?.('-2', { color:'#ff7a7a' });
  coach?.say?.(lang==='TH'?'ผิดหมวด!':'Wrong group!');
  return 'bad';
}

export function cleanup(state){
  const b = document.getElementById('targetBadge'); if (b) b.textContent = '—';
  const w = document.getElementById('targetWrap');  if (w) w.style.display = 'none';
  if (state?.ctx?.groups){
    state.ctx.groups.target1 = null;
    state.ctx.groups.target2 = null;
    state.ctx.groups.mission = null;
  }
}
