/* =========================================================
   EAP Hero Phase A2 — Multi-Task Session Runner v20260711
   - Uses EAPSessionUltimateEngine A1 plan for S1-S15.
   - First 8 / Replay 11 / Elite 13 tasks.
   - Mission arc UI: Brief -> Challenge -> Pressure -> Mini Rescue -> Reflection.
   - Existing skill missions remain the task executors; this runner sequences them.
   - New evidence automatically completes the matching active task.
   - Exposure tasks are optional and never block the original unlock contract.
   - Does not change scoring, pass marks, Sheet sync, teacher review, or route unlock.
========================================================= */
(function(){
  'use strict';

  var VERSION='v20260711-EAP-PHASE-A2-MULTITASK-RUNNER-V1';
  var RUNNER_KEY='EAP_PHASE_A2_RUNNER_V1';
  var STYLE_ID='eap-phase-a2-runner-style';
  var scanTimer=null, renderTimer=null, baselineIds={};

  function text(v){ return String(v==null?'':v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function readRunner(){ try{return JSON.parse(localStorage.getItem(RUNNER_KEY)||'{}');}catch(_){return{};} }
  function writeRunner(v){ try{localStorage.setItem(RUNNER_KEY,JSON.stringify(v||{}));}catch(_){} return v||{}; }
  function readProgress(){ try{return JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');}catch(_){return{};} }
  function sidFromPage(){ var m=text(document.getElementById('app')&&document.getElementById('app').innerText).match(/(?:Session\s*|Week\s*|\bS)(1[0-5]|[1-9])\b/i); return m?'S'+Number(m[1]):''; }
  function skillNorm(v){ var s=text(v).toLowerCase(); return s?' '+s:''; }

  function collectEvidence(root){
    var out=[];
    function walk(v,depth){
      if(depth>8||v==null)return;
      if(Array.isArray(v)){v.forEach(function(x){walk(x,depth+1);});return;}
      if(typeof v!=='object')return;
      var id=v.rawEvidenceId||v.evidenceId||v.attemptId||v.resultId||'';
      var skill=v.skill||v.skillName||'';
      var session=v.sessionId||v.routeId||v.session||'';
      if(id&&skill) out.push({id:String(id),skill:text(skill),session:text(session),score:Number(v.score||v.latestScore||0),passed:v.passed!==false,at:v.at||v.occurredAt||v.updatedAt||''});
      Object.keys(v).forEach(function(k){ if(k!=='rawJson'&&k!=='teacherReviewJson') walk(v[k],depth+1); });
    }
    walk(root,0);
    var seen={}; return out.filter(function(x){if(seen[x.id])return false;seen[x.id]=1;return true;});
  }

  function engine(){ return window.EAPSessionUltimateEngine||null; }
  function currentRun(sid){ var e=engine(); return e&&e.current?e.current(sid):null; }
  function activeTask(run){
    if(!run||!Array.isArray(run.plan))return null;
    return run.plan.find(function(t){return (run.completedTaskIds||[]).indexOf(t.taskId)<0;})||null;
  }

  function ensureRun(sid){
    var e=engine(); if(!e)return null;
    var run=e.current(sid);
    if(!run||run.status==='complete') run=e.beginRun(sid,{forceNew:!run||run.status==='complete'});
    var state=readRunner();
    if(!state[sid]||state[sid].runId!==run.runId){
      state[sid]={runId:run.runId,startedAt:new Date().toISOString(),briefDone:false,reflectionText:'',lastEvidenceId:''};
      writeRunner(state);
      baselineIds={}; collectEvidence(readProgress()).forEach(function(x){baselineIds[x.id]=1;});
    }
    return run;
  }

  function completeBriefIfNeeded(sid,run){
    var state=readRunner(), rec=state[sid]||{};
    var task=activeTask(run);
    if(task&&task.stage==='Brief'&&!rec.briefDone){
      rec.briefDone=true; state[sid]=rec; writeRunner(state);
      return engine().completeTask(sid,task.taskId,{correct:true,brief:true});
    }
    return run;
  }

  function launchTask(sid,task){
    if(!task)return;
    if(task.stage==='Reflection'){ renderReflection(sid); return; }
    var raw=Number(String(sid).replace(/\D/g,''));
    if(window.EAPHero&&typeof window.EAPHero.openSkillMission==='function'){
      window.EAPPhaseAActiveTask={version:VERSION,sessionId:sid,taskId:task.taskId,stage:task.stage,skill:task.skill,role:task.role,pressure:task.pressure};
      window.dispatchEvent(new CustomEvent('eap:phase-a-task-launch',{detail:window.EAPPhaseAActiveTask}));
      window.EAPHero.openSkillMission(raw,task.skill);
    }
  }

  function renderReflection(sid){
    var app=document.getElementById('app'),run=currentRun(sid),task=activeTask(run); if(!app||!task)return;
    app.innerHTML='<main class="wrap" style="max-width:950px;margin:auto;padding:20px"><section class="panel"><div class="badges"><span class="pill">Phase A · Reflection</span><span class="pill">'+esc(run.modeLabel)+'</span></div><h2>🪞 Mission Reflection</h2><p class="lead">What did you learn, what evidence helped, and what will you change next time?</p><textarea id="phaseAReflection" rows="6" style="width:100%;padding:14px;border-radius:14px;font:inherit" placeholder="Write 2–4 sentences."></textarea><button class="btn primary" id="phaseASaveReflection" type="button">Save reflection & complete run</button><p id="phaseAReflectionMsg" class="mini-note"></p></section></main>';
    document.getElementById('phaseASaveReflection').onclick=function(){
      var output=text(document.getElementById('phaseAReflection').value);
      if(output.split(/\s+/).filter(Boolean).length<8){document.getElementById('phaseAReflectionMsg').textContent='เขียน reflection อย่างน้อย 8 คำก่อนค่ะ';return;}
      var state=readRunner();state[sid]=state[sid]||{};state[sid].reflectionText=output;writeRunner(state);
      var done=engine().completeTask(sid,task.taskId,{correct:true,reflection:true});
      window.dispatchEvent(new CustomEvent('eap:phase-a-run-complete',{detail:{run:done,reflection:output}}));
      document.getElementById('phaseAReflectionMsg').textContent='✅ Mission run complete · กลับ Map เพื่อดูความคืบหน้า';
      setTimeout(function(){ if(window.EAPHero&&typeof window.EAPHero.showMap==='function')window.EAPHero.showMap(); },900);
    };
  }

  function scanEvidence(){
    var sid=sidFromPage();
    var active=window.EAPPhaseAActiveTask;
    if(!sid&&active)sid=active.sessionId;
    if(!sid||!active||active.sessionId!==sid)return;
    var list=collectEvidence(readProgress());
    var fresh=list.filter(function(x){return !baselineIds[x.id]&&skillNorm(x.skill)===skillNorm(active.skill)&&(!x.session||String(x.session).replace(/^\d+$/,'S$&').toUpperCase()===sid);});
    list.forEach(function(x){baselineIds[x.id]=1;});
    if(!fresh.length)return;
    var ev=fresh[fresh.length-1];
    var signal={correct:ev.passed!==false,accuracy:ev.score||100,responseMs:0,retry:0,hintUsed:false,evidenceId:ev.id};
    engine().recordSignal(sid,signal);
    engine().completeTask(sid,active.taskId,signal);
    var state=readRunner();state[sid]=state[sid]||{};state[sid].lastEvidenceId=ev.id;writeRunner(state);
    window.EAPPhaseAActiveTask=null;
    window.dispatchEvent(new CustomEvent('eap:phase-a-task-complete',{detail:{sessionId:sid,taskId:active.taskId,evidence:ev}}));
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='\n.phase-a2-panel{margin:12px 0;padding:14px;border:1px solid #bae6fd;border-radius:16px;background:linear-gradient(135deg,#f0f9ff,#eef2ff);color:#0f172a}.phase-a2-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.phase-a2-track{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;margin:12px 0}.phase-a2-step{padding:9px;border-radius:12px;background:#fff;border:1px solid #dbeafe;font-size:12px;font-weight:800}.phase-a2-step.on{outline:2px solid #22c55e;background:#f0fdf4}.phase-a2-step.current{outline:3px solid #38bdf8;background:#ecfeff}.phase-a2-progress{height:10px;border-radius:999px;background:#dbeafe;overflow:hidden}.phase-a2-progress i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#06b6d4);transition:width .25s}.phase-a2-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}@media(max-width:700px){.phase-a2-track{grid-template-columns:1fr 1fr}}';document.head.appendChild(s);
  }

  function renderPanel(){
    addStyle();
    var app=document.getElementById('app');if(!app)return;
    var sid=sidFromPage();if(!sid||/Boss Gate|Boss Battle/i.test(text(app.innerText)))return;
    var run=ensureRun(sid);if(!run)return;
    run=completeBriefIfNeeded(sid,run)||run;
    var task=activeTask(run),host=app.querySelector('.session-path-panel,.panel,main section,section');if(!host)return;
    var panel=host.querySelector('.phase-a2-panel');if(!panel){panel=document.createElement('div');panel.className='phase-a2-panel';host.insertBefore(panel,host.firstChild);}
    var completed=(run.completedTaskIds||[]).length,pct=Math.round(completed/Math.max(1,run.taskCount)*100);
    var stage=task?task.stage:'Complete';
    var phases=['Brief','Challenge','Pressure Round','Mini Rescue','Reflection'];
    panel.innerHTML='<div class="phase-a2-head"><div><b>⚡ '+esc(run.modeLabel)+' · '+run.taskCount+' Tasks</b><div class="mini-note">'+esc(run.coreSkills.join(' + '))+' · '+esc(run.adaptiveLevel)+' · Combo '+Number(run.combo||0)+'</div></div><b>'+completed+'/'+run.taskCount+'</b></div><div class="phase-a2-progress"><i style="width:'+pct+'%"></i></div><div class="phase-a2-track">'+phases.map(function(p){var cls=p===stage?'current':(run.plan.filter(function(t){return t.stage===p;}).every(function(t){return run.completedTaskIds.indexOf(t.taskId)>=0;})?'on':'');return '<div class="phase-a2-step '+cls+'">'+esc(p)+'</div>';}).join('')+'</div><div class="phase-a2-actions">'+(task?'<button class="btn primary" type="button" data-phase-a-next>▶ '+esc(task.stage)+' · '+esc(task.skill)+'</button><span class="pill">'+esc(task.role)+(task.required?' · Required':' · Optional')+'</span>':'<span class="pill">✅ Run Complete</span>')+'</div>';
    var btn=panel.querySelector('[data-phase-a-next]');if(btn)btn.onclick=function(){launchTask(sid,task);};
  }

  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(renderPanel,80);}

  window.EAPPhaseAMultiTaskRunner={version:VERSION,ensureRun:ensureRun,activeTask:activeTask,launchTask:launchTask,scanEvidence:scanEvidence,state:readRunner};
  scanTimer=setInterval(scanEvidence,650);
  window.addEventListener('load',schedule);
  window.addEventListener('eap:session-ultimate-task',schedule);
  window.addEventListener('eap:phase-a-task-complete',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
})();