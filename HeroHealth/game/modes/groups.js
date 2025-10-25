// game/modes/groups.js
// โหมด: จาน 5 หมู่ + Mission 45s + Power-ups (Dual/Scorex2/Freeze/RotateNow) + HUD Timer

/* =========================
   1) คอนฟิก / คงที่
   ========================= */
const GROUPS = {
  grain:   { labelTH:'ธัญพืช',  labelEN:'Grain',   em:['🍚','🍞','🥖','🥯','🍜'] },
  veg:     { labelTH:'ผัก',     labelEN:'Veg',     em:['🥦','🥕','🥬','🌽','🫑'] },
  protein: { labelTH:'โปรตีน',  labelEN:'Protein', em:['🥩','🍗','🍖','🥚','🐟'] },
  fruit:   { labelTH:'ผลไม้',   labelEN:'Fruit',   em:['🍎','🍌','🍇','🍓','🍊'] },
  dairy:   { labelTH:'นม',      labelEN:'Dairy',   em:['🥛','🧀','🍦','🍨'] }
};
const GROUP_KEYS = Object.keys(GROUPS);
const pick = (arr)=>arr[(Math.random()*arr.length)|0];

const DUAL_DURATION   = { Easy:10, Normal:12, Hard:14 }; // วินาที
const SCOREX2_SECONDS = 7;
const FREEZE_SECONDS  = 2;

const POWERUP_RATE  = { Easy:0.09, Normal:0.11, Hard:0.13 };
const POWERUP_MIX = [
  { type:'powerup_dual',       weight:4, icon:'✨'  },
  { type:'powerup_scorex2',    weight:3, icon:'✖️2' },
  { type:'powerup_freeze',     weight:2, icon:'🧊'  },
  { type:'powerup_rotate_now', weight:2, icon:'🔄'  },
];

/* =========================
   2) Utils & HUD helpers
   ========================= */
function labelOf(key, lang='TH'){
  const g = GROUPS[key]; if(!g) return '—';
  return lang==='EN' ? g.labelEN : g.labelTH;
}
function setTargetHUD(state, hud){
  const lang = state.lang || 'TH';
  const gctx = state.ctx.groups;
  const keys = [gctx.target1, gctx.target2].filter(Boolean);
  let text = keys.map(k=>labelOf(k, lang)).join(' + ');
  if (!text) text = '—';

  const tags = [];
  if (gctx.dualRemain>0)    tags.push(`DUAL ${pad(gctx.dualRemain)}s`);
  if (gctx.scorex2Remain>0) tags.push(`x2 ${pad(gctx.scorex2Remain)}s`);
  if (gctx.freezeRemain>0)  tags.push(`FREEZE ${pad(gctx.freezeRemain)}s`);
  if (tags.length) text += ' • ' + tags.join(' | ');

  if (hud?.showTarget) hud.showTarget();
  if (hud?.setTargetBadge) hud.setTargetBadge(text);
  else {
    const b = document.getElementById('targetBadge'); if (b) b.textContent = text;
    const w = document.getElementById('targetWrap');  if (w) w.style.display = 'block';
  }
}
function setMissionLine(text){
  const el = document.getElementById('missionLine');
  if (!el) return;
  el.style.display = text ? 'block' : 'none';
  if (text) el.textContent = text;
}
function rotateSingleTarget(exceptA, exceptB){
  const pool = GROUP_KEYS.filter(k=>k!==exceptA && k!==exceptB);
  return pick(pool.length?pool:GROUP_KEYS);
}
function targetChanceByDiff(diffKey){
  if(diffKey==='Easy') return 0.45;
  if(diffKey==='Hard') return 0.65;
  return 0.55;
}
function isOnTarget(groupKey, gctx){
  return groupKey === gctx.target1 || (!!gctx.target2 && groupKey === gctx.target2);
}
function pad(n){ n|=0; return n<10?('0'+n):(''+n); }
function rollPowerup(){
  const total = POWERUP_MIX.reduce((s,x)=>s+x.weight,0);
  let r = Math.random()*total;
  for (const it of POWERUP_MIX){ if ((r-=it.weight) <= 0) return it; }
  return POWERUP_MIX[0];
}

/* =========================
   3) Public API
   ========================= */
export function init(state, hud, diff){
  state.ctx = state.ctx || {};
  state.ctx.groups = {
    target1: rotateSingleTarget(),
    target2: null,
    targetHits: 0,
    dualRemain: 0,
    scorex2Remain: 0,
    freezeRemain: 0,
    mission: newMissionWindow(state)
  };
  setTargetHUD(state, hud);
  updateMissionHUD(state);
}

export function tick(state, sys, hud){
  const { fx, sfx, coach, power } = sys || {};
  const gctx = state.ctx?.groups; if(!gctx) return;

  // ===== Mission 45s =====
  if (gctx.mission && !gctx.mission.done){
    gctx.mission.remain = Math.max(0, gctx.mission.remain - 1);
    if (gctx.mission.progress >= gctx.mission.need){
      gctx.mission.done = true;
      fx?.popText?.('🏁 Mission Complete', { color:'#7fffd4' });
      sfx?.perfect?.(); coach?.say?.(state.lang==='TH'?'มิชชันผ่าน!':'Mission complete!');
    }else if (gctx.mission.remain === 0){
      gctx.mission.done = true; gctx.mission.fail = true;
      fx?.popText?.('⌛ Mission Failed', { color:'#ff9b9b' });
      coach?.say?.(state.lang==='TH'?'มิชชันพลาด':'Mission failed');
    }
  }

  // ===== Timers =====
  let needUpdateHUD = false;

  if (gctx.dualRemain > 0){
    gctx.dualRemain--; needUpdateHUD = true;
    if (gctx.dualRemain === 0){ gctx.target2 = null; coach?.say?.(state.lang==='TH'?'หมดพลัง Dual':'Dual over'); }
  }
  if (gctx.scorex2Remain > 0){ gctx.scorex2Remain--; needUpdateHUD = true; }
  if (gctx.freezeRemain > 0){
    gctx.freezeRemain--; needUpdateHUD = true;
    if (gctx.freezeRemain === 0 && power){
      power.timeScale = 1;
      coach?.say?.(state.lang==='TH'?'เลิก Freeze':'Freeze over');
    }
  }

  updateMissionHUD(state);
  if (needUpdateHUD) setTargetHUD(state, hud);
}

export function pickMeta(diff, state){
  const gctx = state.ctx?.groups || {};

  // power-up roll
  if (Math.random() < (POWERUP_RATE[state.difficulty] || 0.1)){
    const p = rollPowerup();
    return {
      type: p.type,
      char: p.icon,
      life: Math.max(2000, diff?.life ?? 2500)
    };
  }

  // food item
  const useDual = !!gctx.target2;
  const wantTarget = Math.random() < targetChanceByDiff(state.difficulty);

  let groupKey;
  if (useDual && wantTarget){
    groupKey = Math.random()<0.5 ? gctx.target1 : gctx.target2;
  }else if (wantTarget){
    groupKey = gctx.target1;
  }else{
    groupKey = rotateSingleTarget(gctx.target1, gctx.target2);
  }

  const char = pick(GROUPS[groupKey].em);
  const life = (diff?.life ?? 3000);
  return {
    type:'food', char, life, groupKey,
    good: isOnTarget(groupKey, gctx)
  };
}

export function onHit(meta, sys, state, hud){
  const { score, sfx, fx, coach, power } = sys || {};
  const lang = state.lang || 'TH';
  const gctx = state.ctx?.groups;

  // ==== power-ups ====
  if (meta.type === 'powerup_dual'){
    gctx.target2 = rotateSingleTarget(gctx.target1);
    gctx.dualRemain = DUAL_DURATION[state.difficulty] || 12;
    setTargetHUD(state, hud);
    fx?.popText?.('DUAL TARGET!', { color:'#ffd54a' });
    sfx?.powerup?.(); coach?.say?.(lang==='TH'?'เป้า ×2 ชั่วคราว!':'Dual targets!');
    score?.add?.(3);
    return;
  }
  if (meta.type === 'powerup_scorex2'){
    gctx.scorex2Remain = SCOREX2_SECONDS;
    setTargetHUD(state, hud);
    fx?.popText?.('SCORE ×2', { color:'#b0ff66' });
    sfx?.powerup?.(); coach?.say?.(lang==='TH'?'คะแนน x2 ชั่วคราว!':'Score x2!');
    return;
  }
  if (meta.type === 'powerup_freeze'){
    gctx.freezeRemain = FREEZE_SECONDS;
    if (power) power.timeScale = 99; // ชะลอการ spawn ชั่วคราว
    setTargetHUD(state, hud);
    fx?.popText?.('FREEZE!', { color:'#66e0ff' });
    sfx?.powerup?.(); coach?.say?.(lang==='TH'?'แช่แข็ง!':'Freeze!');
    return;
  }
  if (meta.type === 'powerup_rotate_now'){
    gctx.target1 = rotateSingleTarget(gctx.target1, gctx.target2);
    setTargetHUD(state, hud);
    fx?.popText?.('ROTATE!', { color:'#ffdd66' });
    sfx?.tick?.(); coach?.say?.(lang==='TH'?'เปลี่ยนเป้าแล้ว!':'Target rotated!');
    return;
  }

  // ==== food ====
  if (meta.type !== 'food'){ score?.add?.(1); fx?.popText?.('+1', { color:'#8ff' }); return; }

  const mul = (gctx.scorex2Remain>0) ? 2 : 1;

  if (meta.good){
    const add = 7 * mul;
    score?.add?.(add);
    score.combo = (score.combo||0) + 1;
    fx?.popText?.(`+${add}`, { color: mul>1 ? '#ccff88' : '#7fffd4' });
    sfx?.good?.();
    coach?.say?.(lang==='TH'?'เข้าเป้า!':'On target!');
    gctx.targetHits = (gctx.targetHits||0) + 1;

    if (gctx.mission && !gctx.mission.done && gctx.mission.kind==='collect_target'){
      gctx.mission.progress++;
    }
    if (gctx.targetHits >= 3){
      gctx.target1 = rotateSingleTarget(gctx.target1, gctx.target2);
      gctx.targetHits = 0;
      setTargetHUD(state, hud);
    }
    return;
  }

  // ถูกหมวดแต่ไม่ใช่เป้า
  if (GROUPS[meta.groupKey]){
    const add = 2 * mul;
    score?.add?.(add);
    fx?.popText?.(`+${add}`, { color: mul>1 ? '#bde0ff' : '#9fdcff' });
    sfx?.tick?.();
    coach?.say?.(lang==='TH'?'ดี แต่ไม่ตรงเป้า':'OK, not target');
    return;
  }

  // ผิดหมวด
  score?.add?.(-2);
  score.combo = 0;
  fx?.popText?.('-2', { color:'#ff7a7a' });
  sfx?.bad?.();
  coach?.say?.(lang==='TH'?'ผิดหมวด!':'Wrong group!');
}

/* =========================
   4) Mission (ภายในโหมด)
   ========================= */
function newMissionWindow(state){
  const byDiff = { Easy: 6, Normal: 8, Hard: 10 };
  const need = byDiff[state.difficulty] ?? 8;
  return { kind:'collect_target', need, progress:0, remain:45, done:false, fail:false };
}
function updateMissionHUD(state){
  const gctx = state.ctx?.groups;
  if (!gctx?.mission) { setMissionLine(''); return; }
  const m = gctx.mission;
  if (m.done){
    setMissionLine(m.fail ? '⌛ Mission Failed' : '🏁 Mission Complete');
    return;
  }
  const lang = state.lang || 'TH';
  const lbl = lang==='TH' ? 'ตรงเป้า' : 'on target';
  setMissionLine(`🎯 ${lbl} ${m.progress}/${m.need} • ${m.remain|0}s`);
}

/* =========================
   5) Cleanup (optional)
   ========================= */
export function cleanup(state, hud){
  try{ hud?.hideTarget?.(); }catch{}
  const badge = document.getElementById('targetBadge'); if (badge) badge.textContent = '—';
  if (state?.ctx){
    state.ctx.target = null;
    state.ctx.targetHitsTotal = 0;
    state.ctx.wrongGroup = 0;
  }
}
