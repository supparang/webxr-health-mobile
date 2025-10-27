// === Hero Health Academy — game/core/progression.js ===
const STORE_KEY = 'hha_profile_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function now(){ return performance?.now?.()||Date.now(); }

// ตารางเลเวล (เลเวล 1–50)
const XP_TABLE = Array.from({length:50}, (_,i)=> 100 + i*40); // xp ต่อเลเวล

function xpToNext(profile){
  const idx = clamp(profile.level-1, 0, XP_TABLE.length-1);
  return XP_TABLE[idx] || XP_TABLE.at(-1);
}

// --------- Badge definitions ---------
const BADGES = [
  { id:'first_blood',   nameTH:'ก้าวแรก',     nameEN:'First Steps',     cond:(p)=>p.meta.totalRuns>=1 },
  { id:'hundred_score', nameTH:'ร้อยแต้ม!',   nameEN:'Hundred!',        cond:(p)=>p.meta.bestScore>=100 },
  { id:'combo_20',      nameTH:'คอมโบ x20',   nameEN:'Combo x20',       cond:(p)=>p.meta.bestCombo>=20 },
  { id:'gold_hunter',   nameTH:'นักล่าทอง',   nameEN:'Golden Hunter',   cond:(p)=>p.meta.goldenHits>=5 },
  { id:'fever_master',  nameTH:'FEVER จ้าว',  nameEN:'Fever Master',    cond:(p)=>p.meta.feverActivations>=5 },
  { id:'marathon_10',   nameTH:'มาราธอน',     nameEN:'Marathon',        cond:(p)=>p.meta.totalRuns>=10 },
];

// --------- Mission pools by mode ---------
// ต่อเกมจะสุ่มมา "3 เควส" จาก pool ของโหมดนั้น ๆ
const MISSION_POOLS = {
  groups: [
    { id:'grp_any_20',   th:'สะสมเป้าหมายรวม 20 ชิ้น', en:'Collect 20 target items', need:20,  type:'count_target' },
    { id:'grp_perfect6', th:'ทำ Perfect 6 ครั้ง',        en:'Hit 6 Perfects',          need:6,   type:'count_perfect' },
    { id:'grp_golden2',  th:'เก็บทอง 2 ชิ้น',           en:'Hit 2 Golden',            need:2,   type:'count_golden' },
    { id:'grp_chain10',  th:'ไม่พลาด 10 ครั้งติด',       en:'No miss 10 in a row',     need:10,  type:'streak_nomiss' },
    { id:'grp_veggies5', th:'เก็บผัก 5 ชิ้น',            en:'Collect 5 veggies',       need:5,   type:'count_group', group:'veggies' },
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

// สุ่มภารกิจ 3 ตัวจากโหมดนั้น
function rollMissions(mode, lang='TH'){
  const pool = (MISSION_POOLS[mode]||[]).slice();
  if (pool.length===0) return [];
  // shuffle แบบง่าย
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0,3).map(m=>({
    ...m,
    label: (lang==='EN'?m.en:m.th),
    prog:0, done:false
  }));
}

// ---------- Progress singleton ----------
export const Progress = {
  profile: null,
  listeners: new Set(),
  runCtx: null,  // { mode, difficulty, lang, startAt, missions:[], counters:{...} }
  sessionModes: new Set(), // ใช้ประกอบ Daily "เล่นครบ 2 โหมด"

  init(){
    const p = load() || {
      name: 'Player',
      level: 1,
      xp: 0,
      badges: {},           // {badgeId:true}
      stats: {
        totalPlayTime: 0,
        lastPlayedAt: 0,
      },
      meta: {
        totalRuns: 0,
        bestScore: 0,
        bestCombo: 0,
        goldenHits: 0,
        feverActivations: 0,
      },
      modes: {              // เก็บสถิติรายโหมด (สำหรับบอร์ดสถิติ)
        goodjunk: { bestScore:0, acc:0, missionDone:0, plays:0 },
        groups:   { bestScore:0, acc:0, missionDone:0, plays:0 },
        hydration:{ bestScore:0, acc:0, missionDone:0, plays:0 },
        plate:    { bestScore:0, acc:0, missionDone:0, plays:0 },
      },
      daily: null,          // จะถูก genDaily() เติม
      dailySessionDate: null
    };
    // reset sessionModes เมื่อเปลี่ยนวัน
    const today = new Date().toISOString().slice(0,10);
    if (p.dailySessionDate !== today){ this.sessionModes = new Set(); p.dailySessionDate = today; }
    this.profile = p;
    // ensure daily generated
    this.genDaily();
    return this.profile;
  },

  on(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); },
  emit(type, payload){ for(const fn of this.listeners){ try{ fn(type, payload); }catch{} } },

  // ---------- Run lifecycle ----------
  beginRun(mode, difficulty, lang='TH'){
    const missions = rollMissions(mode, lang);
    this.runCtx = {
      mode, difficulty, lang,
      startAt: now(),
      missions,
      counters:{
        hits:0, good:0, perfect:0, bad:0,
        target:0, golden:0, comboMax:0, fever:0,
        groupCount:{}, // e.g. {veggies: 3}
        hy_balanceTicks:0,   // สำหรับ hydration
        surviveSec:0
      }
    };
    this.sessionModes.add(mode);
    this.emit('run_start', {mode, difficulty, missions});
    return missions;
  },

  endRun({score=0, bestCombo=0, timePlayed=0}={}){
    if (!this.runCtx) return;
    const p = this.profile;
    const C = this.runCtx.counters;

    // ความแม่นยำ (ใช้ hits)
    const total = Math.max(1, C.hits);
    const accPct = ((C.good + C.perfect) / total) * 100;

    // XP: ตามสกอร์ + โบนัสเล็กน้อยจากมิชชั่นที่สำเร็จ
    const questClears = this.runCtx.missions.filter(m=>m.done).length;
    const gain = Math.round(score*0.5 + questClears*40 + bestCombo*2);
    this.addXP(gain);

    // meta/prof
    p.meta.totalRuns += 1;
    p.meta.bestScore = Math.max(p.meta.bestScore, score);
    p.meta.bestCombo = Math.max(p.meta.bestCombo, bestCombo);
    p.stats.totalPlayTime += Math.max(0, timePlayed|0);
    p.stats.lastPlayedAt = Date.now();

    // โหมดปัจจุบัน
    const mkey = this.runCtx.mode;
    const mstat = p.modes[mkey] || (p.modes[mkey]={ bestScore:0, acc:0, missionDone:0, plays:0 });
    mstat.bestScore = Math.max(mstat.bestScore, score);
    // ถัวเฉลี่ยความแม่นแบบ EMA เบา ๆ
    mstat.acc = mstat.plays ? (mstat.acc*0.7 + accPct*0.3) : accPct;
    mstat.missionDone += questClears;
    mstat.plays += 1;

    // badges
    this._checkBadges();

    // Daily check
    this.checkDaily({
      score,
      acc: accPct,
      modesPlayedCount: this.sessionModes.size
    });

    save(p);
    this.emit('run_end', {
      score, bestCombo, quests:questClears, xpGain:gain,
      level:p.level, xp:p.xp, acc:accPct
    });
    this.runCtx = null;
  },

  addXP(x){
    const p = this.profile; if (!p) return;
    p.xp += x;
    // Level-up loop
    while (p.level < 50){
      const need = xpToNext(p);
      if (p.xp < need) break;
      p.xp -= need;
      p.level++;
      this.emit('level_up', {level:p.level});
    }
    save(p);
  },

  // ---------- Events from game ----------
  event(type, data={}){
    if (!this.runCtx) return;
    const C = this.runCtx.counters;

    if (type==='hit'){
      // data: {result:'good|perfect|bad', meta:{good, groupId, golden}, comboNow:number}
      const { result, meta, comboNow } = data;
      C.hits++;
      if (comboNow) C.comboMax = Math.max(C.comboMax, comboNow);

      if (result==='good'){ C.good++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='perfect'){ C.perfect++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='bad'){ C.bad++; }

      if (meta?.golden){ C.golden++; this.profile.meta.goldenHits++; }

      // mission progress update
      for (const m of this.runCtx.missions){
        if (m.done) continue;
        switch(m.type){
          case 'count_target':
            m.prog = C.target; break;
          case 'count_perfect':
            m.prog = C.perfect; break;
          case 'count_golden':
            m.prog = C.golden; break;
          case 'streak_nomiss':
            if (result!=='bad') m.prog = Math.max(m.prog, comboNow||0);
            else m.prog = Math.min(m.prog, comboNow||0);
            break;
          case 'count_group':
            m.prog = C.groupCount[m.group]||0; break;
          case 'reach_combo':
            m.prog = Math.max(m.prog, comboNow||0); break;
          default: break;
        }
        if (m.prog >= m.need){
          m.done=true;
          this.addXP(60);
          this.emit('mission_done', {mission:m});
        }
      }
    }

    if (type==='fever'){ // data:{kind:'start'|'end'}
      if (data.kind==='start'){ C.fever++; this.profile.meta.feverActivations++; }
    }

    // โหมด hydration อาจส่ง tick เฉพาะ
    if (type==='hydration_balance_tick'){ // อยู่ในโซนสมดุล 1 ติ๊ก
      C.hy_balanceTicks = (C.hy_balanceTicks||0)+1;
      for (const m of this.runCtx.missions){
        if (m.done) continue;
        if (m.type==='hy_balance'){
          m.prog = C.hy_balanceTicks;
          if (m.prog >= m.need){ m.done=true; this.addXP(60); this.emit('mission_done', {mission:m}); }
        }
      }
    }
    if (type==='survive_tick'){ // นับเป็นวินาที (หรือช่วงเวลาปลอดภัย)
      C.surviveSec = (C.surviveSec||0)+1;
      for (const m of this.runCtx.missions){
        if (m.done) continue;
        if (m.type==='survive_time'){
          m.prog = C.surviveSec;
          if (m.prog >= m.need){ m.done=true; this.addXP(60); this.emit('mission_done', {mission:m}); }
        }
      }
    }

    save(this.profile);
  },

  // ---------- Badges ----------
  _checkBadges(){
    const p = this.profile;
    for (const b of BADGES){
      if (p.badges[b.id]) continue;
      if (b.cond(p)){
        p.badges[b.id]=true;
        this.emit('badge_unlock', {id:b.id, name:(p.lang==='EN'?b.nameEN:b.nameTH)});
      }
    }
    save(p);
  },

  // ---------- Daily Challenge ----------
  genDaily(){
    const today = new Date().toISOString().slice(0,10);
    const p = this.profile || (this.profile = load() || {});
    if (p.daily?.date === today) return p.daily;

    const pool = [
      { id:'score300',  labelTH:'ได้คะแนน ≥300',    labelEN:'Score ≥300',      check:(r)=>r.score>=300 },
      { id:'accuracy80',labelTH:'ความแม่น ≥80%',     labelEN:'Accuracy ≥80%',   check:(r)=>r.acc>=80 },
      { id:'two_modes', labelTH:'เล่นครบ 2 โหมด',    labelEN:'Play 2 modes',    check:(r)=>r.modesPlayedCount>=2 },
      { id:'combo15',   labelTH:'คอมโบถึง x15',      labelEN:'Reach combo x15', check:(r)=>r.maxCombo>=15 },
      { id:'quest2',    labelTH:'สำเร็จเควส 2 อย่าง', labelEN:'Clear 2 quests',  check:(r)=>r.questsCleared>=2 },
    ];
    // เลือก 2 ภารกิจ/วันแบบสุ่ม
    for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const picks = pool.slice(0,2).map(x=>({ id:x.id, labelTH:x.labelTH, labelEN:x.labelEN }));

    p.daily = { date:today, missions:picks, done:[] };
    p.dailySessionDate = today;
    save(p);
    this.emit('daily_new', p.daily);
    return p.daily;
  },

  checkDaily(result){
    // result: { score, acc, modesPlayedCount, maxCombo?, questsCleared? }
    const p = this.profile; if(!p) return;
    if (!p.daily) return;

    // Map checkers (ให้ตรงกับ genDaily)
    const checkMap = {
      score300:  (r)=>r.score>=300,
      accuracy80:(r)=>r.acc>=80,
      two_modes: (r)=>r.modesPlayedCount>=2,
      combo15:   (r)=> (r.maxCombo||0) >= 15,
      quest2:    (r)=> (r.questsCleared||0) >= 2,
    };

    let changed = false;
    for(const m of p.daily.missions){
      if(p.daily.done.includes(m.id)) continue;
      const ok = (checkMap[m.id]||(()=>false))(result);
      if(ok){ p.daily.done.push(m.id); changed = true; }
    }

    // ให้รางวัลเมื่อครบทั้งหมด
    if (p.daily.done.length===p.daily.missions.length){
      this.giveDailyReward();
    }

    if (changed){ save(p); this.emit('daily_update', p.daily); }
  },

  giveDailyReward(){
    const p = this.profile; if(!p) return;
    // XP พิเศษเล็กน้อย
    this.addXP(80);
    this.emit('daily_reward', { xp:80 });
  },

  // ---------- Utilities for UI ----------
  getStatSnapshot(){
    const p = this.profile || {};
    return {
      level: p.level||1, xp:p.xp||0, xpToNext: xpToNext(p||{level:1}),
      meta: p.meta||{},
      modes: p.modes||{},
      badges: p.badges||{},
      daily: p.daily||null
    };
  }
};
