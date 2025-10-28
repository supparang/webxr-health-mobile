// === Hero Health Academy — core/progression.js ===
// โปรไฟล์/เลเวล/สถิติ + Daily Missions + Export/Import + Event bus
// เก็บใน localStorage คีย์: hha_profile_v2

const KEY = 'hha_profile_v2';
const BUS = new Set();

function nowISO(){ return new Date().toISOString(); }
function todayStr(){ return new Date().toISOString().slice(0,10); }

function load(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || null; }catch{ return null; }
}
function save(profile){
  try{ localStorage.setItem(KEY, JSON.stringify(profile)); }catch{}
}

function newProfile(){
  return {
    createdAt: nowISO(),
    level: 1, xp: 0,
    meta: { totalRuns: 0, bestCombo: 0 },
    modes: {
      goodjunk:  { bestScore:0, accAvg:0, games:0, missionDone:0 },
      groups:    { bestScore:0, accAvg:0, games:0, missionDone:0 },
      hydration: { bestScore:0, accAvg:0, games:0, missionDone:0 },
      plate:     { bestScore:0, accAvg:0, games:0, missionDone:0 },
    },
    // daily missions cache
    daily: { date:'', missions:[], done:[] },
    // last run info (optional)
    last: null
  };
}

// ---- Missions (Progression layer) ----
// 10 แบบ/โหมด (เบา ๆ): ใช้ค่าพื้นฐานจาก main/quests events ที่ส่งมา
const POOL = {
  goodjunk: [
    { id:'gj_good15',  label:'เก็บของดี 15 ชิ้น',           need:15, key:'good' },
    { id:'gj_perfect8',label:'เพอร์เฟกต์ 8 ครั้ง',           need:8,  key:'perfect' },
    { id:'gj_avoid5',  label:'ไม่พลาดเกิน 5 ครั้ง',          need:5,  type:'maxBad' },
    { id:'gj_combo20', label:'คอมโบถึง x20',                need:20, type:'combo' },
    { id:'gj_score300',label:'คะแนนถึง 300',                 need:300,type:'score' },
    { id:'gj_junk0',   label:'ไม่มีพลาดเลย (0)',             need:0,  type:'badIs' },
    { id:'gj_streak10',label:'เพอร์เฟกต์ติด 10',             need:10, type:'perfectStreak' },
    { id:'gj_fever2',  label:'เปิด FEVER อย่างน้อย 2 ครั้ง', need:2,  type:'feverCount' },
    { id:'gj_time45',  label:'เล่นครบ 45 วิ',                 need:45, type:'timePlayed' },
    { id:'gj_acc80',   label:'ความแม่น ≥ 80%',               need:80, type:'acc' },
  ],
  groups: [
    { id:'gr_complete3', label:'เป้าหมายหมุนครบ 3 รอบ',   need:3,  type:'targetCycles' },
    { id:'gr_good18',    label:'เลือกตรงหมวด 18 ชิ้น',    need:18, key:'good' },
    { id:'gr_perfect6',  label:'เพอร์เฟกต์ 6 ครั้ง',      need:6,  key:'perfect' },
    { id:'gr_avoid5',    label:'ไม่พลาดเกิน 5 ครั้ง',     need:5,  type:'maxBad' },
    { id:'gr_score320',  label:'คะแนนถึง 320',              need:320,type:'score' },
    { id:'gr_combo15',   label:'คอมโบถึง x15',             need:15, type:'combo' },
    { id:'gr_gold3',     label:'เก็บ Golden 3 ชิ้น',        need:3,  type:'gold' },
    { id:'gr_acc78',     label:'ความแม่น ≥ 78%',           need:78, type:'acc' },
    { id:'gr_time50',    label:'เล่นครบ 50 วิ',             need:50, type:'timePlayed' },
    { id:'gr_freeze2',   label:'ใช้ Freeze อย่างน้อย 2 ครั้ง', need:2, type:'powerFreezes' },
  ],
  hydration: [
    { id:'hy_ok20s',   label:'อยู่โซนพอดี 20 วินาที',     need:20, type:'okSeconds' },
    { id:'hy_recover2',label:'ฟื้น LOW → OK 2 ครั้ง',      need:2,  type:'recoverLow' },
    { id:'hy_over0',   label:'ไม่เข้าขอบ HIGH เลย',        need:0,  type:'highIs' },
    { id:'hy_click12', label:'คลิกเหมาะสม 12 ครั้ง',       need:12, type:'smartClicks' },
    { id:'hy_score300',label:'คะแนนถึง 300',               need:300,type:'score' },
    { id:'hy_combo12', label:'คอมโบถึง x12',               need:12, type:'combo' },
    { id:'hy_perfect6',label:'เพอร์เฟกต์ 6 ครั้ง',        need:6,  key:'perfect' },
    { id:'hy_acc80',   label:'ความแม่น ≥ 80%',            need:80, type:'acc' },
    { id:'hy_time45',  label:'เล่นครบ 45 วิ',              need:45, type:'timePlayed' },
    { id:'hy_okNoHigh',label:'อยู่ OK อย่างเดียว (HIGH=0)',need:0,  type:'highIs' },
  ],
  plate: [
    { id:'pl_complete1', label:'จัดจานครบอย่างน้อย 1 จาน', need:1,  type:'plateComplete' },
    { id:'pl_noOver',    label:'จานแรกไม่เกินโควตาเลย',     need:0,  type:'overfillIs' },
    { id:'pl_good16',    label:'เลือกถูกหมวด 16 ชิ้น',       need:16, key:'good' },
    { id:'pl_perfect5',  label:'เพอร์เฟกต์ 5 ครั้ง',         need:5,  key:'perfect' },
    { id:'pl_score320',  label:'คะแนนถึง 320',                need:320,type:'score' },
    { id:'pl_combo15',   label:'คอมโบถึง x15',               need:15, type:'combo' },
    { id:'pl_acc80',     label:'ความแม่น ≥ 80%',             need:80, type:'acc' },
    { id:'pl_time50',    label:'เล่นครบ 50 วิ',              need:50, type:'timePlayed' },
    { id:'pl_fruitFirst',label:'ผลไม้ครบก่อนโปรตีน',         need:1,  type:'fruitBeforeProtein' },
    { id:'pl_twoPlates', label:'จัดครบ 2 จาน',                need:2,  type:'plateCompleteCount' },
  ],
};

function pickMissions(modeKey, n=3){
  const pool = (POOL[modeKey]||[]).slice();
  for (let i=pool.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return pool.slice(0,n);
}

// ---- Runtime ctx ----
export const Progress = {
  profile: null,
  runCtx: null,

  init(){
    this.profile = load() || newProfile();
    this._emit('ready');
  },

  on(fn){ BUS.add(fn); return ()=>BUS.delete(fn); },
  _emit(type, payload){ BUS.forEach(f=>{ try{ f(type, payload); }catch{} }); },

  // ---- Run lifecycle ----
  beginRun(modeKey, diff, lang){
    const missions = pickMissions(modeKey, 3);
    this.runCtx = {
      modeKey, diff, lang,
      missions: missions.map(m=>({...m, progress:0, done:false})),
      // hydrate counters used in checkers:
      hit: {good:0, perfect:0, ok:0, bad:0, gold:0},
      combo: 0, bestCombo:0,
      feverCount: 0,
      timePlayed: 0,
      score: 0,
      extra: { okSec:0, recoverLow:0, highCount:0, smartClicks:0, targetCycles:0, powerFreezes:0,
               plateComplete:0, plateCompleteCount:0, overfill:0, fruitBeforeProtein:0, firstPlateFruitDone:false, firstPlateProteinDone:false }
    };
    this._emit('run_start', this.runCtx);
    return missions;
  },

  event(type, payload={}){
    // hit: {result, meta:{golden, groupId, ...}, comboNow, _ctx:{score}}
    if (!this.runCtx) return;
    const R = this.runCtx;

    if (type==='hit'){
      const { result, meta={}, comboNow, _ctx={} } = payload;
      R.hit[result] = (R.hit[result]||0)+1;
      if (meta.golden) R.hit.gold = (R.hit.gold||0)+1;
      R.combo = comboNow|0; R.bestCombo = Math.max(R.bestCombo, R.combo);
      if (typeof _ctx.score==='number') R.score = _ctx.score|0;

      // plate special ordering
      if (R.modeKey==='plate' && meta.groupId){
        if (meta.groupId==='fruits') R.extra.firstPlateFruitDone = true;
        if (meta.groupId==='protein') R.extra.firstPlateProteinDone = true;
      }
    }

    if (type==='fever'){
      if (payload?.kind==='start') R.feverCount++;
    }

    if (type==='tick'){
      R.timePlayed++;
    }

    if (type==='target_cycle'){ // groups แจ้งเมื่อเปลี่ยนหมวด
      R.extra.targetCycles++;
    }

    if (type==='power' && payload?.kind==='freeze'){
      R.extra.powerFreezes++;
    }

    if (type==='hydro'){
      if (payload.kind==='okSec') R.extra.okSec++;
      if (payload.kind==='recoverLow') R.extra.recoverLow++;
      if (payload.kind==='high') R.extra.highCount++;
      if (payload.kind==='smartClick') R.extra.smartClicks++;
    }

    if (type==='plate'){
      if (payload.kind==='complete'){ R.extra.plateComplete++; R.extra.plateCompleteCount++; }
      if (payload.kind==='overfill'){ R.extra.overfill = (R.extra.overfill|0)+1; }
    }

    this._emit('tick');
  },

  endRun({score=0, bestCombo=0, timePlayed=0, acc=0}={}){
    const P = this.profile, R = this.runCtx;
    if (!P || !R) return;

    // update missions
    for (const m of R.missions){
      switch (m.type){
        case 'maxBad':         m.done = (R.hit.bad <= m.need); break;
        case 'badIs':          m.done = (R.hit.bad === m.need); break;
        case 'combo':          m.done = (R.bestCombo >= m.need); break;
        case 'score':          m.done = (R.score >= m.need); break;
        case 'feverCount':     m.done = (R.feverCount >= m.need); break;
        case 'timePlayed':     m.done = (R.timePlayed >= m.need); break;
        case 'acc':            m.done = (acc >= m.need); break;
        case 'gold':           m.done = ((R.hit.gold|0) >= m.need); break;
        case 'okSeconds':
        case 'okSec':          m.done = ((R.extra.okSec|0) >= m.need); break;
        case 'recoverLow':     m.done = ((R.extra.recoverLow|0) >= m.need); break;
        case 'highIs':         m.done = ((R.extra.highCount|0) === m.need); break;
        case 'smartClicks':    m.done = ((R.extra.smartClicks|0) >= m.need); break;
        case 'targetCycles':   m.done = ((R.extra.targetCycles|0) >= m.need); break;
        case 'powerFreezes':   m.done = ((R.extra.powerFreezes|0) >= m.need); break;
        case 'plateComplete':  m.done = ((R.extra.plateComplete|0) >= m.need); break;
        case 'plateCompleteCount': m.done = ((R.extra.plateCompleteCount|0) >= m.need); break;
        case 'overfillIs':     m.done = ((R.extra.overfill|0) === m.need); break;
        case 'fruitBeforeProtein':
          m.done = (R.extra.firstPlateFruitDone && !R.extra.firstPlateProteinDone) ? true : false;
          break;
        default:
          if (m.key){ m.done = ((R.hit[m.key]|0) >= m.need); }
      }
      m.progress = m.done ? m.need : (m.key ? (R.hit[m.key]|0) : 0);
      if (m.done) this._emit('mission_done', m);
    }

    // profile update
    P.meta.totalRuns++;
    P.meta.bestCombo = Math.max(P.meta.bestCombo|0, bestCombo|0);

    const M = P.modes[R.modeKey] || (P.modes[R.modeKey]={});
    M.bestScore = Math.max(M.bestScore|0, score|0);
    // EMA ความแม่น
    const ema = 0.25, old = +M.accAvg||0;
    M.accAvg = old? +(old*(1-ema) + acc*ema).toFixed(2) : +acc.toFixed(2);
    M.games = (M.games|0) + 1;
    M.missionDone = (M.missionDone|0) + (R.missions.filter(x=>x.done).length);

    // XP/Level (ง่าย ๆ): 1 run = 10 xp + bonus สกอร์/แม่น
    let gain = 10 + Math.round(score/50) + Math.round(acc/20);
    P.xp += gain;
    while (P.xp >= (P.level*50)){ P.xp -= (P.level*50); P.level++; this._emit('level_up', {level:P.level}); }

    // last
    P.last = { at: nowISO(), mode:R.modeKey, score, acc, bestCombo, missions:R.missions };

    save(P);
    this._emit('saved');
    this.runCtx = null;
  },

  // ---- UI helpers ----
  getStatSnapshot(){
    const p = this.profile || load() || newProfile();
    const rows = Object.keys(p.modes).map(k=>{
      const v = p.modes[k];
      return { key:k, bestScore:v.bestScore||0, acc:+(v.accAvg||0).toFixed(1), runs:v.games||0, missions:v.missionDone||0 };
    });
    return { level:p.level, xp:p.xp, totalRuns:p.meta.totalRuns|0, bestCombo:p.meta.bestCombo|0, rows };
  },

  // ---- Daily Missions ----
  genDaily(){
    const p = this.profile || load() || newProfile();
    const today = todayStr();
    if (p.daily?.date === today && Array.isArray(p.daily.missions) && p.daily.missions.length){
      return p.daily;
    }
    // สุ่ม 4 เควสต์ (รวมข้ามโหมด)
    const all = [].concat(POOL.goodjunk, POOL.groups, POOL.hydration, POOL.plate);
    for (let i=all.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [all[i],all[j]]=[all[j],all[i]]; }
    p.daily = { date: today, missions: all.slice(0,4).map(m=>({ id:m.id, label:m.label })), done: [] };
    save(p); this.profile = p;
    return p.daily;
  },
  markDailyDone(id){
    const p = this.profile || load() || newProfile();
    const d = p.daily || {date:todayStr(), missions:[], done:[]};
    if (!d.done.includes(id)) d.done.push(id);
    p.daily = d; save(p); this.profile = p;
  },

  // ---- Export / Import ----
  exportJSON(){
    const p = this.profile || load() || newProfile();
    const blob = new Blob([JSON.stringify(p,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    return url;
  },
  importJSON(obj){
    try{
      const p = (typeof obj==='string') ? JSON.parse(obj) : obj;
      if (!p || !p.modes) throw new Error('Invalid profile');
      save(p); this.profile = p; this._emit('imported'); return true;
    }catch(e){ console.error('[Progress] import failed', e); return false; }
  },

  save(){ if (this.profile) save(this.profile); }
};
