// === Hero Health Academy — game/core/progression.js ===
const STORE_KEY = 'hha_profile_v1';

// --- utils ---
function load(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY))||null; }catch{ return null; } }
function save(p){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(p)); }catch{} }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function now(){ return performance?.now?.()||Date.now(); }

// ตารางเลเวล (1–50)
const XP_TABLE = Array.from({length:50}, (_,i)=> 100 + i*40); // xp ต่อเลเวล
function xpToNext(profile){
  const idx = clamp(profile.level-1, 0, XP_TABLE.length-1);
  return XP_TABLE[idx] || XP_TABLE.at(-1);
}

// --------- Badges ---------
const BADGES = [
  { id:'first_blood',   th:'ก้าวแรก',     en:'First Steps',    cond:(p)=>p.meta.totalRuns>=1 },
  { id:'hundred_score', th:'ร้อยแต้ม!',   en:'Hundred!',       cond:(p)=>p.meta.bestScore>=100 },
  { id:'combo_20',      th:'คอมโบ x20',   en:'Combo x20',      cond:(p)=>p.meta.bestCombo>=20 },
  { id:'gold_hunter',   th:'นักล่าทอง',   en:'Golden Hunter',  cond:(p)=>p.meta.goldenHits>=5 },
  { id:'fever_master',  th:'FEVER จ้าว',  en:'Fever Master',   cond:(p)=>p.meta.feverActivations>=5 },
  { id:'marathon_10',   th:'มาราธอน',     en:'Marathon',       cond:(p)=>p.meta.totalRuns>=10 },
];

// --------- Missions (per mode) ---------
const MISSION_POOLS = {
  groups: [
    { id:'grp_any_20',   th:'สะสมเป้าหมายรวม 20 ชิ้น', en:'Collect 20 target items', need:20,  type:'count_target' },
    { id:'grp_perfect6', th:'ทำ Perfect 6 ครั้ง',        en:'Hit 6 Perfects',          need:6,   type:'count_perfect' },
    { id:'grp_golden2',  th:'เก็บทอง 2 ชิ้น',           en:'Hit 2 Golden',            need:2,   type:'count_golden' },
    { id:'grp_chain10',  th:'ไม่พลาด 10 ครั้งติด',       en:'No miss 10 in a row',     need:10,  type:'streak_nomiss' },
    { id:'grp_veg5',     th:'เก็บผัก 5 ชิ้น',            en:'Collect 5 veggies',       need:5,   type:'count_group', group:'veggies' },
  ],
  goodjunk: [
    { id:'gj_good25',    th:'เก็บอาหารดี 25 ชิ้น',      en:'Collect 25 good',         need:25,  type:'count_good' },
    { id:'gj_perfect5',  th:'Perfect 5 ครั้ง',           en:'5 Perfects',              need:5,   type:'count_perfect' },
    { id:'gj_combo15',   th:'ทำคอมโบถึง x15',           en:'Reach combo x15',         need:15,  type:'reach_combo' },
    { id:'gj_fever2',    th:'เปิด FEVER 2 ครั้ง',        en:'Trigger FEVER 2x',        need:2,   type:'count_fever' },
    { id:'gj_avoid5',    th:'ไม่โดนขยะ 5 ชิ้นติดกัน',   en:'Avoid 5 junk in a row',   need:5,   type:'streak_nomiss' },
  ],
  hydration: [
    { id:'hy_balance3',  th:'รักษาสมดุล 3 ช่วง',        en:'Stay in balance 3x',      need:3,   type:'hy_balance' },
    { id:'hy_combo12',   th:'คอมโบถึง x12',             en:'Combo x12',               need:12,  type:'reach_combo' },
    { id:'hy_perfect4',  th:'Perfect 4 ครั้ง',           en:'4 Perfects',              need:4,   type:'count_perfect' },
    { id:'hy_time90',    th:'อยู่รอด 90 วินาที',         en:'Survive 90s',             need:90,  type:'survive_time' },
    { id:'hy_fever1',    th:'เปิด FEVER 1 ครั้ง',        en:'Trigger FEVER',           need:1,   type:'count_fever' },
  ],
  plate: [
    { id:'pl_complete3', th:'จัดจานครบ 3 ครั้ง',        en:'Complete plate 3x',       need:3,   type:'plate_complete' },
    { id:'pl_veg4',      th:'ใส่ผักรวม 4 ส่วน',          en:'Add 4 veggie portions',   need:4,   type:'plate_add_group', group:'veggies' },
    { id:'pl_combo10',   th:'คอมโบถึง x10',              en:'Combo x10',               need:10,  type:'reach_combo' },
    { id:'pl_perfect3',  th:'Perfect 3 ครั้ง',            en:'3 Perfects',              need:3,   type:'count_perfect' },
    { id:'pl_time60',    th:'อยู่รอด 60 วินาที',         en:'Survive 60s',             need:60,  type:'survive_time' },
  ],
};

function rollMissions(mode, lang='TH'){
  const pool = (MISSION_POOLS[mode]||[]).slice();
  if (!pool.length) return [];
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0,3).map(m=>({ ...m, label:(lang==='EN'?m.en:m.th), prog:0, done:false }));
}

// ---------- Progress singleton ----------
export const Progress = {
  profile: null,
  listeners: new Set(),
  runCtx: null,

  init(){
    const p = load() || {
      name: 'Player',
      level: 1,
      xp: 0,
      badges: {},    // {id:true}
      modes: {},     // { modeKey:{bestScore, acc, runs, missionDone} }
      stats: { totalPlayTime:0, lastPlayedAt:0 },
      meta:  { totalRuns:0, bestScore:0, bestCombo:0, goldenHits:0, feverActivations:0 },
      daily: null
    };
    this.profile = p;
    save(p);
    return p;
  },

  on(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); },
  emit(type,payload){ for(const fn of this.listeners){ try{ fn(type,payload); }catch{} } },

  beginRun(mode, difficulty, lang='TH'){
    const missions = rollMissions(mode, lang);
    this.runCtx = {
      mode, difficulty, lang,
      startAt: now(),
      missions,
      counters:{
        hits:0, good:0, perfect:0, bad:0,
        target:0, golden:0, comboMax:0, fever:0,
        groupCount:{},
      }
    };
    this.emit('run_start', {mode, difficulty, missions});
    return missions;
  },

  endRun({score=0, bestCombo=0, timePlayed=0, accPct=0}={}){
    if (!this.runCtx) return;
    const p = this.profile;
    const questClears = this.runCtx.missions.filter(m=>m.done).length;

    // XP
    const gain = Math.round(score*0.5 + questClears*40 + bestCombo*2);
    this.addXP(gain);

    // meta
    p.meta.totalRuns += 1;
    p.meta.bestScore = Math.max(p.meta.bestScore, score);
    p.meta.bestCombo = Math.max(p.meta.bestCombo, bestCombo);
    p.stats.totalPlayTime += Math.max(0, timePlayed|0);
    p.stats.lastPlayedAt = Date.now();

    // per-mode stats (avg accuracy)
    const mk = this.runCtx.mode;
    p.modes[mk] = p.modes[mk] || {bestScore:0, acc:0, runs:0, missionDone:0};
    const ms = p.modes[mk];
    ms.bestScore = Math.max(ms.bestScore, score);
    ms.acc = (ms.acc*ms.runs + (accPct||0)) / (ms.runs+1);
    ms.runs += 1;
    ms.missionDone += questClears;

    this._checkBadges();
    save(p);

    // Daily check
    this.checkDaily({ score, acc:accPct, mode:mk });

    this.emit('run_end', {score, bestCombo, quests:questClears, xpGain:gain, level:p.level, xp:p.xp});
    this.runCtx = null;
  },

  addXP(x){
    const p = this.profile; if (!p) return;
    p.xp += x;
    while (p.level < 50){
      const need = xpToNext(p);
      if (p.xp < need) break;
      p.xp -= need;
      p.level++;
      this.emit('level_up', {level:p.level});
    }
    save(p);
  },

  event(type, data={}){
    if (!this.runCtx) return;
    const C = this.runCtx.counters;

    if (type==='hit'){
      const { result, meta, comboNow } = data;
      C.hits++;
      if (comboNow) C.comboMax = Math.max(C.comboMax, comboNow);
      if (result==='good'){ C.good++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='perfect'){ C.perfect++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='bad'){ C.bad++; }
      if (meta?.golden){ C.golden++; this.profile.meta.goldenHits++; }

      for (const m of this.runCtx.missions){
        if (m.done) continue;
        switch(m.type){
          case 'count_target':  m.prog = C.target; break;
          case 'count_perfect': m.prog = C.perfect; break;
          case 'count_golden':  m.prog = C.golden; break;
          case 'streak_nomiss': if (result!=='bad') m.prog = Math.max(m.prog, comboNow||0); break;
          case 'count_group':   m.prog = C.groupCount[m.group]||0; break;
          case 'reach_combo':   m.prog = Math.max(m.prog, comboNow||0); break;
        }
        if (m.prog >= m.need){ m.done=true; this.addXP(60); this.emit('mission_done', {mission:m}); }
      }
    }

    if (type==='fever' && data.kind==='start'){ C.fever++; this.profile.meta.feverActivations++; }
    save(this.profile);
  },

  _checkBadges(){
    const p = this.profile;
    for (const b of BADGES){
      if (p.badges[b.id]) continue;
      if (b.cond(p)){ p.badges[b.id]=true; this.emit('badge_unlock', {id:b.id, name:b.th}); }
    }
    save(p);
  },

  // ---- Daily Challenge ----
  genDaily(){
    const d = new Date(); const today = d.toISOString().slice(0,10);
    const p = this.profile;
    if (p.daily?.date === today) return p.daily;
    const missions = [
      { id:'score300',   label:'ได้คะแนน ≥ 300',  check:(r)=>r.score>=300 },
      { id:'accuracy80', label:'ความแม่น ≥ 80%',  check:(r)=>r.acc>=80 },
      { id:'play2modes', label:'เล่นครบ 2 โหมด',  check:()=>true },
    ];
    const picks = missions.sort(()=>Math.random()-0.5).slice(0,3);
    p.daily = { date:today, missions:picks, done:[], modesPlayed:new Set?new Set():[] };
    // Set ไม่ serialize: แปลงเป็น array เวลา save/load (ง่ายสุดใช้ array)
    p.daily.modesPlayed = [];
    save(p);
    return p.daily;
  },

  checkDaily(result){
    const p = this.profile;
    if (!p.daily) return;
    // track โหมดที่เล่นวันนี้
    if (!Array.isArray(p.daily.modesPlayed)) p.daily.modesPlayed = [];
    if (!p.daily.modesPlayed.includes(result.mode)) p.daily.modesPlayed.push(result.mode);

    for(const m of p.daily.missions){
      if (p.daily.done.includes(m.id)) continue;
      let ok = m.check(result);
      if (m.id==='play2modes') ok = (p.daily.modesPlayed.length >= 2);
      if (ok) p.daily.done.push(m.id);
    }
    if (p.daily.done.length===p.daily.missions.length) this.giveReward('daily');
    save(p);
  },

  giveReward(kind){
    if (kind==='daily') this.addXP(80);
    else this.addXP(30);
  },

  // snapshot สำหรับบอร์ดสถิติรวม
  getStatSnapshot(){
    const p = this.profile;
    const modes = p.modes||{};
    const rows = Object.entries(modes).map(([k,v])=>({
      key:k, bestScore:v.bestScore||0, acc: +(v.acc||0).toFixed(1), runs:v.runs||0, missions:v.missionDone||0
    }));
    return {
      level:p.level, xp:p.xp, totalRuns:p.meta.totalRuns, bestScore:p.meta.bestScore, bestCombo:p.meta.bestCombo,
      rows
    };
  }
};
