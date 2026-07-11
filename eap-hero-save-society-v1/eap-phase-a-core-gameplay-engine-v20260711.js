/* =========================================================
   EAP Hero Phase A — Core Gameplay Engine v20260711
   V1 SESSION DIRECTOR
   - S1-S15 mission contract: First Play 8, Replay 11, Elite Replay 13 tasks.
   - Mission arc: Brief -> Challenge -> Pressure -> Mini Rescue -> Reflection.
   - Per-session run count, source no-repeat window 6, item no-repeat window 24.
   - Adaptive CEFR lane A2 / A2+ / B1 / B1+ from recent accuracy, retry, hint, combo.
   - Publishes active run context for Sheet/evidence/teacher analytics.
   - Safe wrapper around EAPHero session/skill entry points; does not alter unlock,
     pass/fail, evidence validity, or teacher-review rules.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260711-EAP-PHASE-A-CORE-GAMEPLAY-V1';
  const STATE_KEY = 'EAP_PHASE_A_CORE_STATE_V1';
  const CONTEXT_KEY = 'EAP_PHASE_A_ACTIVE_CONTEXT_V1';
  const SOURCE_WINDOW = 6;
  const ITEM_WINDOW = 24;

  const SESSION_SKILLS = {
    1:['Reading','Speaking'], 2:['Reading','Writing'], 3:['Reading','Writing'],
    4:['Reading','Listening'], 5:['Reading','Writing'], 6:['Writing','Reading'],
    7:['Writing','Speaking'], 8:['Reading','Writing'], 9:['Writing','Speaking'],
    10:['Reading','Writing'], 11:['Writing','Speaking'], 12:['Reading','Writing'],
    13:['Listening','Writing'], 14:['Speaking','Writing'], 15:['Writing','Speaking']
  };

  const MODES = {
    first:{label:'First Play', tasks:8, core:[3,3], exposure:1, reflection:1},
    replay:{label:'Replay Remix', tasks:11, core:[4,4], exposure:2, reflection:1},
    elite:{label:'Elite Replay', tasks:13, core:[5,5], exposure:2, reflection:1}
  };

  const PHASES = [
    {id:'brief',label:'Mission Brief'},
    {id:'challenge',label:'Challenge'},
    {id:'pressure',label:'Pressure Round'},
    {id:'rescue',label:'Mini Rescue'},
    {id:'reflection',label:'Reflection'}
  ];

  function read(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch(_) { return {}; }
  }
  function write(state){ try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch(_){} return state; }
  function sid(value){
    const m = String(value == null ? '' : value).toUpperCase().match(/S?(1[0-5]|[1-9])/);
    return m ? Number(m[1]) : 1;
  }
  function modeFor(runCount){ return runCount <= 1 ? 'first' : runCount === 2 ? 'replay' : 'elite'; }
  function now(){ return new Date().toISOString(); }
  function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
  function hash(s){ let h=0; String(s||'').split('').forEach(ch=>{ h=(h*31+ch.charCodeAt(0))>>>0; }); return h; }
  function shuffle(list,seed){
    const out=list.slice(); let x=(seed>>>0)||123456789;
    for(let i=out.length-1;i>0;i--){ x=(1664525*x+1013904223)>>>0; const j=x%(i+1); [out[i],out[j]]=[out[j],out[i]]; }
    return out;
  }

  function recentPerformance(sessionNo){
    const state = read();
    const hist = (state.performance && state.performance[sessionNo]) || [];
    const recent = hist.slice(-12);
    if(!recent.length) return {accuracy:0.72,retry:0,hint:0,combo:0};
    const avg = key => recent.reduce((s,x)=>s+Number(x[key]||0),0)/recent.length;
    return {accuracy:avg('accuracy'),retry:avg('retry'),hint:avg('hint'),combo:avg('combo')};
  }

  function adaptiveLevel(sessionNo){
    const p = recentPerformance(sessionNo);
    let score = p.accuracy*100 + clamp(p.combo,0,8)*2 - clamp(p.retry,0,5)*5 - clamp(p.hint,0,5)*4;
    if(score >= 88) return 'B1+';
    if(score >= 75) return 'B1';
    if(score >= 60) return 'A2+';
    return 'A2';
  }

  function exposureSkills(core){ return ['Reading','Listening','Writing','Speaking'].filter(s=>!core.includes(s)); }

  function buildTasks(sessionNo,runCount){
    const modeId=modeFor(runCount), spec=MODES[modeId], core=SESSION_SKILLS[sessionNo]||SESSION_SKILLS[1];
    const exposure=exposureSkills(core), tasks=[];
    const seed=hash(sessionNo+':'+runCount+':'+adaptiveLevel(sessionNo));

    tasks.push({phase:'brief',role:'brief',skill:core[0],required:false,index:1});
    for(let i=0;i<spec.core[0];i++) tasks.push({phase:i===spec.core[0]-1?'pressure':'challenge',role:'core',skill:core[0],required:true,index:tasks.length+1});
    for(let i=0;i<spec.core[1];i++) tasks.push({phase:i===spec.core[1]-1?'rescue':'challenge',role:'core',skill:core[1],required:true,index:tasks.length+1});
    for(let i=0;i<spec.exposure;i++) tasks.push({phase:'pressure',role:'exposure',skill:exposure[i%exposure.length],required:false,index:tasks.length+1});
    tasks.push({phase:'reflection',role:'reflection',skill:core[(runCount+sessionNo)%2],required:false,index:tasks.length+1});

    let trimmed=tasks;
    while(trimmed.length>spec.tasks){
      const idx=trimmed.findIndex((t,i)=>i>0 && t.role==='exposure');
      if(idx>=0) trimmed.splice(idx,1); else trimmed.splice(trimmed.length-2,1);
    }
    while(trimmed.length<spec.tasks){
      trimmed.splice(trimmed.length-1,0,{phase:'rescue',role:'core',skill:core[trimmed.length%2],required:true,index:trimmed.length+1});
    }
    trimmed=shuffle(trimmed.slice(1,-1),seed).map((t,i)=>Object.assign({},t,{index:i+2}));
    trimmed.unshift({phase:'brief',role:'brief',skill:core[0],required:false,index:1});
    trimmed.push({phase:'reflection',role:'reflection',skill:core[1],required:false,index:spec.tasks});
    return trimmed.slice(0,spec.tasks);
  }

  function chooseSourceIds(sessionNo,count){
    const bank=window.EAP_GOLD_AUTHORED_BANK;
    const sources=bank && bank.sessions && bank.sessions[String(sessionNo)] && bank.sessions[String(sessionNo)].sources;
    if(!Array.isArray(sources)||!sources.length) return [];
    const state=read(); state.sourceHistory=state.sourceHistory||{};
    const history=state.sourceHistory[sessionNo]||[];
    const blocked=new Set(history.slice(-SOURCE_WINDOW));
    let pool=sources.filter(s=>!blocked.has(String(s.id)));
    if(pool.length<count) pool=sources.slice();
    const picked=shuffle(pool,hash(sessionNo+':source:'+Date.now())).slice(0,Math.min(count,pool.length));
    state.sourceHistory[sessionNo]=history.concat(picked.map(s=>String(s.id))).slice(-SOURCE_WINDOW*3);
    write(state);
    return picked.map(s=>String(s.id));
  }

  function beginSession(value,options){
    const sessionNo=sid(value), state=read(); state.runs=state.runs||{};
    const increment=!(options&&options.peek);
    const runCount=Math.max(1,Number(state.runs[sessionNo]||0)+(increment?1:0));
    if(increment) state.runs[sessionNo]=runCount;
    const modeId=modeFor(runCount), spec=MODES[modeId];
    const context={
      version:VERSION,sessionId:'S'+sessionNo,sessionNo,runCount,mode:modeId,modeLabel:spec.label,
      totalTasks:spec.tasks,coreSkills:(SESSION_SKILLS[sessionNo]||[]).slice(),adaptiveLevel:adaptiveLevel(sessionNo),
      sourceNoRepeatWindow:SOURCE_WINDOW,itemNoRepeatWindow:ITEM_WINDOW,phases:PHASES.slice(),
      tasks:buildTasks(sessionNo,runCount),sourceIds:chooseSourceIds(sessionNo,Math.min(spec.tasks,6)),
      startedAt:now(),completedTasks:0,combo:0,maxCombo:0
    };
    state.active=context; write(state);
    try { sessionStorage.setItem(CONTEXT_KEY,JSON.stringify(context)); } catch(_){}
    window.EAPPhaseAContext=context;
    window.dispatchEvent(new CustomEvent('eap:phase-a-session-start',{detail:context}));
    return context;
  }

  function recordTask(result){
    const state=read(), ctx=state.active||window.EAPPhaseAContext;
    if(!ctx) return null;
    result=result||{}; ctx.completedTasks=clamp(Number(ctx.completedTasks||0)+1,0,ctx.totalTasks);
    if(result.correct===true){ ctx.combo=Number(ctx.combo||0)+1; ctx.maxCombo=Math.max(ctx.maxCombo||0,ctx.combo); }
    else if(result.correct===false) ctx.combo=0;
    state.performance=state.performance||{}; state.performance[ctx.sessionNo]=state.performance[ctx.sessionNo]||[];
    state.performance[ctx.sessionNo].push({accuracy:result.correct===false?0:1,retry:Number(result.retry||0),hint:Number(result.hint||0),combo:Number(ctx.combo||0),at:now()});
    state.performance[ctx.sessionNo]=state.performance[ctx.sessionNo].slice(-40);
    ctx.adaptiveLevel=adaptiveLevel(ctx.sessionNo); state.active=ctx; write(state); window.EAPPhaseAContext=ctx;
    window.dispatchEvent(new CustomEvent('eap:phase-a-task-recorded',{detail:{context:ctx,result}}));
    return ctx;
  }

  function getContext(){ return (read().active)||window.EAPPhaseAContext||null; }

  function patchHero(){
    const hero=window.EAPHero; if(!hero||hero.__phaseACorePatched) return false;
    hero.__phaseACorePatched=true;
    ['startSession','openSession','openSkillMission'].forEach(name=>{
      if(typeof hero[name]!=='function') return;
      const original=hero[name];
      hero[name]=function(){
        const args=[].slice.call(arguments), sessionNo=sid(args[0] || (args[1]&&args[1].sessionId));
        const existing=getContext();
        if(!existing || existing.sessionNo!==sessionNo) beginSession(sessionNo);
        return original.apply(this,args);
      };
    });
    return true;
  }

  function mountStatus(){
    const app=document.getElementById('app'), ctx=getContext();
    if(!app||!ctx||app.querySelector('[data-eap-phase-a-status]')) return;
    const text=String(app.innerText||'');
    if(!/Session\s*\d+|S\d+|Mission|Challenge|Rescue/i.test(text)) return;
    const host=app.querySelector('.panel,.session-path-panel,main,section'); if(!host) return;
    const bar=document.createElement('div'); bar.dataset.eapPhaseAStatus='1';
    bar.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;padding:10px 12px;border:1px solid #bae6fd;border-radius:14px;background:#f0f9ff;color:#0c4a6e;font:800 12px/1.4 system-ui';
    bar.innerHTML='<span>⚡ '+ctx.modeLabel+'</span><span>• '+ctx.totalTasks+' tasks</span><span>• '+ctx.adaptiveLevel+'</span><span>• No-repeat '+ctx.sourceNoRepeatWindow+'/'+ctx.itemNoRepeatWindow+'</span>';
    host.insertAdjacentElement('afterbegin',bar);
  }

  window.EAPPhaseACoreGameplay={
    version:VERSION,sessionSkills:SESSION_SKILLS,modes:MODES,phases:PHASES,
    beginSession,recordTask,getContext,adaptiveLevel,buildTasks,chooseSourceIds,
    contract:{first:8,replay:11,elite:13,sourceNoRepeatWindow:SOURCE_WINDOW,itemNoRepeatWindow:ITEM_WINDOW}
  };

  const wait=setInterval(()=>{ if(patchHero()) clearInterval(wait); },100);
  new MutationObserver(()=>setTimeout(mountStatus,50)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',mountStatus);
})();