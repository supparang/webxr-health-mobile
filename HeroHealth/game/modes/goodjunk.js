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
  { type:'power_dual',   w:4, icon:'✨' }, // มีเป้า 2 หมวด
  { type:'power_scorex2',w:3, icon:'✖️2' }, // แจ้งส่วนกลางด้วย 'power' ให้โชว์เอฟเฟกต์
  { type:'power_freeze', w:2, icon:'🧊' },  // ชะลอสแปวน์ (ผ่าน power.timeScale ที่ main.js ใช้อยู่แล้ว)
  { type:'power_rotate', w:2, icon:'🔄' }   // เปลี่ยนเป้าทันที
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
  refresh
