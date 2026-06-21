(function(){
  const KEY='csai2601_uxquest_progress_v1';
  const defaults={
    name:'Designer',dxp:0,
    skills:{empathy:0,clarity:0,flow:0},
    missions:{w1:{bestScore:0,stars:0,cleared:false}},
    badges:[],
    events:[]
  };
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function stored(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}}
  function get(){
    const s=stored();
    return {
      ...clone(defaults),...s,
      skills:{...defaults.skills,...(s.skills||{})},
      missions:{...defaults.missions,...(s.missions||{})},
      badges:Array.isArray(s.badges)?s.badges:[],
      events:Array.isArray(s.events)?s.events:[]
    };
  }
  function save(data){localStorage.setItem(KEY,JSON.stringify(data));return data;}
  function reset(){localStorage.removeItem(KEY);return clone(defaults);}
  function level(dxp){
    if(dxp>=1500)return {n:6,name:'Human-Centered AI Builder'};
    if(dxp>=1050)return {n:5,name:'Experience Guardian'};
    if(dxp>=700)return {n:4,name:'Interface Crafter'};
    if(dxp>=400)return {n:3,name:'Flow Architect'};
    if(dxp>=180)return {n:2,name:'Friction Finder'};
    return {n:1,name:'Signal Scout'};
  }
  function logEvent(type,payload={}){
    const p=get();
    p.events=[...(p.events||[]),{type,at:new Date().toISOString(),...payload}].slice(-120);
    save(p);
  }
  function addMissionResult(missionId,result){
    const p=get();
    const old=p.missions[missionId]||{bestScore:0,stars:0,cleared:false,dxpEarned:0,skills:{}};
    const oldStars=old.stars||0;
    const newStars=Math.max(oldStars,result.stars||0);
    const delta=Math.max(0,(result.dxp||0)-(old.dxpEarned||0));
    p.dxp+=delta;
    for(const key of ['empathy','clarity','flow']){
      const oldSkill=old.skills?.[key]||0;
      const nextSkill=result.skills?.[key]||0;
      p.skills[key]=(p.skills[key]||0)+Math.max(0,nextSkill-oldSkill);
    }
    p.missions[missionId]={
      ...old,...result,
      bestScore:Math.max(old.bestScore||0,result.score||0),
      stars:newStars,
      cleared:newStars>=1,
      dxpEarned:Math.max(old.dxpEarned||0,result.dxp||0),
      skills:{
        empathy:Math.max(old.skills?.empathy||0,result.skills?.empathy||0),
        clarity:Math.max(old.skills?.clarity||0,result.skills?.clarity||0),
        flow:Math.max(old.skills?.flow||0,result.skills?.flow||0)
      }
    };
    const badge=result.badge || (missionId==='w1'?'Friction Finder':null);
    if(badge && !p.badges.includes(badge))p.badges.push(badge);
    p.events=[...(p.events||[]),{type:'mission_complete',missionId,at:new Date().toISOString(),score:result.score||0,stars:result.stars||0,mode:result.mode||'core'}].slice(-120);
    save(p);
    return p;
  }
  window.UXQ={get,save,reset,level,addMissionResult,logEvent};
})();
