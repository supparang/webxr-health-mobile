// === Hero Health Academy — game/core/progression.js (Mini-Quests per mode, 5 each; roll 3/run) ===
const STORE_KEY = 'hha_profile_v1';

function _load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; } }
function _save(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch {} }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function now(){ return performance?.now?.()||Date.now(); }

// ---- Level table (Lv1–50)
const XP_TABLE = Array.from({length:50}, (_,i)=> 100 + i*40);
function xpToNext(profile){
  const idx = clamp(profile.level-1, 0, XP_TABLE.length-1);
  return XP_TABLE[idx] || XP_TABLE.at(-1);
}

// ---- Badges (ตัวอย่าง)
const BADGES = [
  { id:'first_blood',   nameTH:'ก้าวแรก',     nameEN:'First Steps',     cond:(p)=>p.meta.totalRuns>=1 },
  { id:'hundred_score', nameTH:'ร้อยแต้ม!',   nameEN:'Hundred!',        cond:(p)=>p.meta.bestScore>=100 },
  { id:'combo_20',      nameTH:'คอมโบ x20',   nameEN:'Combo x20',       cond:(p)=>p.meta.bestCombo>=20 },
  { id:'gold_hunter',   nameTH:'นักล่าทอง',   nameEN:'Golden Hunter',   cond:(p)=>p.meta.goldenHits>=5 },
  { id:'fever_master',  nameTH:'FEVER จ้าว',  nameEN:'Fever Master',    cond:(p)=>p.meta.feverActivations>=5 },
  { id:'marathon_10',   nameTH:'มาราธอน',     nameEN:'Marathon',        cond:(p)=>p.meta.totalRuns>=10 },
];

// -----------------------------------------------------------------------------
// Mini-Quest pools — 5 ต่อโหมด (จะสุ่มมา 3 ต่อรัน)
// ประเภทเงื่อนไขที่รองรับ:
// - count_good / count_perfect / count_golden / count_target
// - reach_combo / streak_nomiss
// - survive_time (วินาที)   -> อัปเดตจาก event 'sec'
// - acc_atleast (เปอร์เซ็นต์)-> ประเมินความแม่นยำระหว่างรัน
// - count_fever              -> เมื่อ FEVER start
// -----------------------------------------------------------------------------
const MISSION_POOLS = {
  goodjunk: [
    { id:'gj_good25',    th:'เก็บอาหารดี 25 ชิ้น',     en:'Collect 25 good',         need:25, type:'count_good' },
    { id:'gj_perfect5',  th:'Perfect 5 ครั้ง',           en:'5 Perfects',              need:5,  type:'count_perfect' },
    { id:'gj_combo15',   th:'ทำคอมโบถึง x15',           en:'Reach combo x15',         need:15, type:'reach_combo' },
    { id:'gj_nomiss10',  th:'ไม่พลาด 10 ครั้งติด',       en:'No miss 10 in a row',     need:10, type:'streak_nomiss' },
    { id:'gj_acc80',     th:'ความแม่นยำ ≥ 80%',         en:'Accuracy ≥ 80%',          need:80, type:'acc_atleast' },
  ],
  groups: [
    { id:'grp_target20', th:'สะสมเป้าหมายรวม 20 ชิ้น', en:'Collect 20 target items', need:20, type:'count_target' },
    { id:'grp_perfect6', th:'Perfect 6 ครั้ง',           en:'6 Perfects',              need:6,  type:'count_perfect' },
    { id:'grp_combo15',  th:'ทำคอมโบถึง x15',           en:'Reach combo x15',         need:15, type:'reach_combo' },
    { id:'grp_golden2',  th:'เก็บทอง 2 ชิ้น',           en:'Get 2 Goldens',           need:2,  type:'count_golden' },
    { id:'grp_time60',   th:'อยู่รอด 60 วินาที',        en:'Survive 60s',             need:60, type:'survive_time' },
  ],
  hydration: [
    { id:'hy_perfect4',  th:'Perfect 4 ครั้ง',           en:'4 Perfects',              need:4,  type:'count_perfect' },
    { id:'hy_combo12',   th:'คอมโบถึง x12',             en:'Reach combo x12',         need:12, type:'reach_combo' },
    { id:'hy_fever1',    th:'เปิด FEVER 1 ครั้ง',        en:'Trigger FEVER once',      need:1,  type:'count_fever' },
    { id:'hy_acc80',     th:'ความแม่นยำ ≥ 80%',         en:'Accuracy ≥ 80%',          need:80, type:'acc_atleast' },
    { id:'hy_time90',    th:'อยู่รอด 90 วินาที',        en:'Survive 90s',             need:90, type:'survive_time' },
  ],
  plate: [
    { id:'pl_perfect3',  th:'Perfect 3 ครั้ง',           en:'3 Perfects',              need:3,  type:'count_perfect' },
    { id:'pl_combo10',   th:'คอมโบถึง x10',             en:'Reach combo x10',         need:10, type:'reach_combo' },
    { id:'pl_golden1',   th:'เก็บทอง 1 ชิ้น',           en:'Get 1 Golden',            need:1,  type:'count_golden' },
    { id:'pl_acc75',     th:'ความแม่นยำ ≥ 75%',         en:'Accuracy ≥ 75%',          need:75, type:'acc_atleast' },
    { id:'pl_time60',    th:'อยู่รอด 60 วินาที',        en:'Survive 60s',             need:60, type:'survive_time' },
  ],
};

function rollMissions(mode, lang='TH'){
  const pool = (MISSION_POOLS[mode]||[]).slice();
  if (!pool.length) return [];
  // shuffle
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  // pick 3
  return pool.slice(0,3).map(m=>({
    ...m,
    label: (lang==='EN'?m.en:m.th),
    prog: 0,
    done: false
  }));
}

// -----------------------------------------------------------------------------
// Progress singleton
// -----------------------------------------------------------------------------
export const Progress = {
  profile: null,
  listeners: new Set(),
  runCtx: null, // { mode, difficulty, lang, startAt, missions, counters:{} }

  init(){
    const p = _load() || {
      name: 'Player',
      level: 1,
      xp: 0,
      badges: {},
      lang: 'TH',
      stats: { totalPlayTime: 0, lastPlayedAt: 0 },
      meta:  { totalRuns: 0, bestScore: 0, bestCombo: 0, goldenHits: 0, feverActivations: 0 },
      modes: {},
      session: { modesPlayed: [] },
      daily: null
    };
    this.profile = p;
    _save(p);
    return p;
  },

  on(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); },
  emit(type, payload){ for(const fn of this.listeners){ try{ fn(type, payload); }catch{} } },

  beginRun(mode, difficulty, lang='TH'){
    const missions = rollMissions(mode, lang);

    const p = this.profile;
    if (!Array.isArray(p.session?.modesPlayed)) p.session = { modesPlayed: [] };
    if (!p.session.modesPlayed.includes(mode)) p.session.modesPlayed.push(mode);
    _save(p);

    this.runCtx = {
      mode, difficulty, lang,
      startAt: now(),
      missions,
      counters:{
        t:0,                 // seconds survived in this run
        hits:0, good:0, perfect:0, bad:0,
        target:0, golden:0, comboMax:0, fever:0,
        groupCount:{}        // e.g. {veggies: 3}
      }
    };
    this.emit('run_start', {mode, difficulty, missions});
    return missions;
  },

  endRun({score=0, bestCombo=0, timePlayed=0, acc=0}={}){
    if (!this.runCtx) return;
    const p = this.profile;
    const mode = this.runCtx.mode;

    // XP gain
    const questClears = this.runCtx.missions.filter(m=>m.done).length;
    const gain = Math.round(score*0.5 + questClears*40 + bestCombo*2);
    this.addXP(gain);

    // meta (global)
    p.meta.totalRuns += 1;
    p.meta.bestScore = Math.max(p.meta.bestScore, score);
    p.meta.bestCombo = Math.max(p.meta.bestCombo, bestCombo);
    p.stats.totalPlayTime += Math.max(0, timePlayed|0);
    p.stats.lastPlayedAt = Date.now();

    // per-mode stats
    const ms = p.modes[mode] || { bestScore:0, bestCombo:0, games:0, accAvg:0, missionDone:0 };
    ms.bestScore = Math.max(ms.bestScore, score);
    ms.bestCombo = Math.max(ms.bestCombo, bestCombo);
    ms.missionDone += questClears;
    const games = (ms.games||0);
    ms.accAvg = (games * (ms.accAvg||0) + acc) / (games + 1);
    ms.games = games + 1;
    p.modes[mode] = ms;

    // badges
    this._checkBadges();

    // daily result hook (optional: ใช้แล้วจะนับภารกิจรายวัน)
    this.checkDaily?.({ score, acc, mode, sessionModes:(p.session?.modesPlayed||[]) });

    _save(p);
    this.emit('run_end', {score, bestCombo, quests:questClears, xpGain:gain, level:p.level, xp:p.xp, acc});
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
    _save(p);
  },

  // ---- Runtime events from game loop ----
  // type === 'hit'|'fever'|'sec'
  event(type, data={}){
    if (!this.runCtx) return;
    const C = this.runCtx.counters;

    if (type==='hit'){
      // data: { result:'good|perfect|ok|bad', meta:{good, groupId, golden}, comboNow:number }
      const { result, meta, comboNow } = data;
      C.hits++;
      if (comboNow) C.comboMax = Math.max(C.comboMax, comboNow);

      if (result==='good'){ C.good++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='perfect'){ C.perfect++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='bad'){ C.bad++; }
      if (meta?.golden){ C.golden++; this.profile.meta.goldenHits++; }

      // accuracy (0–100)
      const accNow = (C.hits>0) ? ((C.good + C.perfect)/C.hits*100) : 0;

      // update quests
      for (const m of this.runCtx.missions){
        if (m.done) continue;
        switch(m.type){
          case 'count_good':     m.prog = C.good; break;
          case 'count_perfect':  m.prog = C.perfect; break;
          case 'count_golden':   m.prog = C.golden; break;
          case 'count_target':   m.prog = C.target; break;
          case 'reach_combo':    m.prog = Math.max(m.prog, comboNow||0); break;
          case 'streak_nomiss':  if (result!=='bad') m.prog = Math.max(m.prog, comboNow||0); break;
          case 'acc_atleast':    m.prog = Math.floor(accNow); break;
          default: break;
        }
        if (m.prog >= m.need){ m.done = true; this.addXP(60); this.emit('mission_done', {mission:m}); }
      }
    }

    if (type==='fever' && data?.kind==='start'){
      C.fever++; this.profile.meta.feverActivations++;
      for (const m of this.runCtx.missions){
        if (!m.done && m.type==='count_fever'){
          m.prog = C.fever;
          if (m.prog >= m.need){ m.done = true; this.addXP(60); this.emit('mission_done', {mission:m}); }
        }
      }
    }

    if (type==='sec'){
      // data: { elapsed:number, remain:number }
      C.t = data.elapsed|0;
      for (const m of this.runCtx.missions){
        if (!m.done && m.type==='survive_time'){
          m.prog = C.t;
          if (m.prog >= m.need){ m.done = true; this.addXP(60); this.emit('mission_done', {mission:m}); }
        }
      }
    }

    _save(this.profile);
  },

  // ---- Badges
  _checkBadges(){
    const p = this.profile;
    for (const b of BADGES){
      if (p.badges[b.id]) continue;
      if (b.cond(p)){ p.badges[b.id]=true; this.emit('badge_unlock', {id:b.id, name:(p.lang==='EN'?b.nameEN:b.nameTH)}); }
    }
    _save(p);
  },

  // ---- Stats board snapshot (optional UI helper)
  getStatSnapshot(){
    const p = this.profile || {};
    const rows = Object.entries(p.modes||{}).map(([key,v])=>({
      key,
      bestScore: v.bestScore||0,
      acc: Math.round((v.accAvg||0)*10)/10,
      runs: v.games||0,
      missions: v.missionDone||0
    }));
    return {
      level: p.level||1,
      xp: p.xp||0,
      totalRuns: p.meta?.totalRuns||0,
      bestCombo: p.meta?.bestCombo||0,
      rows
    };
  }
};
