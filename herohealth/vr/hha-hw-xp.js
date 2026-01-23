// === /herohealth/vr/hha-hw-xp.js ===
// Handwash XP/Level (Local)
// API: HHA_HW_XP.get(), HHA_HW_XP.addFromSummary(summary), HHA_HW_XP.reset()

(function(){
  'use strict';
  const WIN = window;
  const LS = 'HHA_HW_XP';

  function load(){
    try{
      const s = localStorage.getItem(LS);
      if(s) return JSON.parse(s);
    }catch{}
    return { xp:0, level:1, progress:{cur:0,next:80,pct:0}, updatedIso:'' };
  }
  function save(st){
    try{ localStorage.setItem(LS, JSON.stringify(st)); }catch{}
  }

  // simple level curve (kid-friendly): next = 80 + (level-1)*35
  function xpToNext(level){
    return 80 + Math.max(0,(level-1))*35;
  }

  function recompute(st){
    let level = Math.max(1, Number(st.level||1));
    let xp = Math.max(0, Number(st.xp||0));

    // level up loop
    while(true){
      const need = xpToNext(level);
      if(xp >= need){
        xp -= need;
        level += 1;
        continue;
      }
      const pct = need ? Math.max(0, Math.min(1, xp/need)) : 0;
      st.xpTotal = Number(st.xpTotal||0); // optional
      st.level = level;
      st.xp = xp;
      st.progress = { cur: xp, next: need, pct };
      return st;
    }
  }

  function calcGain(summary){
    // gain based on accuracy + loops + boss + streak, clamp for fairness
    const stepAcc = Number(summary.stepAcc||0);
    const loops = Number(summary.loopsDone||0);
    const boss = Number(summary.bossClears||0);
    const comboMax = Number(summary.comboMax||0);
    const haz = Number(summary.hazHits||0);
    const miss = Number(summary.misses||0);

    let gain = 10; // base participation
    gain += Math.round(stepAcc * 45);            // up to +45
    gain += Math.min(loops, 6) * 6;              // +0..36
    gain += Math.min(boss, 3) * 18;              // +0..54
    gain += Math.min(comboMax, 30) * 0.6;        // +0..18
    gain -= Math.min(haz, 6) * 4;                // -0..24
    gain -= Math.min(miss, 6) * 3;               // -0..18

    gain = Math.max(6, Math.min(90, Math.round(gain)));
    return gain;
  }

  const API = {
    get(){
      const st = load();
      return recompute(st);
    },
    reset(){
      const st = { xp:0, level:1, progress:{cur:0,next:80,pct:0}, updatedIso:'' };
      save(st);
      return st;
    },
    addFromSummary(summary, opts={}){
      const allow = opts.allowInResearch ?? false;
      if(!allow && String(summary.runMode||'play') === 'study'){
        return { applied:false, reason:'research_locked', gained:0, state: API.get() };
      }
      const st0 = API.get();
      const gain = calcGain(summary);

      // keep an absolute total too (optional)
      st0.xpTotal = Number(st0.xpTotal||0) + gain;
      st0.xp = Number(st0.xp||0) + gain;
      st0.updatedIso = (()=>{ try{return new Date().toISOString();}catch{return ''; } })();

      const st1 = recompute(st0);
      save(st1);
      return { applied:true, gained: gain, state: st1 };
    }
  };

  WIN.HHA_HW_XP = API;
})();