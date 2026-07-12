/* =========================================================
   EAP Hero Phase A2 — Multi-Task Session Runner v20260712
   V5 PAGE-LIFECYCLE SAFE
   - First 8 / Replay 11 / Elite 13 tasks.
   - Brief -> Challenge -> Pressure -> Mini Rescue -> Reflection.
   - Existing skill missions execute each task.
   - Evidence completes only the active matching task.
   - Exposure remains optional and never changes unlock rules.
   - Progress panel appears ONLY inside a real Skill Mission.
   - Lobby / Map / Profile / Report never show or advance task UI.
   - Academic run progress is preserved; transient gameplay state is cleared safely.
========================================================= */
(function(){
  'use strict';
  var VERSION='v20260712-EAP-PHASE-A2-V5-PAGE-LIFECYCLE-SAFE';
  var RUNNER_KEY='EAP_PHASE_A2_RUNNER_V1';
  var STYLE_ID='eap-phase-a2-runner-style';
  var PANEL_ID='phaseA2MissionPanel';
  var baselineIds={}, renderTimer=null;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function esc(v){return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function readRunner(){try{return JSON.parse(localStorage.getItem(RUNNER_KEY)||'{}');}catch(_){return{};}}
  function writeRunner(v){try{localStorage.setItem(RUNNER_KEY,JSON.stringify(v||{}));}catch(_){}return v||{};}
  function readProgress(){try{return JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');}catch(_){return{};}}
  function engine(){return window.EAPSessionUltimateEngine||null;}
  function app(){return document.getElementById('app');}
  function appText(){var a=app();return text(a&&a.innerText);}
  function skillNorm(v){return text(v).toLowerCase();}

  function pageMode(){
    var a=app(),t=appText();
    if(!a)return 'none';
    if(/Boss Gate|Boss Battle|Reason Gate/i.test(t))return 'boss';
    if(/ตั้งค่าผู้เรียน|ย้ายเครื่อง|Academic Hero Profile|Player Name|Student ID/i.test(t)&&a.querySelector('input'))return 'profile';
    if(/My Learning Report|Recent Portfolio|Routes completed/i.test(t))return 'report';
    if(/STUDENT LOBBY|Start\s*\/\s*Continue|เปลี่ยนผู้เรียน\s*\/\s*ย้ายเครื่อง/i.test(t))return 'lobby';
    if(/Learning Route|Boss Gate 1: Foundation Check|SESSION 15/i.test(t)&&a.querySelectorAll('[class*="session"],button').length>5)return 'map';
    var title=[].slice.call(a.querySelectorAll('h1,h2')).find(function(el){return /^(?:📖\s*)?(Reading|Writing|Listening|Speaking)\s+Mission\b/i.test(text(el.textContent));});
    if(title&&a.querySelector('textarea,input,select,button'))return 'skill';
    if(/Session\s*(1[0-5]|[1-9])\s*:/i.test(t)&&/Core Mission|Support Mission|Pass progress/i.test(t))return 'session';
    if(/Evidence Saved|Auto Score|Portfolio summaries|Mission Task Score/i.test(t))return 'result';
    return 'other';
  }

  function sidFromPage(){
    var mode=pageMode();
    if(mode==='skill'){
      var active=window.EAPPhaseAActiveTask;
      if(active&&active.sessionId)return String(active.sessionId).toUpperCase();
    }
    var a=app();
    var m=text(a&&a.innerText).match(/(?:Session\s*|Week\s*|\bS)(1[0-5]|[1-9])\b/i);
    return m?'S'+Number(m[1]):'';
  }

  function collectEvidence(root){
    var out=[];
    function walk(v,d){
      if(d>8||v==null)return;
      if(Array.isArray(v)){v.forEach(function(x){walk(x,d+1);});return;}
      if(typeof v!=='object')return;
      var id=v.rawEvidenceId||v.evidenceId||v.attemptId||v.resultId||'';
      var skill=v.skill||v.skillName||'';
      var session=v.sessionId||v.routeId||v.session||'';
      if(id&&skill)out.push({id:String(id),skill:text(skill),session:text(session),score:Number(v.score||v.latestScore||0),passed:v.passed!==false});
      Object.keys(v).forEach(function(k){if(k!=='rawJson'&&k!=='teacherReviewJson')walk(v[k],d+1);});
    }
    walk(root,0);var seen={};return out.filter(function(x){if(seen[x.id])return false;seen[x.id]=1;return true;});
  }

  function activeTask(run){if(!run||!Array.isArray(run.plan))return null;return run.plan.find(function(t){return (run.completedTaskIds||[]).indexOf(t.taskId)<0;})||null;}
  function ensureRun(sid){
    var e=engine();if(!e)return null;
    var run=e.current(sid);
    if(!run||run.status==='complete')run=e.beginRun(sid,{forceNew:!run||run.status==='complete'});
    var state=readRunner();
    if(!state[sid]||state[sid].runId!==run.runId){
      state[sid]={runId:run.runId,startedAt:new Date().toISOString(),briefDone:false,reflectionText:'',lastEvidenceId:''};
      writeRunner(state);baselineIds={};collectEvidence(readProgress()).forEach(function(x){baselineIds[x.id]=1;});
    }
    return run;
  }
  function completeBrief(sid,run){
    var state=readRunner(),rec=state[sid]||{},task=activeTask(run);
    if(task&&task.stage==='Brief'&&!rec.briefDone){rec.briefDone=true;state[sid]=rec;writeRunner(state);return engine().completeTask(sid,task.taskId,{correct:true,brief:true});}
    return run;
  }

  function clearTransient(reason){
    removePanel();
    var mode=pageMode();
    if(mode==='lobby'||mode==='map'||mode==='profile'||mode==='report'){
      window.EAPPhaseAActiveTask=null;
      window.dispatchEvent(new CustomEvent('eap:phase-a-ui-cleared',{detail:{reason:reason||mode,mode:mode}}));
    }
  }

  function launchTask(sid,task){
    if(!task)return;
    if(task.stage==='Reflection'){renderReflection(sid);return;}
    var raw=Number(String(sid).replace(/\D/g,''));
    if(window.EAPHero&&typeof window.EAPHero.openSkillMission==='function'){
      window.EAPPhaseAActiveTask={version:VERSION,sessionId:sid,taskId:task.taskId,stage:task.stage,skill:task.skill,role:task.role,pressure:task.pressure,launchedAt:Date.now()};
      window.dispatchEvent(new CustomEvent('eap:phase-a-task-launch',{detail:window.EAPPhaseAActiveTask}));
      window.EAPHero.openSkillMission(task.skill,raw);
    }
  }

  function renderReflection(sid){
    var a=app(),run=engine()&&engine().current(sid),task=activeTask(run);if(!a||!task)return;
    a.innerHTML='<main class="wrap" style="max-width:950px;margin:auto;padding:20px"><section class="panel"><div class="badges"><span class="pill">Phase A · Reflection</span><span class="pill">'+esc(run.modeLabel)+'</span></div><h2>🪞 Mission Reflection</h2><p class="lead">What did you learn, what evidence helped, and what will you change next time?</p><textarea id="phaseAReflection" rows="6" style="width:100%;padding:14px;border-radius:14px;font:inherit" placeholder="Write 2–4 sentences."></textarea><button class="btn primary" id="phaseASaveReflection" type="button">Save reflection & complete run</button><p id="phaseAReflectionMsg" class="mini-note"></p></section></main>';
    document.getElementById('phaseASaveReflection').onclick=function(){
      var output=text(document.getElementById('phaseAReflection').value);
      if(output.split(/\s+/).filter(Boolean).length<8){document.getElementById('phaseAReflectionMsg').textContent='เขียน reflection อย่างน้อย 8 คำก่อนค่ะ';return;}
      var state=readRunner();state[sid]=state[sid]||{};state[sid].reflectionText=output;writeRunner(state);
      var done=engine().completeTask(sid,task.taskId,{correct:true,reflection:true});
      window.EAPPhaseAActiveTask=null;
      window.dispatchEvent(new CustomEvent('eap:phase-a-run-complete',{detail:{run:done,reflection:output}}));
      document.getElementById('phaseAReflectionMsg').textContent='✅ Mission run complete';
      setTimeout(function(){if(window.EAPHero&&typeof window.EAPHero.showMap==='function')window.EAPHero.showMap();},900);
    };
  }

  function scanEvidence(){
    var active=window.EAPPhaseAActiveTask;if(!active)return;
    var sid=active.sessionId,list=collectEvidence(readProgress());
    var fresh=list.filter(function(x){var xs=String(x.session||'').replace(/^\d+$/,'S$&').toUpperCase();return !baselineIds[x.id]&&skillNorm(x.skill)===skillNorm(active.skill)&&(!xs||xs===sid);});
    list.forEach(function(x){baselineIds[x.id]=1;});if(!fresh.length)return;
    var ev=fresh[fresh.length-1],signal={correct:ev.passed!==false,accuracy:ev.score||100,responseMs:0,retry:0,hintUsed:false,evidenceId:ev.id};
    engine().recordSignal(sid,signal);engine().completeTask(sid,active.taskId,signal);
    var state=readRunner();state[sid]=state[sid]||{};state[sid].lastEvidenceId=ev.id;writeRunner(state);
    window.EAPPhaseAActiveTask=null;window.dispatchEvent(new CustomEvent('eap:phase-a-task-complete',{detail:{sessionId:sid,taskId:active.taskId,evidence:ev}}));schedule();
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='.phase-a2-panel{margin:0 0 16px;padding:14px;border:1px solid #67e8f9;border-radius:16px;background:linear-gradient(135deg,#082f49,#172554);color:#ecfeff;box-shadow:0 10px 28px rgba(2,8,23,.24)}.phase-a2-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.phase-a2-track{display:grid;grid-template-columns:repeat(5,minmax(105px,1fr));gap:8px;margin:12px 0}.phase-a2-step{padding:9px;border-radius:12px;background:#1e3a5f;border:1px solid #3b82f6;font-size:12px;font-weight:800}.phase-a2-step.on{outline:2px solid #22c55e;background:#14532d}.phase-a2-step.current{outline:3px solid #22d3ee;background:#164e63}.phase-a2-progress{height:10px;border-radius:999px;background:#334155;overflow:hidden;margin-top:10px}.phase-a2-progress i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#22d3ee);transition:width .25s}.phase-a2-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.mf-brief-steps.phase-a-five{grid-template-columns:repeat(5,1fr)!important}.mf-brief-steps.phase-a-five div{min-width:0!important}@media(max-width:700px){.phase-a2-track,.mf-brief-steps.phase-a-five{grid-template-columns:1fr 1fr!important}}';document.head.appendChild(s);
  }

  function upgradeBrief(){
    var card=document.querySelector('.mf-brief-card');if(!card||card.dataset.phaseA==='1')return;
    var m=text(card.innerText).match(/S(1[0-5]|[1-9])\b/i);var sid=m?'S'+Number(m[1]):sidFromPage();if(!sid)return;
    var run=ensureRun(sid);if(!run)return;card.dataset.phaseA='1';
    var kicker=card.querySelector('.mf-kicker');if(kicker)kicker.textContent='PHASE A · '+String(run.modeLabel||'FIRST MISSION').toUpperCase()+' · '+run.taskCount+' TASKS';
    var steps=card.querySelector('.mf-brief-steps');if(steps){steps.classList.add('phase-a-five');steps.innerHTML='<div><b>1</b><span>Brief</span></div><div><b>2</b><span>Challenge</span></div><div><b>3</b><span>Pressure</span></div><div><b>4</b><span>Mini Rescue</span></div><div><b>5</b><span>Reflection</span></div>';}
    var fine=card.querySelector('.mf-fine');if(fine)fine.textContent='⚡ '+run.taskCount+' tasks · '+text(run.coreSkills&&run.coreSkills.join(' + '))+' · '+text(run.adaptiveLevel)+' · Best score is preserved.';
  }

  function findSkillHost(a){
    var title=[].slice.call(a.querySelectorAll('h1,h2')).find(function(el){return /^(?:📖\s*)?(Reading|Writing|Listening|Speaking)\s+Mission\b/i.test(text(el.textContent));});
    if(title){
      var node=title;
      while(node&&node.parentElement&&node.parentElement!==a){
        if(node.parentElement.querySelector&&node.parentElement.querySelector('button,textarea,input,select'))return node.parentElement;
        node=node.parentElement;
      }
      return title.parentElement||a;
    }
    return null;
  }
  function removePanel(){var p=document.getElementById(PANEL_ID);if(p)p.remove();}

  function renderPanel(){
    addStyle();upgradeBrief();
    var a=app();if(!a)return;
    var mode=pageMode();
    if(mode!=='skill'){clearTransient('page-'+mode);return;}
    var sid=sidFromPage();if(!sid)return;
    var run=ensureRun(sid);if(!run)return;run=completeBrief(sid,run)||run;
    var task=activeTask(run),host=findSkillHost(a);if(!host){removePanel();return;}
    var panel=document.getElementById(PANEL_ID);
    if(!panel){panel=document.createElement('div');panel.id=PANEL_ID;panel.className='phase-a2-panel';}
    if(panel.parentNode!==host){
      var anchor=host.querySelector('h1,h2,.badges');
      if(anchor&&anchor.parentNode===host)host.insertBefore(panel,anchor);else host.insertBefore(panel,host.firstChild);
    }
    var completed=(run.completedTaskIds||[]).length,pct=Math.round(completed/Math.max(1,run.taskCount)*100),stage=task?task.stage:'Complete';
    var phases=['Brief','Challenge','Pressure Round','Mini Rescue','Reflection'];
    panel.innerHTML='<div class="phase-a2-head"><div><b>⚡ '+esc(run.modeLabel)+' · '+run.taskCount+' Tasks</b><div>'+esc((run.coreSkills||[]).join(' + '))+' · '+esc(run.adaptiveLevel)+' · Combo '+Number(run.combo||0)+'</div></div><b>'+completed+'/'+run.taskCount+'</b></div><div class="phase-a2-progress"><i style="width:'+pct+'%"></i></div><div class="phase-a2-track">'+phases.map(function(p){var items=run.plan.filter(function(t){return t.stage===p;}),done=items.length&&items.every(function(t){return run.completedTaskIds.indexOf(t.taskId)>=0;}),cls=p===stage?'current':done?'on':'';return '<div class="phase-a2-step '+cls+'">'+esc(p)+'</div>';}).join('')+'</div><div class="phase-a2-actions">'+(task?'<button class="btn primary" type="button" data-phase-a-next>▶ '+esc(task.stage)+' · '+esc(task.skill)+'</button><span class="pill">'+esc(task.role)+(task.required?' · Required':' · Optional')+'</span>':'<span class="pill">✅ Run Complete</span>')+'</div>';
    var btn=panel.querySelector('[data-phase-a-next]');if(btn)btn.onclick=function(){launchTask(sid,task);};
  }

  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(renderPanel,90);}
  window.EAPPhaseAMultiTaskRunner={version:VERSION,ensureRun:ensureRun,activeTask:activeTask,launchTask:launchTask,scanEvidence:scanEvidence,state:readRunner,pageMode:pageMode,clearTransient:clearTransient};
  setInterval(scanEvidence,650);
  window.addEventListener('load',schedule);
  window.addEventListener('popstate',schedule);
  window.addEventListener('eap:session-ultimate-task',schedule);
  window.addEventListener('eap:phase-a-task-complete',schedule);
  window.addEventListener('eap:phase-a-task-launch',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  schedule();
})();