/* =========================================================
   EAP Hero Phase A2 — Multi-Task Session Runner v20260711
   Phase A integration v2
   - Uses EAPSessionUltimateEngine A1 plan for S1-S15.
   - First 8 / Replay 11 / Elite 13 tasks.
   - Mission arc UI: Brief -> Challenge -> Pressure -> Mini Rescue -> Reflection.
   - Existing skill missions remain the task executors; this runner sequences them.
   - New evidence automatically completes the matching active task.
   - Exposure tasks are optional and never block the original unlock contract.
   - Integrates with Mission-First v1z99: upgrades the old 3-step briefing,
     shows Phase A progress inside skill missions, and skips duplicate skill briefs.
   - Does not change scoring, pass marks, Sheet sync, teacher review, or route unlock.
========================================================= */
(function(){
  'use strict';

  var VERSION='v20260711-EAP-PHASE-A2-MULTITASK-RUNNER-V2-INTEGRATED';
  var RUNNER_KEY='EAP_PHASE_A2_RUNNER_V1';
  var STYLE_ID='eap-phase-a2-runner-style';
  var scanTimer=null, renderTimer=null, baselineIds={};

  function text(v){ return String(v==null?'':v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function readRunner(){ try{return JSON.parse(localStorage.getItem(RUNNER_KEY)||'{}');}catch(_){return{};} }
  function writeRunner(v){ try{localStorage.setItem(RUNNER_KEY,JSON.stringify(v||{}));}catch(_){} return v||{}; }
  function readProgress(){ try{return JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');}catch(_){return{};} }
  function sidFromPage(){ var m=text(document.getElementById('app')&&document.getElementById('app').innerText).match(/(?:Session\s*|Week\s*|\bS)(1[0-5]|[1-9])\b/i); return m?'S'+Number(m[1]):''; }
  function skillNorm(v){ return text(v).toLowerCase(); }

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
      window.EAPPhaseAAutoStartSkill=true;
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
    window.EAPPhaseAAutoStartSkill=false;
    window.dispatchEvent(new CustomEvent('eap:phase-a-task-complete',{detail:{sessionId:sid,taskId:active.taskId,evidence:ev}}));
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='\n.phase-a2-panel{margin:12px 0;padding:14px;border:1px solid #bae6fd;border-radius:16px;background:linear-gradient(135deg,#f0f9ff,#eef2ff);color:#0f172a}.phase-a2-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.phase-a2-track{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:8px;margin:12px 0}.phase-a2-step{padding:9px;border-radius:12px;background:#fff;border:1px solid #dbeafe;font-size:12px;font-weight:800}.phase-a2-step.on{outline:2px solid #22c55e;background:#f0fdf4}.phase-a2-step.current{outline:3px solid #38bdf8;background:#ecfeff}.phase-a2-progress{height:10px;border-radius:999px;background:#dbeafe;overflow:hidden}.phase-a2-progress i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#06b6d4);transition:width .25s}.phase-a2-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.phase-a-mission-strip{margin:10px 0 14px;padding:10px 12px;border-radius:14px;border:1px solid rgba(103,232,249,.45);background:linear-gradient(90deg,rgba(8,47,73,.96),rgba(22,78,99,.96));color:#ecfeff;box-shadow:0 10px 24px rgba(2,132,199,.12)}.phase-a-mission-strip b{color:#a7f3d0}.phase-a-mission-strip .phase-a-mini-bar{height:7px;margin-top:8px;border-radius:999px;background:rgba(255,255,255,.18);overflow:hidden}.phase-a-mission-strip .phase-a-mini-bar i{display:block;height:100%;background:linear-gradient(90deg,#67e8f9,#86efac)}.mf-brief-overlay.phase-a-upgraded .mf-brief-steps{grid-template-columns:repeat(5,1fr)}.mf-brief-overlay.phase-a-upgraded .mf-brief-steps div{min-width:0}.mf-brief-overlay.phase-a-upgraded .mf-brief-card{max-width:720px}@media(max-width:700px){.phase-a2-track{grid-template-columns:1fr 1fr}.mf-brief-overlay.phase-a-upgraded .mf-brief-steps{grid-template-columns:1fr 1fr}}';document.head.appendChild(s);
  }

  function upgradeMissionFirstBrief(){
    var overlay=document.querySelector('.mf-brief-overlay'); if(!overlay)return;
    var body=text(overlay.innerText);
    var sid=sidFromPage() || (window.EAPPhaseAActiveTask&&window.EAPPhaseAActiveTask.sessionId) || 'S1';
    var run=currentRun(sid)||ensureRun(sid); if(!run)return;

    if(/MISSION START/i.test(body)&&window.EAPPhaseAAutoStartSkill&&!overlay.dataset.phaseAAutoStarted){
      overlay.dataset.phaseAAutoStarted='1';
      setTimeout(function(){
        var btn=overlay.querySelector('.mf-btn.primary');
        if(btn){window.EAPPhaseAAutoStartSkill=false;btn.click();}
      },40);
      return;
    }

    if(!/EMERGENCY BRIEFING/i.test(body)||overlay.classList.contains('phase-a-upgraded'))return;
    overlay.classList.add('phase-a-upgraded');
    var kicker=overlay.querySelector('.mf-kicker');
    if(kicker) kicker.textContent='PHASE A · '+run.modeLabel.toUpperCase()+' · '+run.taskCount+' TASKS';
    var objective=overlay.querySelector('.mf-objective div p');
    if(objective) objective.textContent=run.coreSkills.join(' + ')+' · Adaptive '+run.adaptiveLevel+' · Complete the mission arc, not only one skill.';
    var steps=overlay.querySelector('.mf-brief-steps');
    if(steps) steps.innerHTML='<div><b>1</b><span>Brief</span></div><div><b>2</b><span>Challenge</span></div><div><b>3</b><span>Pressure</span></div><div><b>4</b><span>Mini Rescue</span></div><div><b>5</b><span>Reflection</span></div>';
    var primary=overlay.querySelector('.mf-btn.primary');
    if(primary) primary.textContent='Start '+run.modeLabel+' · '+run.taskCount+' Tasks →';
  }

  function renderMissionStrip(){
    var app=document.getElementById('app'); if(!app)return;
    var sid=sidFromPage() || (window.EAPPhaseAActiveTask&&window.EAPPhaseAActiveTask.sessionId); if(!sid)return;
    if(/Boss Gate|Boss Battle/i.test(text(app.innerText)))return;
    var run=currentRun(sid); if(!run)return;
    var task=activeTask(run),completed=(run.completedTaskIds||[]).length,pct=Math.round(completed/Math.max(1,run.taskCount)*100);
    var host=app.querySelector('.mf-hud')||app.querySelector('main section,section.panel,section'); if(!host)return;
    var strip=app.querySelector('.phase-a-mission-strip');
    if(!strip){strip=document.createElement('div');strip.className='phase-a-mission-strip';host.insertAdjacentElement('afterend',strip);}
    strip.innerHTML='<b>⚡ '+esc(run.modeLabel)+' · '+completed+'/'+run.taskCount+'</b> · '+esc(run.adaptiveLevel)+' · Combo '+Number(run.combo||0)+'<br><span>'+(task?'Next: '+esc(task.stage)+' · '+esc(task.skill)+' · '+esc(task.role):'✅ Run complete')+'</span><div class="phase-a-mini-bar"><i style="width:'+pct+'%"></i></div>';
  }

  function renderPanel(){
    addStyle();
    upgradeMissionFirstBrief();
    renderMissionStrip();
    var app=document.getElementById('app');if(!app)return;
    var sid=sidFromPage();if(!sid||/Boss Gate|Boss Battle/i.test(text(app.innerText)))return;
    var run=ensureRun(sid);if(!run)return;
    run=completeBriefIfNeeded(sid,run)||run;
    var task=activeTask(run),host=app.querySelector('.session-path-panel,.panel,main section,section');if(!host)return;
    if(!app.querySelector('.session-path-panel'))return;
    var panel=host.querySelector('.phase-a2-panel');if(!panel){panel=document.createElement('div');panel.className='phase-a2-panel';host.insertBefore(panel,host.firstChild);}
    var completed=(run.completedTaskIds||[]).length,pct=Math.round(completed/Math.max(1,run.taskCount)*100);
    var stage=task?task.stage:'Complete';
    var phases=['Brief','Challenge','Pressure Round','Mini Rescue','Reflection'];
    panel.innerHTML='<div class="phase-a2-head"><div><b>⚡ '+esc(run.modeLabel)+' · '+run.taskCount+' Tasks</b><div class="mini-note">'+esc(run.coreSkills.join(' + '))+' · '+esc(run.adaptiveLevel)+' · Combo '+Number(run.combo||0)+'</div></div><b>'+completed+'/'+run.taskCount+'</b></div><div class="phase-a2-progress"><i style="width:'+pct+'%"></i></div><div class="phase-a2-track">'+phases.map(function(p){var tasks=run.plan.filter(function(t){return t.stage===p;});var cls=p===stage?'current':(tasks.length&&tasks.every(function(t){return run.completedTaskIds.indexOf(t.taskId)>=0;})?'on':'');return '<div class="phase-a2-step '+cls+'">'+esc(p)+'</div>';}).join('')+'</div><div class="phase-a2-actions">'+(task?'<button class="btn primary" type="button" data-phase-a-next>▶ '+esc(task.stage)+' · '+esc(task.skill)+'</button><span class="pill">'+esc(task.role)+(task.required?' · Required':' · Optional')+'</span>':'<span class="pill">✅ Run Complete</span>')+'</div>';
    var btn=panel.querySelector('[data-phase-a-next]');if(btn)btn.onclick=function(){launchTask(sid,task);};
  }

  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(renderPanel,80);}

  window.EAPPhaseAMultiTaskRunner={version:VERSION,ensureRun:ensureRun,activeTask:activeTask,launchTask:launchTask,scanEvidence:scanEvidence,state:readRunner};
  window.EAP_PHASE_A_ACTIVE=true;
  scanTimer=setInterval(scanEvidence,650);
  window.addEventListener('load',schedule);
  window.addEventListener('eap:session-ultimate-task',schedule);
  window.addEventListener('eap:phase-a-task-complete',schedule);
  window.addEventListener('eap:phase-a-task-launch',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
})();