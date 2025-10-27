// === Hero Health Academy — game/core/progression.js (enhanced: autosave + totals + daily) ===

// ---------- Storage utils ----------
const STORE_KEY = 'hha_profile_v1';

function _load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}
function _save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const nowMs = ()=>performance?.now?.()||Date.now();

// ---------- Leveling ----------
const XP_TABLE = Array.from({length:50}, (_,i)=> 100 + i*40); // xp per level
function xpToNext(profile){
  const idx = clamp((profile.level|0)-1, 0, XP_TABLE.length-1);
  return XP_TABLE[idx] || XP_TABLE.at(-1);
}

// ---------- Badges ----------
const BADGES = [
  { id:'first_blood',   nameTH:'ก้าวแรก',     nameEN:'First Steps',     cond:(p)=>p.meta.totalRuns>=1 },
  { id:'hundred_score', nameTH:'ร้อยแต้ม!',   nameEN:'Hundred!',        cond:(p)=>p.meta.bestScore>=100 },
  { id:'combo_20',      nameTH:'คอมโบ x20',   nameEN:'Combo x20',       cond:(p)=>p.meta.bestCombo>=20 },
  { id:'gold_hunter',   nameTH:'นักล่าทอง',   nameEN:'Golden Hunter',   cond:(p)=>p.meta.goldenHits>=5 },
  { id:'fever_master',  nameTH:'FEVER จ้าว',  nameEN:'Fever Master',    cond:(p)=>p.meta.feverActivations>=5 },
  { id:'marathon_10',   nameTH:'มาราธอน',     nameEN:'Marathon',        cond:(p)=>p.meta.totalRuns>=10 },
];

// ---------- Mission pools (5 each; plate = easy-mode) ----------
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
  // plate easy-mode quests (5 → pick 3 per run)
  plate: [
    { id:'pl_target8',  th:'วางถูกหมวดรวม 8 ชิ้น',     en:'Collect 8 target items',   need:8,  type:'count_target' },
    { id:'pl_veg2',     th:'ใส่ผัก 2 ส่วน',             en:'Add 2 veggie portions',    need:2,  type:'count_group', group:'veggies' },
    { id:'pl_combo6',   th:'ทำคอมโบถึง x6',            en:'Reach combo x6',           need:6,  type:'reach_combo' },
    { id:'pl_perfect2', th:'Perfect 2 ครั้ง',            en:'2 Perfects',               need:2,  type:'count_perfect' },
    { id:'pl_golden1',  th:'เก็บ Golden 1 ชิ้น',         en:'Hit 1 Golden',             need:1,  type:'count_golden' },
  ],
};

function rollMissions(mode, lang='TH'){
  const pool = (MISSION_POOLS[mode]||[]).slice();
  if (!pool.length) return [];
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0,3).map(m=>({
    ...m,
    label: (lang==='EN'?m.en:m.th),
    prog:0, done:false
  }));
}

// ============================================================================
// Progress singleton
// ============================================================================
export const Progress = {
  // state
  profile: null,
  listeners: new Set(),
  runCtx: null,                 // { mode, difficulty, lang, startAt, missions, counters }
  _dirty: false,
  _autoTimer: 0,
  _autoLast: 0,

  // lifecycle
  init(){
    const def = {
      name: 'Player',
      level: 1,
      xp: 0,
      badges: {},                     // { badgeId: true }
      stats: {
        totalPlayTime: 0,             // accumulated seconds (from game reports)
        sessionStartAt: Date.now(),   // for info only
        lastPlayedAt: 0,
      },
      meta: {
        totalRuns: 0,
        bestScore: 0,
        bestCombo: 0,
        goldenHits: 0,
        feverActivations: 0,
      },
      modes: {},                      // per-mode snapshot
      daily: null,                    // { date:'YYYY-MM-DD', missions:[{id,kind,val,label}], done:[id] }
      session: { modesPlayed: [] },
      lang: 'TH',
    };
    const loaded = _load();
    this.profile = loaded ? { ...def, ...loaded, stats:{...def.stats, ...(loaded.stats||{})} } : def;

    // daily sync on first init
    this._ensureDaily();

    // autosave heartbeat
    this._startAutosave();

    // save immediately to ensure new fields persist
    this._markDirty(); this._flushSave();
    return this.profile;
  },

  // pub-sub
  on(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); },
  emit(type, payload){ for (const fn of this.listeners){ try{ fn(type, payload); }catch{} } },

  // runs
  beginRun(mode, difficulty, lang='TH'){
    // register session mode
    const p = this.profile;
    if (!Array.isArray(p.session?.modesPlayed)) p.session = { modesPlayed: [] };
    if (!p.session.modesPlayed.includes(mode)) p.session.modesPlayed.push(mode);
    this._markDirty();

    const missions = rollMissions(mode, lang);
    this.runCtx = {
      mode, difficulty, lang,
      startAt: nowMs(),
      missions,
      counters:{
        hits:0, good:0, perfect:0, bad:0,
        target:0, golden:0, comboMax:0, fever:0,
        groupCount:{}
      }
    };
    this.emit('run_start', {mode, difficulty, missions});
    return missions;
  },

  endRun({score=0, bestCombo=0, timePlayed=0, acc=0}={}){
    if (!this.runCtx) return;
    const p = this.profile;
    const mode = this.runCtx.mode;

    // xp gain: score + quests + best combo
    const questClears = this.runCtx.missions.filter(m=>m.done).length;
    const gain = Math.round(score*0.5 + questClears*40 + bestCombo*2);
    this.addXP(gain);

    // meta & totals
    p.meta.totalRuns += 1;
    p.meta.bestScore = Math.max(p.meta.bestScore, score|0);
    p.meta.bestCombo = Math.max(p.meta.bestCombo, bestCombo|0);
    p.stats.totalPlayTime += Math.max(0, timePlayed|0);
    p.stats.lastPlayedAt = Date.now();

    // per-mode snapshot
    const ms = p.modes[mode] || { bestScore:0, bestCombo:0, games:0, accAvg:0, missionDone:0 };
    ms.bestScore = Math.max(ms.bestScore|0, score|0);
    ms.bestCombo = Math.max(ms.bestCombo|0, bestCombo|0);
    ms.missionDone = (ms.missionDone||0) + questClears;
    const games = (ms.games||0);
    const accNum = +acc || 0;
    ms.accAvg = games>0 ? ((games*ms.accAvg + accNum)/(games+1)) : accNum;
    ms.games = games + 1;
    p.modes[mode] = ms;

    // badges
    this._checkBadges();

    // daily check
    const result = { score, acc: accNum, mode, sessionModes:(p.session?.modesPlayed||[]).slice() };
    this.checkDaily(result);

    this._markDirty(); this._flushSave();
    this.emit('run_end', {score, bestCombo, quests:questClears, xpGain:gain, level:p.level, xp:p.xp, acc:accNum});
    this.runCtx = null;
  },

  // leveling
  addXP(x){
    const p = this.profile; if (!p) return;
    p.xp = (p.xp||0) + (x|0);
    while (p.level < 50){
      const need = xpToNext(p);
      if (p.xp < need) break;
      p.xp -= need;
      p.level++;
      this.emit('level_up', {level:p.level});
    }
    this._markDirty();
  },

  // game events (called by main.js)
  event(type, data={}){
    if (!this.runCtx) return;
    const C = this.runCtx.counters;

    if (type==='hit'){
      const { result, meta, comboNow } = data;
      C.hits++;
      if (comboNow) C.comboMax = Math.max(C.comboMax, comboNow|0);

      if (result==='good'){ C.good++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='perfect'){ C.perfect++; if (meta?.good) C.target++; if (meta?.groupId){ C.groupCount[meta.groupId]=(C.groupCount[meta.groupId]||0)+1; } }
      if (result==='bad'){ C.bad++; }

      if (meta?.golden){ C.golden++; this.profile.meta.goldenHits++; }

      // mission progress
      for (const m of this.runCtx.missions){
        if (m.done) continue;
        switch(m.type){
          case 'count_target':   m.prog = C.target; break;
          case 'count_perfect':  m.prog = C.perfect; break;
          case 'count_golden':   m.prog = C.golden; break;
          case 'streak_nomiss':  if (result!=='bad') m.prog = Math.max(m.prog|0, comboNow|0); break;
          case 'count_group':    m.prog = C.groupCount[m.group]||0; break;
          case 'reach_combo':    m.prog = Math.max(m.prog|0, comboNow|0); break;
          default: break;
        }
        if (m.prog >= m.need){ m.done = true; this.addXP(60); this.emit('mission_done', {mission:m}); }
      }
    }

    if (type==='fever'){
      if (data.kind==='start'){ C.fever++; this.profile.meta.feverActivations++; }
    }

    this._markDirty();
  },

  // badges
  _checkBadges(){
    const p = this.profile;
    for (const b of BADGES){
      if (p.badges[b.id]) continue;
      if (b.cond(p)){ p.badges[b.id]=true; this.emit('badge_unlock', {id:b.id, name:(p.lang==='EN'?b.nameEN:b.nameTH)}); }
    }
    this._markDirty();
  },

  // ---------- Daily Challenge ----------
  _ensureDaily(){
    const today = new Date().toISOString().slice(0,10);
    const p = this.profile;
    if (p.daily?.date === today) return;
    // build a fresh set (2 of 3)
    const pool = [
      { id:'score300',  kind:'score',  val:300, label:'ได้คะแนน ≥ 300' },
      { id:'accuracy80',kind:'acc',    val:80,  label:'ความแม่น ≥ 80%' },
      { id:'twoModes',  kind:'modes',  val:2,   label:'เล่นครบอย่างน้อย 2 โหมด' },
    ];
    const picks = pool.sort(()=>Math.random()-0.5).slice(0,2);
    p.daily = { date: today, missions: picks, done: [] };
    this._markDirty();
  },

  genDaily(){
    this._ensureDaily();
    return this.profile.daily;
  },

  checkDaily(result){
    const p = this.profile; if (!p.daily) return;
    const d = p.daily;
    for (const m of d.missions){
      if (d.done.includes(m.id)) continue;
      let ok = false;
      if (m.kind==='score')  ok = (result.score|0) >= (m.val|0);
      else if (m.kind==='acc') ok = (+result.acc) >= (+m.val);
      else if (m.kind==='modes') ok = ((result.sessionModes||[]).length|0) >= (m.val|0);
      if (ok) d.done.push(m.id);
    }
    if (d.done.length === d.missions.length){
      this.giveReward('daily');
    }
    this._markDirty();
  },

  giveReward(kind){
    const p = this.profile;
    p.xp = (p.xp||0) + (kind==='daily' ? 80 : 30);
    while (p.level < 50){
      const need = xpToNext(p);
      if (p.xp < need) break;
      p.xp -= need;
      p.level++;
      this.emit('level_up', {level:p.level});
    }
    this._markDirty();
  },

  // ---------- Snapshots for UI ----------
  getStatSnapshot(){
    const p = this.profile || {};
    const rows = Object.entries(p.modes||{}).map(([key,v])=>({
      key,
      bestScore: v.bestScore||0,
      acc: +((v.accAvg||0).toFixed(1)),
      runs: v.games||0,
      missions: v.missionDone||0
    }));
    return {
      level: p.level||1,
      xp: p.xp||0,
      totalRuns: p.meta?.totalRuns||0,
      bestCombo: p.meta?.bestCombo||0,
      totalPlayTime: p.stats?.totalPlayTime||0, // seconds
      rows
    };
  },

  // ---------- Autosave ----------
  _markDirty(){ this._dirty = true; },
  _startAutosave(){
    if (this._autoTimer) return;
    this._autoLast = Date.now();
    this._autoTimer = setInterval(()=>this._autosaveTick(), 3500);
    // also save on page hide
    try{
      window.addEventListener('beforeunload', ()=>this._flushSave(), {capture:true});
      document.addEventListener('visibilitychange', ()=>{ if (document.hidden) this._flushSave(); });
    }catch{}
  },
  _autosaveTick(){
    // lightweight debounced save
    if (!this._dirty) return;
    const elapsed = Date.now() - this._autoLast;
    if (elapsed < 1500) return;
    this._flushSave();
  },
  _flushSave(){
    if (!this.profile) return;
    _save(this.profile);
    this._dirty = false;
    this._autoLast = Date.now();
  }
};
