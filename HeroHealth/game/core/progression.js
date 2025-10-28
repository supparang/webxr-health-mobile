// === Hero Health Academy — core/progression.js (robust profile + daily + export/import) ===
export const Progress = (() => {
  const KEY = 'hha_profile_v2';

  const profile = {
    level: 1,
    xp: 0,
    modes: { goodjunk:{}, groups:{}, hydration:{}, plate:{} },
    meta: { totalRuns: 0, bestCombo: 0 },
    daily: { date: '', missions: [], done: [] },
    history: [] // keep last 30 {date, mode, score, acc, bestCombo}
  };

  const listeners = new Set();
  let runCtx = null;

  // ---------- Storage ----------
  function load(){
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    try{
      const data = JSON.parse(raw);
      Object.assign(profile, data);
      // sanitize
      profile.history = Array.isArray(profile.history) ? profile.history.slice(-30) : [];
    }catch(e){ console.warn('[Progress] load error', e); }
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(profile)); }catch{} }

  // ---------- Leveling ----------
  function addXP(n){
    profile.xp = Math.max(0, (profile.xp|0) + (n|0));
    // simple curve: every 500 xp per level
    while (profile.xp >= profile.level * 500){
      profile.level++;
      emit('level_up');
    }
  }

  // ---------- Daily ----------
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function genDaily(){
    const today = todayStr();
    if (profile.daily.date !== today){
      // (ตัวอย่าง) สุ่มภารกิจ 3 ข้อข้ามโหมด
      profile.daily = {
        date: today,
        missions: [
          { id:'d_score300', label:'ทำคะแนนรวม ≥ 300' },
          { id:'d_fever1',   label:'เปิด FEVER อย่างน้อย 1 ครั้ง' },
          { id:'d_play2',    label:'เล่นให้ครบ 2 โหมด' }
        ],
        done: []
      };
      save();
    }
    return profile.daily;
  }
  function markDaily(id){
    const d = genDaily();
    if (!d.done.includes(id)) d.done.push(id);
    save();
  }

  // ---------- Runtime Events ----------
  function beginRun(mode, diff, lang='TH'){
    runCtx = { mode, diff, lang, start: Date.now(), missions: genDaily().missions };
    emit('run_start');
    return runCtx.missions;
  }

  function event(type, payload){
    // สำหรับ hook ภายนอกถ้าต้องการ
    emit(type, payload);
  }

  function endRun({ score=0, bestCombo=0, timePlayed=0, acc=0 }){
    if (!runCtx) return;
    const { mode } = runCtx;

    // update per-mode
    const m = profile.modes[mode] ||= {};
    m.games = (m.games|0) + 1;
    m.bestScore = Math.max(m.bestScore|0, score|0);
    // moving average accuracy
    const prev = m.accAvg||0;
    m.accAvg = +(prev ? ((prev*(m.games-1) + acc)/m.games) : acc).toFixed(1);

    // meta
    profile.meta.totalRuns = (profile.meta.totalRuns|0) + 1;
    profile.meta.bestCombo = Math.max(profile.meta.bestCombo|0, bestCombo|0);

    // XP (อย่างง่าย)
    addXP(Math.max(10, Math.round(score/5)));

    // history (rotate 30)
    profile.history.push({ date: todayStr(), mode, score, acc, bestCombo });
    if (profile.history.length > 30) profile.history.shift();

    save();
    emit('run_end');

    // daily auto checks
    if (score >= 300) markDaily('d_score300');
    // (ตัวอย่าง) เปิด FEVER ส่งมาจาก main ผ่าน event('fever',{kind:'start'})
    // เล่นครบ 2 โหมด: ประเมินจาก history วันนี้
    const playedToday = new Set(profile.history.filter(h=>h.date===todayStr()).map(h=>h.mode));
    if (playedToday.size >= 2) markDaily('d_play2');

    runCtx = null;
  }

  // ---------- Stats snapshot ----------
  function getStatSnapshot(){
    const rows = Object.keys(profile.modes).map(k=>{
      const v = profile.modes[k]||{};
      return { key:k, bestScore:v.bestScore||0, acc:+(v.accAvg||0).toFixed(1), runs:v.games||0, missions:v.missionDone||0 };
    });
    return {
      level: profile.level||1,
      xp: profile.xp||0,
      totalRuns: profile.meta?.totalRuns||0,
      bestCombo: profile.meta?.bestCombo||0,
      rows
    };
  }

  // ---------- Export / Import ----------
  function exportJSON(){
    const blob = new Blob([JSON.stringify(profile,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `HHA_profile_${todayStr()}.json`;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ try{ a.remove(); URL.revokeObjectURL(url);}catch{} }, 100);
  }
  function importJSON(file){
    return new Promise((resolve,reject)=>{
      const rd = new FileReader();
      rd.onerror = reject;
      rd.onload = ()=>{
        try{
          const data = JSON.parse(rd.result);
          Object.assign(profile, data);
          save(); emit('profile_imported'); resolve(profile);
        }catch(e){ reject(e); }
      };
      rd.readAsText(file);
    });
  }

  // ---------- Events ----------
  function on(fn){ listeners.add(fn); }
  function off(fn){ listeners.delete(fn); }
  function emit(type, payload){ for(const fn of listeners) try{ fn(type, payload); }catch{} }

  // Init
  function init(){ load(); genDaily(); save(); emit('ready'); }

  return {
    profile, runCtx,
    init, beginRun, endRun, event,
    on, off,
    genDaily, getStatSnapshot,
    exportJSON, importJSON
  };
})();
