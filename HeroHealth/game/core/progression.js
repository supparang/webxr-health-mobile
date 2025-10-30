// === core/progression.js (v2.2: daily-event binding)
export const Progress = (() => {
  const LS_KEY = 'hha_profile_v2'; const VERSION = 2; const listeners = new Set();
  let profile=null, runCtx=null;

  function defProfile(){ return {
    version:VERSION, level:1, xp:0, meta:{ totalRuns:0, bestCombo:0, lastPlayedAt:0 },
    modes:{ goodjunk:{bestScore:0,accAvg:0,games:0,missionDone:0,lastPlayedAt:0},
            groups:{bestScore:0,accAvg:0,games:0,missionDone:0,lastPlayedAt:0},
            hydration:{bestScore:0,accAvg:0,games:0,missionDone:0,lastPlayedAt:0},
            plate:{bestScore:0,accAvg:0,games:0,missionDone:0,lastPlayedAt:0} },
    daily:{ date:'', missions:[], done:[] }, todayRuns:{ date:'', count:0 } }; }
  function mergeSchema(obj){ const base=defProfile(); const out={...base,...(obj||{})};
    out.modes={...base.modes,...(obj?.modes||{})}; for(const k of Object.keys(base.modes)){ out.modes[k]={...base.modes[k], ...(obj?.modes?.[k]||{})}; }
    out.daily={...base.daily,...(obj?.daily||{})}; out.todayRuns={...base.todayRuns,...(obj?.todayRuns||{})}; out.version=VERSION; return out; }
  function safeSave(p){ try{ localStorage.setItem(LS_KEY, JSON.stringify(p)); }catch{} }
  function safeLoad(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return defProfile(); return mergeSchema(JSON.parse(raw)); }catch{ return defProfile(); } }
  function localDateStr(d=new Date()){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
  function emit(t,p){ for(const f of listeners){ try{ f(t,p);}catch{} } }
  function save(){ safeSave(profile); } function load(){ profile=safeLoad(); }
  function init(){ load(); ensureDaily(); ensureTodayRuns(); }
  function on(cb){ listeners.add(cb); return ()=>listeners.delete(cb); }

  const DAILY_POOL = [
    { key:'runs_any_2', need:2,  labelTH:'เล่นโหมดใดก็ได้ 2 รอบ', labelEN:'Play any mode 2 runs' },
    { key:'combo_ge_15',need:15, labelTH:'ทำคอมโบ ≥ x15',          labelEN:'Combo ≥ x15' },
    { key:'score_ge_400',need:400,labelTH:'คะแนนรวม ≥ 400',         labelEN:'Score ≥ 400' },
    { key:'golden_ge_2',need:2,  labelTH:'เก็บ Golden อย่างน้อย 2', labelEN:'Collect ≥2 Golden' },
    { key:'fever_ge_1', need:1,  labelTH:'เปิด FEVER อย่างน้อย 1',  labelEN:'Trigger ≥1 FEVER' },
    { key:'acc_ge_70',  need:70, labelTH:'ความแม่น ≥ 70%',          labelEN:'Accuracy ≥ 70%' },
    { key:'plate_no_overfill',need:1,labelTH:'Plate: ไม่มี Overfill',labelEN:'Plate: no Overfill' },
    { key:'hydration_no_high',need:1,labelTH:'Hydration: ไม่ขึ้น HIGH',labelEN:'Hydration: no HIGH' },
    { key:'groups_target_rounds_ge_3',need:3,labelTH:'Groups: เป้าหมายครบ 3 รอบ',labelEN:'Groups: 3 target rounds' },
    { key:'goodjunk_perfect_ge_10',need:10,labelTH:'Good vs Junk: Perfect ≥ 10',labelEN:'Good vs Junk: Perfect ≥ 10' },
  ];
  function roll3Distinct(arr){ const bag=arr.slice(); const out=[]; for(let i=0;i<3&&bag.length;i++){ const k=(Math.random()*bag.length)|0; out.push(bag.splice(k,1)[0]); } return out; }
  function ensureDaily(){ const today=localDateStr(); const d=profile.daily||(profile.daily={date:'',missions:[],done:[]});
    if (d.date===today && Array.isArray(d.missions) && d.missions.length) return d;
    const picks=roll3Distinct(DAILY_POOL);
    profile.daily={ date:today, missions:picks.map((m,i)=>({ id:`d${i+1}`, key:m.key, need:m.need, label:(navigator.language||'th').toLowerCase().startsWith('th')?m.labelTH:m.labelEN })), done:[] };
    save(); emit('daily_rotate',{ date:today, missions:profile.daily.missions }); return profile.daily; }
  function genDaily(){ return ensureDaily(); } function getDaily(){ ensureDaily(); return profile.daily; }
  function resetDaily(){ profile.daily={date:'',missions:[],done:[]}; ensureDaily(); emit('daily_reset', profile.daily); return profile.daily; }
  function markDailyByKey(key){ ensureDaily(); const mis=profile.daily.missions||[]; const found=mis.find(m=>m.key===key); if(!found) return; markDaily(found.id); }
  function markDaily(id){ ensureDaily(); const s=new Set(profile.daily.done||[]); s.add(String(id)); profile.daily.done=[...s]; save(); emit('daily_update',{done:profile.daily.done.slice()}); }

  function ensureTodayRuns(){ const today=localDateStr(); if(!profile.todayRuns || profile.todayRuns.date!==today){ profile.todayRuns={date:today,count:0}; save(); } }
  function incTodayRuns(){ ensureTodayRuns(); profile.todayRuns.count=(profile.todayRuns.count|0)+1; save(); }

  function beginRun(mode,diff,lang){
    runCtx={ mode:String(mode||'unknown'), diff:String(diff||'Normal'), lang:(lang||'TH').toUpperCase(), startTs:Date.now(),
      flags:{ perfect:0, golden:0, fever:0, groupRounds:0, hydrationHigh:0, plateOverfill:0 },
      metrics:{ bestCombo:0, score:0, acc:0 } };
    emit('run_start', {...runCtx}); return [];
  }
  function notify(type, payload={}){
    if(!runCtx) return;
    switch(String(type)){
      case 'perfect': runCtx.flags.perfect+=1; break;
      case 'golden': runCtx.flags.golden+=1; break;
      case 'fever':  runCtx.flags.fever+=1; break;
      case 'group_round_done': runCtx.flags.groupRounds+=1; break;
      case 'hydration_high':  runCtx.flags.hydrationHigh+=1; break;
      case 'plate_overfill':  runCtx.flags.plateOverfill+=1; break;
      case 'combo_best': runCtx.metrics.bestCombo=Math.max(runCtx.metrics.bestCombo|0, payload?.value|0); break;
      case 'score_tick': runCtx.metrics.score=Math.max(runCtx.metrics.score|0, payload?.score|0); break;
      default: break;
    }
  }
  function endRun({ score=0, bestCombo=0, timePlayed=0, acc=0 }={}){
    if(!runCtx) return;
    const mode=runCtx.mode; const m=profile.modes[mode] || (profile.modes[mode]={...defProfile().modes.goodjunk});
    runCtx.metrics.bestCombo=Math.max(runCtx.metrics.bestCombo|0, bestCombo|0);
    runCtx.metrics.score=Math.max(runCtx.metrics.score|0, score|0); runCtx.metrics.acc=acc|0;
    m.bestScore=Math.max(m.bestScore|0, score|0); m.accAvg=(m.games===0)?(acc|0):(0.35*acc + 0.65*(m.accAvg||0)); m.games=(m.games|0)+1; m.lastPlayedAt=Date.now();
    profile.meta.totalRuns=(profile.meta.totalRuns|0)+1; profile.meta.bestCombo=Math.max(profile.meta.bestCombo|0, bestCombo|0); profile.meta.lastPlayedAt=Date.now();
    const gain=Math.max(5, Math.min(150, Math.round(score/20 + acc))); profile.xp=(profile.xp|0)+gain; while(profile.xp>=profile.level*120){ profile.xp-=profile.level*120; profile.level++; emit('level_up',{level:profile.level}); }
    ensureDaily(); ensureTodayRuns(); incTodayRuns(); if((profile.todayRuns.count|0)>=2) markDailyByKey('runs_any_2');
    if((runCtx.metrics.bestCombo|0)>=15) markDailyByKey('combo_ge_15');
    if((runCtx.metrics.score|0)    >=400) markDailyByKey('score_ge_400');
    if((runCtx.metrics.acc|0)      >= 70) markDailyByKey('acc_ge_70');
    if((runCtx.flags.golden|0)     >= 2) markDailyByKey('golden_ge_2');
    if((runCtx.flags.fever|0)      >= 1) markDailyByKey('fever_ge_1');
    if((runCtx.flags.groupRounds|0)>= 3) markDailyByKey('groups_target_rounds_ge_3');
    if(mode==='plate'     && (runCtx.flags.plateOverfill|0)===0) markDailyByKey('plate_no_overfill');
    if(mode==='hydration' && (runCtx.flags.hydrationHigh|0)===0) markDailyByKey('hydration_no_high');
    if(mode==='goodjunk'  && (runCtx.flags.perfect|0)     >=10)  markDailyByKey('goodjunk_perfect_ge_10');
    save(); emit('run_end',{ mode, score, acc, bestCombo, timePlayed, xpGain:gain, level:profile.level, xp:profile.xp }); runCtx=null;
  }

  function addMissionDone(mode){ const m=profile.modes[mode]; if(!m) return; m.missionDone=(m.missionDone|0)+1; save(); emit('mission_done',{mode,missionDone:m.missionDone}); }
  function getStatSnapshot(){ const rows=Object.keys(profile.modes).map(k=>{ const v=profile.modes[k]||{}; return { key:k, bestScore:v.bestScore|0, acc:+((v.accAvg||0).toFixed(1)), runs:v.games|0, missions:v.missionDone|0, lastPlayedAt:v.lastPlayedAt||0 }; }); return {
    level:profile.level|0, xp:profile.xp|0, totalRuns:profile.meta.totalRuns|0, bestCombo:profile.meta.bestCombo|0, lastPlayedAt:profile.meta.lastPlayedAt||0, todayRuns:{...(profile.todayRuns||{})}, rows }; }
  function setXPLevel(level,xp=0){ profile.level=Math.max(1,level|0); profile.xp=Math.max(0,xp|0); save(); emit('xp_set',{level:profile.level,xp:profile.xp}); }
  function setModeStat(modeKey,patch={}){ if(!profile.modes[modeKey]) profile.modes[modeKey]={...defProfile().modes.goodjunk}; profile.modes[modeKey]={...profile.modes[modeKey], ...patch}; save(); emit('mode_patch',{mode:modeKey,value:{...profile.modes[modeKey]}}); }
  function exportProfile(){ return JSON.stringify({ exportedAt:Date.now(), version:VERSION, profile }, null, 2); }
  function importProfile(json){ try{ const obj=JSON.parse(json); const src=obj?.profile&&typeof obj.profile==='object'?obj.profile:obj; if(!src||typeof src!=='object'||!src.modes) throw new Error('Invalid profile'); profile=mergeSchema(src); save(); emit('profile_imported',{version:profile.version}); return true; }catch(e){ console.warn('[Progress] import fail',e); return false; } }

  return { init,on, emit:(t,p)=>emit(t,p), beginRun,endRun, notify, getStatSnapshot, profile:()=>profile,
    genDaily,getDaily,markDaily,resetDaily, addMissionDone, exportProfile, importProfile, setXPLevel,setModeStat, get runCtx(){ return runCtx; } };
})();
