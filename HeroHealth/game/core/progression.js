// === Hero Health Academy — game/core/progression.js (Enhanced: autosave + totalTime + daily sync) ===
const STORE_KEY = 'hha_profile_v1';

// ---------- utils ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function now(){ return performance?.now?.()||Date.now(); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

// ---------- XP / Level ----------
const XP_TABLE = Array.from({length:50}, (_,i)=> 100 + i*40); // xp per level
function xpToNext(profile){
  const idx = clamp(profile.level-1, 0, XP_TABLE.length-1);
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

// ---------- Mission pools by mode ----------
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

function rollMissions(mode, lang='TH'){
  const pool = (MISSION_POOLS[mode]||[]).slice();
  if (pool.length===0) return [];
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0,3).map(m=>({ ...m, label:(lang==='EN'?m.en:m.th), prog:0, done:false }));
}

// ---------- Progress singleton ----------
export const Progress = {
  profile: null,
  listeners: new Set(),
  runCtx: null,     // { mode, difficulty, lang, startAt, missions, counters }
  _autosaveTimer: 0,
  _heartbeatTimer: 0,
  _lastBeatAt: 0,

  // ---- lifecycle ----
  init(){
    const p = load() || {
      name: 'Player',
      level: 1,
      xp: 0,
      badges: {},
      stats: {
        totalPlayTime: 0,          // all-time seconds
        totalPlayTimeToday: 0,     // seconds today
        lastPlayedAt: 0,
        lastDailyDate: todayISO(),
      },
      meta:  { totalRuns: 0, bestScore: 0, bestCombo: 0, goldenHits: 0, feverActivations: 0 },
      modes: {},                   // per-mode stats
      daily: null,                 // {date, missions:[{id,label,kind,val}], done:[]}
      session: { modesPlayed: [] },
      lang: 'TH',
    };
    this.profile = p;

    // Ensure daily exists and matches today
    this.genDaily(); // will create/roll if needed

    // Start autosave + heartbeat
    this._startAutoSave();
    this._startHeartbeat();

    save(p);
    return p;
  },

  on(fn){ this.listeners.add(fn); return ()=>this.listeners.delete(fn); },
  emit(type, payload){ for(const fn of this.listeners){ try{ fn(type, payload); }catch{} } },

  // ---- run control ----
  beginRun(mode, difficulty, lang='TH'){
    const missions = rollMissions(mode, lang);
    const p = this.profile;
    if (!Array.isArray(p.session?.modesPlayed)) p.session = { modesPlayed: [] };
    if (!p.session.modesPlayed.includes(mode)) p.session.modesPlayed.push(mode);
    save(p);

    this.runCtx = {
      mode, difficulty, lang,
      startAt: now(),
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

  endRun({score=0, bestCombo=0, timePlayed=0, acc, accPct}={}){
    if (!this.runCtx) return;
    const p = this.profile;
    const mode = this.runCtx.mode;

    // support both acc and accPct naming
    const accuracy = typeof acc === 'number' ? acc : (typeof accPct === 'number' ? accPct : 0);

    // XP gain
    const questClears = this.runCtx.missions.filter(m=>m.done).length;
    const gain = Math.round(score*0.5 + questClears*40 + bestCombo*2);
    this.addXP(gain);

    // meta (global)
    p.meta.totalRuns += 1;
    p.meta.bestScore = Math.max(p.meta.bestScore, score);
    p.meta.bestCombo = Math.max(p.meta.bestCombo, bestCombo);
    p.stats.totalPlayTime += Math.max(0, timePlayed|0);
    p.stats.totalPlayTimeToday += Math.max(0, timePlayed|0);
    p.stats.lastPlayedAt = Date.now();

    // per-mode stats
    const ms = p.modes[mode] || { bestScore:0, bestCombo:0, games:0, accAvg:0, missionDone:0 };
    ms.bestScore = Math.max(ms.bestScore, score);
    ms.bestCombo = Math.max(ms.bestCombo, bestCombo);
    ms.missionDone += questClears;
    const games = (ms.games||0);
    ms.accAvg = (games * (ms.accAvg||0) + (accuracy||0)) / (games + 1);
    ms.games = games + 1;
    p.modes[mode] = ms;

    // badges
    this._checkBadges();

    // daily check
    const result = { score, acc: accuracy||0, mode, sessionModes:(p.session?.modesPlayed||[]).slice() };
    this.checkDaily(result);

    save(p);
    this.emit('run_end', {score, bestCombo, quests:questClears, xpGain:gain, level:p.level, xp:p.xp, acc:accuracy||0});
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

  // ---- in-run events ----
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
          case 'count_target':   m.prog = C.target; break;
          case 'count_perfect':  m.prog = C.perfect; break;
          case 'count_golden':   m.prog = C.golden; break;
          case 'streak_nomiss':  if (data.result!=='bad') m.prog = Math.max(m.prog, data.comboNow||0); break;
          case 'count_group':    m.prog = C.groupCount[m.group]||0; break;
          case 'reach_combo':    m.prog = Math.max(m.prog, data.comboNow||0); break;
          // hydration/plate specific types could be handled here if needed
          default: break;
        }
        if (m.prog >= m.need){
          m.done=true;
          this.addXP(60);
          this.emit('mission_done', {mission:m});
        }
      }
    }

    if (type==='fever'){
      if (data.kind==='start'){ C.fever++; this.profile.meta.feverActivations++; }
    }

    save(this.profile);
  },

  // ---- badges ----
  _checkBadges(){
    const p = this.profile;
    for (const b of BADGES){
      if (p.badges[b.id]) continue;
      if (b.cond(p)){ p.badges[b.id]=true; this.emit('badge_unlock', {id:b.id, name:(p.lang==='EN'?b.nameEN:b.nameTH)}); }
    }
    save(p);
  },

  // ---- daily challenge ----
  genDaily(){
    const p = this.profile;
    const iso = todayISO();
    if (p.daily?.date === iso) return p.daily;

    const pool = [
      { id:'score300',   kind:'score', val:300, label:'ได้คะแนน ≥ 300' },
      { id:'accuracy80', kind:'acc',   val:80,  label:'ความแม่น ≥ 80%' },
      { id:'twoModes',   kind:'modes', val:2,   label:'เล่นครบอย่างน้อย 2 โหมด' },
    ];
    const picks = pool.sort(()=>Math.random()-0.5).slice(0,2);
    p.daily = { date: iso, missions: picks, done: [] };
    p.session = { modesPlayed: [] };      // reset session set per day
    p.stats.totalPlayTimeToday = 0;       // reset daily timer
    p.stats.lastDailyDate = iso;
    save(p);
    return p.daily;
  },

  checkDaily(result){
    const p = this.profile; if (!p.daily) return;
    const d = p.daily;

    for(const m of d.missions){
      if(d.done.includes(m.id)) continue;
      let ok = false;
      if (m.kind==='score')   ok = (result.score >= m.val);
      else if (m.kind==='acc')   ok = (result.acc >= m.val);
      else if (m.kind==='modes') ok = ((result.sessionModes||[]).length >= m.val);
      if (ok) d.done.push(m.id);
    }
    if (d.done.length===d.missions.length) this.giveReward('daily');
    save(p);
  },

  giveReward(kind){
    const p = this.profile;
    p.xp += (kind==='daily'? 80 : 30);
    while (p.level < 50){
      const need = xpToNext(p);
      if (p.xp < need) break;
      p.xp -= need;
      p.level++;
      this.emit('level_up', {level:p.level});
    }
    save(p);
  },

  // ---- snapshots for UI ----
  getStatSnapshot(){
    const p = this.profile || {};
    const rows = Object.entries(p.modes||{}).map(([key, ms])=>({
      key,
      bestScore: ms.bestScore||0,
      acc: ((ms.accAvg||0)).toFixed(1),
      runs: ms.games||0,
      missions: ms.missionDone||0
    }));
    return {
      level: p.level||1,
      xp: p.xp||0,
      totalRuns: p.meta?.totalRuns||0,
      bestCombo: p.meta?.bestCombo||0,
      today: p.stats?.totalPlayTimeToday||0,
      rows
    };
  },

  // ---- autosave & heartbeat (totalTime + day roll) ----
  _startAutoSave(){
    if (this._autosaveTimer) clearInterval(this._autosaveTimer);
    this._autosaveTimer = setInterval(()=>{ if (this.profile) save(this.profile); }, 10000); // every 10s
    // ensure save on unload
    window.addEventListener('beforeunload', ()=>{ try{ save(this.profile); }catch{} }, {once:true});
  },

  _startHeartbeat(){
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._lastBeatAt = now();
    this._heartbeatTimer = setInterval(()=>{
      const p = this.profile; if (!p) return;

      // day change sync
      const iso = todayISO();
      if (p.stats.lastDailyDate !== iso){
        this.genDaily(); // resets session/day counters & rolls new daily
      }

      // accumulate foreground "presence" time (approx)
      const visible = (typeof document!=='undefined') ? (document.visibilityState!=='hidden') : true;
      const t = now();
      const dt = Math.max(0, (t - (this._lastBeatAt||t)) / 1000); // seconds
      this._lastBeatAt = t;

      if (visible){
        p.stats.totalPlayTime += dt;
        p.stats.totalPlayTimeToday += dt;
        save(p);
      }
    }, 5000); // every 5s
    document.addEventListener('visibilitychange', ()=>{ this._lastBeatAt = now(); });
  },
};
