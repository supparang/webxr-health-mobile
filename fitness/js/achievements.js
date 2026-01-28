// === /fitness/js/achievements.js ===
// Daily Challenge + Achievements (sticky retention) — localStorage only
'use strict';

const KEY = 'SB_ACH_v1';
const DKEY = 'SB_DAILY_CHALLENGE_v1';

function todayKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function load(key, fallback){
  try{ const r=localStorage.getItem(key); return r?JSON.parse(r):fallback; }catch{ return fallback; }
}
function save(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{} }

export function getDailyChallenge() {
  const t = todayKey();
  const cur = load(DKEY, null);
  if (cur && cur.key === t) return cur;

  // daily target: simple + fun
  const pool = [
    { id:'acc90', title:'Accuracy 90%+', desc:'เล่นให้แม่น 90% ขึ้นไป', check:(s)=>s.accuracy_pct>=90 },
    { id:'noBomb', title:'No Bomb Hit', desc:'ห้ามโดนระเบิดเลย', check:(s)=>Number(s.total_bombs_hit||0)===0 },
    { id:'combo20', title:'Combo 20+', desc:'ทำคอมโบให้ถึง 20', check:(s)=>Number(s.max_combo||0)>=20 },
    { id:'boss1', title:'Clear 1 Boss', desc:'เคลียร์บอสอย่างน้อย 1 ตัว', check:(s)=>Number(s.bosses_cleared||0)>=1 },
  ];
  const pick = pool[(Math.random()*pool.length)|0];

  const obj = { key:t, ...pick, done:false };
  save(DKEY, obj);
  return obj;
}

export function markDailyDone(){
  const cur = load(DKEY, null);
  if (!cur) return null;
  cur.done = true;
  save(DKEY, cur);
  return cur;
}

export function loadAchievements(){
  return load(KEY, { unlocked:{} });
}

export function unlock(achId, payload){
  const st = loadAchievements();
  if (!st.unlocked[achId]) {
    st.unlocked[achId] = { ts: Date.now(), payload: payload || {} };
    save(KEY, st);
    return true;
  }
  return false;
}

// Evaluate achievements after a run (session summary)
export function evalAchievements(summary){
  const newly = [];

  const tryUnlock = (id, name) => {
    if (unlock(id, { name })) newly.push({ id, name });
  };

  if (summary.grade === 'SSS' || summary.grade === 'SS') tryUnlock('rank_ss', '🏅 Rank SS+');
  if (Number(summary.accuracy_pct) >= 95) tryUnlock('acc95', '🎯 Accuracy 95%+');
  if (Number(summary.max_combo) >= 25) tryUnlock('combo25', '🔥 Combo 25+');
  if (Number(summary.bosses_cleared) >= 2) tryUnlock('boss2', '👑 Boss Slayer (2+)');
  if (Number(summary.total_miss) === 0 && Number(summary.total_targets) >= 10) tryUnlock('no_miss', '🧊 No Miss Run');

  return newly;
}