// === /herohealth/hygiene-vr/hygiene.weekly.js ===
// Weekly Challenge: resets weekly (ISO week key-ish) + trophy flag
// Exposes: window.HHA_HW_WEEK = { get(), evaluate(summary, opts), resetWeek() }

'use strict';

(function(){
  const WIN = window;
  const K = 'HHA_HW_WEEKLY';

  function load(fb){
    try{ const s = localStorage.getItem(K); return s? JSON.parse(s): fb; }catch{ return fb; }
  }
  function save(obj){ try{ localStorage.setItem(K, JSON.stringify(obj)); }catch{} }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function weekKey(d=new Date()){
    // Simple week key: YYYY-Wnn (not perfect ISO but stable enough for class use)
    const year = d.getFullYear();
    const start = new Date(year,0,1);
    const day = Math.floor((d - start) / 86400000);
    const w = Math.floor((day + start.getDay()) / 7) + 1;
    return `${year}-W${String(w).padStart(2,'0')}`;
  }

  function makeMission(key){
    // Rotate 4 mission templates by week number
    const n = Number((key.split('W')[1]||'1'))||1;
    const t = (n % 4);

    if(t===0) return { id:'W1', name:'No Germ Hit!',  goal:{ hazMax:0, accMin:0.72 }, trophy:{ hazMax:0, accMin:0.86, loopsMin:1 } };
    if(t===1) return { id:'W2', name:'Combo Hero',    goal:{ comboMin:14, accMin:0.72 }, trophy:{ comboMin:22, accMin:0.85, hazMax:1 } };
    if(t===2) return { id:'W3', name:'Loop Runner',   goal:{ loopsMin:1, accMin:0.70 }, trophy:{ loopsMin:2, accMin:0.83, missMax:2 } };
    return        { id:'W4', name:'Accuracy Master', goal:{ accMin:0.80 },              trophy:{ accMin:0.90, hazMax:1, missMax:2 } };
  }

  function meets(summary, rule){
    if(!rule) return true;
    const acc = clamp(summary.stepAcc,0,1);
    const haz = clamp(summary.hazHits||0,0,999);
    const miss= clamp(summary.misses||0,0,999);
    const combo = clamp(summary.comboMax||0,0,999);
    const loops = clamp(summary.loopsDone||0,0,999);

    if(rule.accMin!=null && acc < rule.accMin) return false;
    if(rule.hazMax!=null && haz > rule.hazMax) return false;
    if(rule.missMax!=null && miss > rule.missMax) return false;
    if(rule.comboMin!=null && combo < rule.comboMin) return false;
    if(rule.loopsMin!=null && loops < rule.loopsMin) return false;
    return true;
  }

  function get(){
    const key = weekKey();
    const st = load(null) || {};
    if(st.weekKey !== key){
      const mission = makeMission(key);
      const fresh = {
        weekKey: key,
        missionId: mission.id,
        missionName: mission.name,
        done:false,
        trophy:false,
        best: { score:0, acc:0, combo:0, loops:0, haz:999, miss:999 }
      };
      save(fresh);
      return fresh;
    }
    return st;
  }

  function evaluate(summary, opts={}){
    if(!summary || summary.game!=='hygiene') return null;

    const runMode = String(summary.runMode||'play').toLowerCase();
    const allowInResearch = !!opts.allowInResearch;
    if(runMode !== 'play' && !allowInResearch){
      // still attach mission fields so HUD can show, but no completion update
      const st0 = get();
      return { ...st0, blocked:true };
    }

    const st = get();
    const mission = makeMission(st.weekKey);

    // update best snapshot
    const score = Number(summary.scoreFinal || summary.score || 0);
    const acc = Number(summary.stepAcc||0);
    const combo = Number(summary.comboMax||0);
    const loops = Number(summary.loopsDone||0);
    const haz = Number(summary.hazHits||0);
    const miss = Number(summary.misses||0);

    if(score > (st.best?.score||0)){
      st.best = { score, acc, combo, loops, haz, miss };
    }

    const done = st.done || meets(summary, mission.goal);
    const trophy = st.trophy || meets(summary, mission.trophy);

    st.done = !!done;
    st.trophy = !!trophy;

    save(st);

    // If trophy -> set cosmetic flag
    if(trophy && WIN.HHA_HW_COS?.setFlag){
      WIN.HHA_HW_COS.setFlag('weekly_trophy', true);
      WIN.HHA_HW_COS.unlock?.('trophy');
    }

    WIN.dispatchEvent(new CustomEvent('hha:weekly', { detail: st }));
    return st;
  }

  function resetWeek(){
    try{ localStorage.removeItem(K); }catch{}
    return get();
  }

  WIN.HHA_HW_WEEK = { get, evaluate, resetWeek };
})();