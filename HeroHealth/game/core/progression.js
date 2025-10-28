// === Hero Health Academy — core/progression.js (profile+daily+export/import) ===
export const Progress = (() => {
  const LS_KEY = 'hha_profile_v2';
  const listeners = new Set();
  let profile = null;
  let runCtx = null;

  function defProfile(){
    return {
      version:2,
      level:1, xp:0,
      meta:{ totalRuns:0, bestCombo:0 },
      modes:{
        goodjunk:{ bestScore:0, accAvg:0, games:0, missionDone:0 },
        groups:{   bestScore:0, accAvg:0, games:0, missionDone:0 },
        hydration:{bestScore:0, accAvg:0, games:0, missionDone:0 },
        plate:{    bestScore:0, accAvg:0, games:0, missionDone:0 },
      },
      daily:{ date:'', missions:[], done:[] }
    };
  }

  function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(profile)); }catch{} }
  function load(){ try{ profile = JSON.parse(localStorage.getItem(LS_KEY)||'')||defProfile(); }catch{ profile = defProfile(); } }

  function init(){ load(); ensureDaily(); }
  function on(cb){ listeners.add(cb); return ()=>listeners.delete(cb); }
  function emit(type,p){ for(const f of listeners) try{ f(type,p); }catch{} }

  // ---------- Daily ----------
  function ensureDaily(){
    const today = new Date().toISOString().slice(0,10);
    if (profile.daily.date === today && (profile.daily.missions||[]).length) return profile.daily;
    // gen ใหม่
    const pool = [
      'เล่นโหมดใดก็ได้ 2 รอบ', 'ทำคอมโบ ≥ x15', 'คะแนนรวม ≥ 400',
      'เก็บ Golden อย่างน้อย 2', 'เปิด FEVER อย่างน้อย 1', 'ความแม่น ≥ 70%',
      'Plate: ไม่มี Overfill', 'Hydration: ไม่ขึ้น HIGH', 'Groups: เป้าหมายครบ 3 รอบ', 'Good vs Junk: Perfect ≥ 10'
    ];
    const pick = []; const bag=[...pool];
    for(let i=0;i<3;i++){ const k=(Math.random()*bag.length)|0; pick.push(bag.splice(k,1)[0]); }
    profile.daily = { date: today, missions: pick.map((t,i)=>({id:`d${i+1}`, label:t})), done:[] };
    save();
    return profile.daily;
  }
  function genDaily(){ return ensureDaily(); }
  function markDaily(id){ ensureDaily(); const s=new Set(profile.daily.done||[]); s.add(id); profile.daily.done=[...s]; save(); emit('daily_update'); }

  // ---------- Runs ----------
  function beginRun(mode, diff, lang){
    runCtx = { mode, diff, lang, missions:[], startTs: Date.now() };
    emit('run_start', runCtx);
    return runCtx.missions;
  }
  function endRun({ score=0, bestCombo=0, timePlayed=0, acc=0 }={}){
    if (!runCtx) return;
    const mode = runCtx.mode;
    const m = profile.modes[mode] || (profile.modes[mode]={ bestScore:0, accAvg:0, games:0, missionDone:0 });
    m.bestScore = Math.max(m.bestScore|0, score|0);
    m.accAvg = (m.games===0) ? acc : (0.35*acc + 0.65*m.accAvg); // EMA
    m.games = (m.games|0)+1;
    profile.meta.totalRuns = (profile.meta.totalRuns|0)+1;
    profile.meta.bestCombo = Math.max(profile.meta.bestCombo|0, bestCombo|0);
    // XP & Level (ง่าย ๆ)
    const gain = Math.max(5, Math.round(score/20 + acc));
    profile.xp = (profile.xp|0) + gain;
    while (profile.xp >= profile.level*120){ profile.xp -= profile.level*120; profile.level++; emit('level_up', {level:profile.level}); }
    save();
    emit('run_end', { mode, score, acc, bestCombo, timePlayed });
    runCtx = null;
  }

  // ---------- Missions/Quests (delegation) ----------
  function event(type,payload){ emit(type,payload); }
  function addMissionDone(mode){ const m=profile.modes[mode]; if(!m) return; m.missionDone=(m.missionDone|0)+1; save(); emit('mission_done'); }

  // ---------- Stats ----------
  function getStatSnapshot(){
    const rows = Object.keys(profile.modes).map(k=>{
      const v=profile.modes[k]; return { key:k, bestScore:v.bestScore|0, acc:+(v.accAvg||0).toFixed(1), runs:v.games|0, missions:v.missionDone|0 };
    });
    return { level:profile.level|0, xp:profile.xp|0, totalRuns:profile.meta.totalRuns|0, bestCombo:profile.meta.bestCombo|0, rows };
  }

  // ---------- Export / Import ----------
  function exportProfile(){ return JSON.stringify(profile, null, 2); }
  function importProfile(json){
    try{
      const obj = JSON.parse(json);
      if (!obj || typeof obj!=='object' || !obj.modes) throw new Error('Invalid');
      profile = obj; save(); emit('profile_imported'); return true;
    }catch(e){ console.warn('[Progress] import fail', e); return false; }
  }

  return { init, on, emit:event, beginRun, endRun, getStatSnapshot, profile:()=>profile, genDaily, markDaily, addMissionDone, exportProfile, importProfile, runCtx };
})();
