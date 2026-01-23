// === /herohealth/vr/hha-hw-weekly.js ===
// Weekly Missions (Local)
// API: HHA_HW_WEEK.getCurrent(), HHA_HW_WEEK.evaluate(summary)

(function(){
  'use strict';
  const WIN = window;
  const LS = 'HHA_HW_WEEKLY';

  function isoWeekKey(d=new Date()){
    // ISO week key: YYYY-Www
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    const yyyy = date.getUTCFullYear();
    const ww = String(weekNo).padStart(2,'0');
    return `${yyyy}-W${ww}`;
  }

  function load(){
    try{
      const s = localStorage.getItem(LS);
      if(s) return JSON.parse(s);
    }catch{}
    return {};
  }
  function save(obj){
    try{ localStorage.setItem(LS, JSON.stringify(obj)); }catch{}
  }

  // mission pool (rotate by week)
  const MISSIONS = [
    { id:'M1', name:'มือสะอาดขั้นเทพ', check:(s)=> (s.stepAcc>=0.85 && s.hazHits<=2) },
    { id:'M2', name:'คอมโบสายฟ้า', check:(s)=> (s.comboMax>=12) },
    { id:'M3', name:'อยู่รอดแบบโปร', check:(s)=> (s.durationPlayedSec>=Math.min(60, s.durationPlannedSec||60) && s.misses<=2) },
    { id:'M4', name:'บอสไม่กลัว', check:(s)=> (Number(s.bossClears||0)>=1) },
    { id:'M5', name:'ครบ 2 รอบ!', check:(s)=> (Number(s.loopsDone||0)>=2) },
  ];

  function pickMission(weekKey){
    // deterministic pick by digits
    let hash=0;
    for(const ch of weekKey) hash = (hash*31 + ch.charCodeAt(0))>>>0;
    return MISSIONS[ hash % MISSIONS.length ];
  }

  const API = {
    getCurrent(){
      const wk = isoWeekKey(new Date());
      const m = pickMission(wk);
      const db = load();
      const rec = db[wk] || { done:false, trophy:false, doneIso:'' };
      return { weekKey:wk, missionId:m.id, missionName:m.name, done:!!rec.done, trophy:!!rec.trophy };
    },
    evaluate(summary, opts={}){
      const allow = opts.allowInResearch ?? false;
      if(!allow && String(summary.runMode||'play') === 'study'){
        const cur = API.getCurrent();
        return Object.assign(cur, { evaluated:false, reason:'research_locked' });
      }

      const wk = isoWeekKey(new Date());
      const m = pickMission(wk);
      const ok = !!m.check(summary);

      const db = load();
      const rec = db[wk] || { done:false, trophy:false, doneIso:'' };

      if(ok && !rec.done){
        rec.done = true;
        rec.doneIso = (()=>{ try{return new Date().toISOString();}catch{return ''; } })();
        // trophy if high performance too
        rec.trophy = (summary.stepAcc>=0.88 && summary.hazHits<=1 && summary.misses<=2);
        db[wk] = rec;
        save(db);
      }
      return { weekKey:wk, missionId:m.id, missionName:m.name, done:!!rec.done, trophy:!!rec.trophy, evaluated:true };
    }
  };

  WIN.HHA_HW_WEEK = API;
})();