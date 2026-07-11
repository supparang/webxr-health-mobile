/* =========================================================
   EAP Hero Phase B — Dynamic Replay & Adaptive Mission Director v20260711
   B1 Dynamic Mission Generator + B2 Task Composer + B3 Adaptive Challenge
   - Covers S1-S15 normal sessions; Boss B1-B5 stay on Boss Engine.
   - Assigns a fresh authored source/scenario to every Phase A task.
   - Uses no-repeat source/item/prompt/cue history from Phase A engine.
   - Composes encounter types: Evidence Hunt, Main-Idea Scan, Reason Gate,
     Pressure Check, Mini Rescue, Reflection Transfer.
   - Adapts challenge to A2 / A2+ / B1 / B1+ without changing pass marks.
   - Adds replay twists, reward-only tokens, and task metadata for Sheet sync.
   - Does not change academic score, pass/fail, teacher review, or route unlock.
========================================================= */
(function(){
  'use strict';

  var VERSION='v20260711-EAP-PHASE-B-DYNAMIC-REPLAY-V1';
  var STATE_KEY='EAP_PHASE_B_DYNAMIC_REPLAY_V1';
  var STYLE_ID='eap-phase-b-dynamic-replay-style';
  var active=null;

  var ENCOUNTERS={
    Reading:['Main-Idea Scan','Evidence Hunt','Inference Check','Limitation Lens','Source Reliability'],
    Listening:['Signal-Word Radar','Key-Detail Capture','Speaker Purpose','Inference Echo','Listening Rescue'],
    Writing:['Summary Forge','Evidence Link','Audience Shift','Constraint Draft','Revision Rescue'],
    Speaking:['Clarity Strike','Evidence Talk','Audience Shift','Timed Response','Oral Rescue'],
    Reflection:['Reflection Transfer']
  };
  var TWISTS=[
    {id:'audience',label:'Audience Shift',note:'Adapt the response for a new audience.'},
    {id:'constraint',label:'Constraint Lock',note:'Use one clear limit or condition.'},
    {id:'evidence',label:'Evidence First',note:'Name the evidence before the conclusion.'},
    {id:'time',label:'Pressure Clock',note:'Respond efficiently without losing accuracy.'},
    {id:'compare',label:'Compare & Decide',note:'Compare two plausible interpretations.'},
    {id:'transfer',label:'New Context',note:'Transfer the same skill to a fresh context.'}
  ];

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function esc(v){return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}');}catch(_){return{};}}
  function write(v){try{localStorage.setItem(STATE_KEY,JSON.stringify(v||{}));}catch(_){}return v||{};}
  function engine(){return window.EAPSessionUltimateEngine||null;}
  function bank(){return window.EAP_GOLD_AUTHORED_BANK||null;}
  function sid(v){var m=String(v||'').toUpperCase().match(/S?(1[0-5]|[1-9])/);return m?'S'+Number(m[1]):'';}
  function sessionNo(v){return Number(String(sid(v)).replace(/\D/g,''))||0;}
  function hash(s){var h=2166136261;for(var i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}return h>>>0;}
  function pickDeterministic(list,seed){if(!list||!list.length)return null;return list[hash(seed)%list.length];}
  function sourcesFor(sessionId){
    var b=bank(),n=sessionNo(sessionId);
    var rec=b&&b.sessions&&(b.sessions[String(n)]||b.sessions[n]);
    return rec&&Array.isArray(rec.sources)?rec.sources.slice():[];
  }
  function history(sessionId,type){
    var st=engine()&&engine().state?engine().state():{};
    var rec=st.sessions&&st.sessions[sessionId];
    return rec&&rec.histories&&Array.isArray(rec.histories[type])?rec.histories[type].slice():[];
  }
  function freshPick(sessionId,type,pool,getId,seed){
    var hist=history(sessionId,type),fresh=(pool||[]).filter(function(x){return hist.indexOf(String(getId(x)))<0;});
    var candidates=fresh.length?fresh:(pool||[]);
    var chosen=pickDeterministic(candidates,seed);
    if(chosen&&engine()&&engine().remember)engine().remember(sessionId,type,String(getId(chosen)));
    return chosen;
  }
  function levelConfig(level){
    return {
      'A2':{label:'A2 Foundation',time:0,scaffold:2,complexity:1},
      'A2+':{label:'A2+ Bridge',time:0,scaffold:1,complexity:2},
      'B1':{label:'B1 Core',time:45,scaffold:1,complexity:3},
      'B1+':{label:'B1+ Stretch',time:35,scaffold:0,complexity:4}
    }[level]||{label:'A2 Foundation',time:0,scaffold:2,complexity:1};
  }
  function composePrompt(task,source,encounter,twist,level){
    var skill=text(task.skill),title=text(source&&source.title)||'Fresh Source';
    var base={
      Reading:'Read the source and identify the best supported academic response.',
      Listening:'Listen for the central message, one support detail, and the speaker purpose.',
      Writing:'Write a short academic response using the source idea in your own words.',
      Speaking:'Give a clear short response with one relevant detail or example.',
      Reflection:'Explain what strategy worked and what you will change next time.'
    }[skill]||'Complete the academic mission using evidence.';
    return base+' Mission: '+encounter+' · '+title+'. '+(twist?twist.note:'')+' Level: '+levelConfig(level).label+'.';
  }
  function composeTask(sessionId,task,run){
    var sourcePool=sourcesFor(sessionId);
    var seed=[sessionId,run&&run.runId,task.taskId,task.stage,task.skill].join('|');
    var source=freshPick(sessionId,'source',sourcePool,function(x){return x.id;},seed+'|source');
    var encounters=ENCOUNTERS[task.skill]||ENCOUNTERS.Reading;
    var encounter=freshPick(sessionId,'item',encounters.map(function(x,i){return{id:sessionId+'-'+task.skill+'-'+x.replace(/\W+/g,'-').toLowerCase(),label:x,index:i};}),function(x){return x.id;},seed+'|encounter');
    var twist=(run&&run.runNo>1)||task.pressure?freshPick(sessionId,'prompt',TWISTS,function(x){return x.id;},seed+'|twist'):null;
    var level=run&&run.adaptiveLevel||'A2';
    var cfg=levelConfig(level);
    return {
      phaseBVersion:VERSION,
      sessionId:sessionId,runId:run&&run.runId||'',runNo:run&&run.runNo||1,mode:run&&run.mode||'first',
      taskId:task.taskId,taskNo:task.taskNo,stage:task.stage,skill:task.skill,role:task.role,required:task.required!==false,
      encounterId:encounter&&encounter.id||'',encounter:encounter&&encounter.label||'Academic Mission',
      sourceId:source&&source.id||'',sourceTitle:source&&source.title||'',sourcePassage:source&&source.passage||'',
      sourceMain:source&&source.main||'',sourceEvidence:source&&source.evidence||'',sourceInference:source&&source.inference||'',sourceLimitation:source&&source.limitation||'',
      keywords:source&&source.keywords||[],twistId:twist&&twist.id||'',twistLabel:twist&&twist.label||'',
      adaptiveLevel:level,adaptiveLabel:cfg.label,timeLimitSec:(task.pressure?cfg.time:0),scaffoldLevel:cfg.scaffold,complexity:cfg.complexity,
      missionPrompt:composePrompt(task,source,encounter&&encounter.label,twist,level),
      rewardToken:task.role==='exposure'?'Exploration Token':task.pressure?'Pressure Token':'Mission Token',
      generatedAt:new Date().toISOString()
    };
  }
  function prepare(sessionId,task,run){
    sessionId=sid(sessionId);if(!sessionId||!task)return null;
    var st=read(),key=(run&&run.runId||sessionId)+'::'+task.taskId;
    if(!st[key]){st[key]=composeTask(sessionId,task,run||{});write(st);}
    active=clone(st[key]);
    window.EAPPhaseBActiveMission=clone(active);
    window.dispatchEvent(new CustomEvent('eap:phase-b-mission-ready',{detail:clone(active)}));
    return clone(active);
  }
  function current(){return active?clone(active):(window.EAPPhaseBActiveMission?clone(window.EAPPhaseBActiveMission):null);}
  function clear(){active=null;window.EAPPhaseBActiveMission=null;}

  function patchRunner(){
    var r=window.EAPPhaseAMultiTaskRunner;
    if(!r||typeof r.launchTask!=='function'||r.__phaseBPatched)return false;
    var original=r.launchTask;
    r.launchTask=function(sessionId,task){
      var run=engine()&&engine().current?engine().current(sessionId):null;
      var mission=prepare(sessionId,task,run);
      window.EAPPhaseAActiveTask=Object.assign({},window.EAPPhaseAActiveTask||{},mission||{});
      return original.apply(this,arguments);
    };
    r.__phaseBPatched=true;
    return true;
  }
  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='\n.phase-b-mission-card{margin:10px 0 14px;padding:13px 14px;border-radius:15px;border:1px solid rgba(45,212,191,.42);background:linear-gradient(135deg,rgba(8,47,73,.96),rgba(15,118,110,.88));color:#ecfeff;box-shadow:0 12px 28px rgba(2,132,199,.14)}.phase-b-mission-card strong{color:#99f6e4}.phase-b-row{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0}.phase-b-chip{font:800 11px/1.2 system-ui;padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18)}.phase-b-prompt{font-weight:750;line-height:1.45}.phase-b-source{font-size:12px;opacity:.9;margin-top:6px}@media(max-width:700px){.phase-b-mission-card{padding:11px}.phase-b-chip{font-size:10px}}';document.head.appendChild(s);
  }
  function decorate(){
    addStyle();var app=document.getElementById('app'),m=current();if(!app||!m)return;
    if(/Boss Gate|Boss Battle/i.test(text(app.innerText)))return;
    var host=app.querySelector('.phase-a2-panel,.session-path-panel,.panel,main section,section');if(!host)return;
    var card=host.querySelector('.phase-b-mission-card');if(!card){card=document.createElement('div');card.className='phase-b-mission-card';host.insertBefore(card,host.firstChild);}
    card.innerHTML='<div class="phase-b-row"><span class="phase-b-chip">🧠 Phase B</span><span class="phase-b-chip">'+esc(m.encounter)+'</span><span class="phase-b-chip">'+esc(m.adaptiveLabel)+'</span>'+(m.twistLabel?'<span class="phase-b-chip">⚡ '+esc(m.twistLabel)+'</span>':'')+(m.timeLimitSec?'<span class="phase-b-chip">⏱ '+m.timeLimitSec+' sec</span>':'')+'</div><div class="phase-b-prompt">'+esc(m.missionPrompt)+'</div><div class="phase-b-source"><strong>Scenario:</strong> '+esc(m.sourceTitle||'Fresh mission')+' · <strong>Reward:</strong> '+esc(m.rewardToken)+'</div>';
  }
  function schedule(){setTimeout(decorate,80);}

  var wait=setInterval(function(){if(patchRunner())clearInterval(wait);},100);
  window.addEventListener('eap:phase-a-task-launch',function(e){
    var d=e&&e.detail||{},run=engine()&&engine().current?engine().current(d.sessionId):null;
    if(!current()||current().taskId!==d.taskId)prepare(d.sessionId,d,run);
    schedule();
  });
  window.addEventListener('eap:phase-a-task-complete',function(){clear();});
  window.addEventListener('load',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});

  window.EAPPhaseBDynamicReplay={version:VERSION,phase:'B1-B3',prepare:prepare,current:current,composeTask:composeTask,sourcesFor:sourcesFor,state:function(){return clone(read());},clear:clear};
})();