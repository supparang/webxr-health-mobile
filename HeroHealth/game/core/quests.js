// === core/quests.js — Mini Quest Engine (Gold/Fever/Combo/Power/Perfect) ===
export const Quests = (function(){
  const state = {
    list: [],
    totalDone: 0,
    gold: 0, perfect: 0, fever: 0, combo: 0, power: 0, miss: 0
  };
  let hud=null, coach=null;

  function bindToMain(refs){
    hud=refs?.hud||null;
    coach=refs?.coach||null;
    refresh();
    return { refresh };
  }

  function beginRun(mode,diff,lang,time){
    state.list=[
      { key:'goldHit', label:(lang==='TH'?'ทอง':'Gold'), icon:'🌟', progress:0, need:3, done:false },
      { key:'perfect', label:(lang==='TH'?'เป๊ะเว่อร์':'Perfect'), icon:'💯', progress:0, need:10, done:false },
      { key:'combo',   label:(lang==='TH'?'คอมโบ':'Combo'), icon:'🔥', progress:0, need:20, done:false },
      { key:'fever',   label:(lang==='TH'?'ไฟลุก':'Fever'), icon:'⚡', progress:0, need:1, done:false },
      { key:'power',   label:(lang==='TH'?'พลังพิเศษ':'Power'), icon:'🛡️', progress:0, need:3, done:false }
    ];
    refresh();
  }

  function event(type,ev){
    if(type==='hit'){
      if(ev.meta?.quest==='goldHit'||ev.meta?.gold){ updateQuest('goldHit',1); }
      if(ev.result==='perfect'){ updateQuest('perfect',1); }
      if(ev.comboNow>=10){ updateQuest('combo',1); }
      if(ev.meta?.power){ updateQuest('power',1); }
    }
    else if(type==='fever' && ev?.on){ updateQuest('fever',1); }
    else if(type==='miss'){ state.miss++; }
    refresh();
  }

  function tick(info){ /* optional time tick use */ }

  function updateQuest(k,add){
    const q=state.list.find(q=>q.key===k);
    if(!q||q.done) return;
    q.progress=Math.min(q.need,q.progress+(add||1));
    if(q.progress>=q.need){ q.done=true; state.totalDone++; if(coach?.say) coach.say('✅ '+q.label+'!'); }
  }

  function refresh(){
    if(!hud||!hud.setQuestChips) return;
    hud.setQuestChips(state.list);
  }

  function endRun(summary){
    const res={ totalDone:state.totalDone, details:state.list.map(q=>`${q.label}: ${q.progress}/${q.need}`) };
    reset();
    return res;
  }

  function reset(){
    state.list=[]; state.totalDone=0; state.gold=state.perfect=state.combo=state.fever=state.power=0; state.miss=0;
  }

  return { bindToMain, beginRun, event, tick, endRun };
})();
