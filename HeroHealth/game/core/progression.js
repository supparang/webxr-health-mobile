// === Hero Health Academy — core/progression.js (v2.1: local-date safe + robust storage + helpers) ===
//
// Improvements over previous version:
// - Use local date (Asia/Bangkok-safe) instead of UTC ISO when rotating daily missions
// - Hardened localStorage load/save with schema merge & versioning
// - Added helpers: getDaily(), resetDaily(), setXPLevel(level,xp), setModeStat(key,patch)
// - Emits more consistent events and keeps API backward-compatible
//
// Public API:
//   Progress.init()
//   Progress.on((type,payload)=>{})
//   Progress.beginRun(mode, diff, lang)
//   Progress.endRun({ score, bestCombo, timePlayed, acc })
//   Progress.getStatSnapshot()
//   Progress.profile()         // returns live object (read-only by convention)
//   Progress.genDaily()        // (re)generate and return today's daily
//   Progress.getDaily()        // return today's daily without regenerating
//   Progress.markDaily(id)     // mark daily mission complete by id
//   Progress.addMissionDone(mode)
//   Progress.exportProfile()
//   Progress.importProfile(json)
//   Progress.resetDaily()      // force regenerate today's daily
//   Progress.setXPLevel(level, xp)         // (optional admin/debug)
//   Progress.setModeStat(modeKey, patch)   // (optional admin/debug)
//   Progress.runCtx            // current run context (null if none)
//
export const Progress = (() => {
  const LS_KEY = 'hha_profile_v2';
  const VERSION = 2;
  const listeners = new Set();
  let profile = null;
  let runCtx = null;

  /* ====================== Schema & Utilities ====================== */
  function defProfile(){
    return {
      version: VERSION,
      level: 1,
      xp: 0,
      meta: { totalRuns: 0, bestCombo: 0, lastPlayedAt: 0 },
      modes: {
        goodjunk:  { bestScore: 0, accAvg: 0, games: 0, missionDone: 0, lastPlayedAt: 0 },
        groups:    { bestScore: 0, accAvg: 0, games: 0, missionDone: 0, lastPlayedAt: 0 },
        hydration: { bestScore: 0, accAvg: 0, games: 0, missionDone: 0, lastPlayedAt: 0 },
        plate:     { bestScore: 0, accAvg: 0, games: 0, missionDone: 0, lastPlayedAt: 0 },
      },
      daily: { date: '', missions: [], done: [] }
    };
  }
  function mergeSchema(obj){
    const base = defProfile();
    // shallow merge top-level
    const out = { ...base, ...(obj||{}) };
    // modes ensure keys
    out.modes = { ...base.modes, ...(obj?.modes||{}) };
    for (const k of Object.keys(base.modes)){
      out.modes[k] = { ...base.modes[k], ...(obj?.modes?.[k]||{}) };
    }
    // daily ensure shape
    out.daily = { ...base.daily, ...(obj?.daily||{}) };
    // version
    out.version = VERSION;
    return out;
  }
  function safeSave(p){
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
  }
  function safeLoad(){
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defProfile();
      const parsed = JSON.parse(raw);
      return mergeSchema(parsed);
    } catch {
      return defProfile();
    }
  }
  // Local date string (YYYY-MM-DD) independent of timezone issues from toISOString()
  function localDateStr(d=new Date()){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd= String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }
  function emit(type,p){ for(const f of listeners) { try{ f(type,p); }catch{} } }

  /* ====================== Lifecycle ====================== */
  function save(){ safeSave(profile); }
  function load(){ profile = safeLoad(); }

  function init(){
    load();
    ensureDaily(); // rotate on start if needed
  }
  function on(cb){ listeners.add(cb); return ()=>listeners.delete(cb); }

  /* ====================== Daily Missions ====================== */
  function ensureDaily(){
    const today = localDateStr();
    const d = profile.daily || (profile.daily = { date:'', missions:[], done:[] });
    if (d.date === today && Array.isArray(d.missions) && d.missions.length) return d;

    // generate 3 distinct missions
    const pool = [
      'เล่นโหมดใดก็ได้ 2 รอบ', 'ทำคอมโบ ≥ x15', 'คะแนนรวม ≥ 400',
      'เก็บ Golden อย่างน้อย 2', 'เปิด FEVER อย่างน้อย 1', 'ความแม่น ≥ 70%',
      'Plate: ไม่มี Overfill', 'Hydration: ไม่ขึ้น HIGH',
      'Groups: เป้าหมายครบ 3 รอบ', 'Good vs Junk: Perfect ≥ 10'
    ];
    const bag = pool.slice();
    const pick = [];
    for (let i=0;i<3;i++){
      const k = (Math.random()*bag.length)|0;
      pick.push(bag.splice(k,1)[0]);
    }
    profile.daily = {
      date: today,
      missions: pick.map((t,i)=>({ id:`d${i+1}`, label:t })),
      done: []
    };
    save();
    emit('daily_rotate', { date: today, missions: profile.daily.missions });
    return profile.daily;
  }
  function genDaily(){ return ensureDaily(); }
  function getDaily(){ ensureDaily(); return profile.daily; }
  function resetDaily(){ profile.daily = { date:'', missions:[], done:[] }; ensureDaily(); emit('daily_reset', profile.daily); return profile.daily; }
  function markDaily(id){
    ensureDaily();
    const s = new Set(profile.daily.done || []);
    s.add(String(id));
    profile.daily.done = [...s];
    save();
    emit('daily_update', { done: profile.daily.done.slice() });
  }

  /* ====================== Run Tracking ====================== */
  function beginRun(mode, diff, lang){
    runCtx = { mode: String(mode||'unknown'), diff: String(diff||'Normal'), lang: (lang||'TH').toUpperCase(), missions: [], startTs: Date.now() };
    emit('run_start', { ...runCtx });
    return runCtx.missions; // (kept for compatibility with any external mission binder)
  }
  function endRun({ score=0, bestCombo=0, timePlayed=0, acc=0 }={}){
    if (!runCtx) return;
    const mode = runCtx.mode;
    const m = profile.modes[mode] || (profile.modes[mode] = { ...defProfile().modes.goodjunk });

    // Update mode stats
    m.bestScore = Math.max(m.bestScore|0, score|0);
    m.accAvg = (m.games===0) ? (acc|0) : (0.35*acc + 0.65*(m.accAvg||0));
    m.games = (m.games|0)+1;
    m.lastPlayedAt = Date.now();

    // Global stats
    profile.meta.totalRuns = (profile.meta.totalRuns|0)+1;
    profile.meta.bestCombo = Math.max(profile.meta.bestCombo|0, bestCombo|0);
    profile.meta.lastPlayedAt = Date.now();

    // XP & Level (simple model; bounded to avoid runaway)
    const gain = Math.max(5, Math.min(150, Math.round(score/20 + acc))); // cap gain for safety
    profile.xp = (profile.xp|0) + gain;
    while (profile.xp >= profile.level*120){
      profile.xp -= profile.level*120;
      profile.level++;
      emit('level_up', { level: profile.level });
    }

    save();
    emit('run_end', { mode, score, acc, bestCombo, timePlayed, xpGain: gain, level: profile.level, xp: profile.xp });
    runCtx = null;
  }

  /* ====================== Missions / Quests (delegation) ====================== */
  function event(type,payload){ emit(type,payload); }
  function addMissionDone(mode){
    const m = profile.modes[mode];
    if (!m) return;
    m.missionDone = (m.missionDone|0) + 1;
    save();
    emit('mission_done', { mode, missionDone: m.missionDone });
  }

  /* ====================== Stats & Admin Helpers ====================== */
  function getStatSnapshot(){
    const rows = Object.keys(profile.modes).map(k=>{
      const v = profile.modes[k] || {};
      return {
        key: k,
        bestScore: v.bestScore|0,
        acc: +((v.accAvg||0).toFixed(1)),
        runs: v.games|0,
        missions: v.missionDone|0,
        lastPlayedAt: v.lastPlayedAt||0
      };
    });
    return {
      level: profile.level|0,
      xp: profile.xp|0,
      totalRuns: profile.meta.totalRuns|0,
      bestCombo: profile.meta.bestCombo|0,
      lastPlayedAt: profile.meta.lastPlayedAt||0,
      rows
    };
  }

  // Admin/debug helpers (optional use)
  function setXPLevel(level, xp=0){
    profile.level = Math.max(1, level|0);
    profile.xp = Math.max(0, xp|0);
    save();
    emit('xp_set', { level: profile.level, xp: profile.xp });
  }
  function setModeStat(modeKey, patch={}){
    if (!profile.modes[modeKey]) profile.modes[modeKey] = { ...defProfile().modes.goodjunk };
    profile.modes[modeKey] = { ...profile.modes[modeKey], ...patch };
    save();
    emit('mode_patch', { mode: modeKey, value: { ...profile.modes[modeKey] } });
  }

  /* ====================== Export / Import ====================== */
  function exportProfile(){
    return JSON.stringify({ exportedAt: Date.now(), version: VERSION, profile }, null, 2);
  }
  function importProfile(json){
    try{
      const obj = JSON.parse(json);
      const src = obj?.profile && typeof obj.profile==='object' ? obj.profile : obj;
      if (!src || typeof src !== 'object' || !src.modes) throw new Error('Invalid profile');
      profile = mergeSchema(src);
      save();
      emit('profile_imported', { version: profile.version });
      return true;
    }catch(e){
      console.warn('[Progress] import fail', e);
      return false;
    }
  }

  /* ====================== Public Surface ====================== */
  return {
    init, on,
    emit: event,
    beginRun, endRun,
    getStatSnapshot,
    profile: ()=>profile,
    genDaily, getDaily, markDaily, resetDaily,
    addMissionDone,
    exportProfile, importProfile,
    setXPLevel, setModeStat,
    get runCtx(){ return runCtx; }
  };
})();
