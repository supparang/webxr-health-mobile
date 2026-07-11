/* =========================================================
   EAP Hero Phase C — Dynamic Encounter Engine v20260711
   C1 Encounter Runtime + C2 Pressure Modifiers + C3 Mini Rescue
   + C4 Enemy Abilities + C5 Reflection Director
   - Covers S1-S15 normal sessions only.
   - Enriches Phase B missions with enemy, modifier, pressure, mini-rescue,
     reflection prompt, and reward-only metadata.
   - Pressure timers are motivational only; they do not auto-fail academic work.
   - Mini Rescue awards cosmetic/replay tokens only and never changes grades.
   - Does not alter score, pass/fail, Sheet sync, teacher review, or unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION='v20260711-EAP-PHASE-C-DYNAMIC-ENCOUNTER-V1';
  var STATE_KEY='EAP_PHASE_C_DYNAMIC_ENCOUNTER_V1';
  var STYLE_ID='eap-phase-c-style';
  var active=null,timerId=null,renderTimer=null;

  var ENEMIES={
    S1:{id:'confusion-slime',name:'Confusion Slime',icon:'🫧',ability:'Goal Fog',effect:'Separate a clear academic goal from a broad promise.'},
    S2:{id:'lazy-word-goblin',name:'Lazy Word Goblin',icon:'👺',ability:'Context Theft',effect:'Recover meaning from context rather than memory alone.'},
    S3:{id:'detail-trap-spider',name:'Detail Trap Spider',icon:'🕷️',ability:'Detail Web',effect:'Ignore attractive details that do not express the central message.'},
    S4:{id:'noise-monster',name:'Noise Monster',icon:'📢',ability:'Signal Jam',effect:'Find the clue word that shows how ideas connect.'},
    S5:{id:'fake-news-phantom',name:'Fake News Phantom',icon:'👻',ability:'Overclaim Mist',effect:'Distinguish a supported claim from an unsupported conclusion.'},
    S6:{id:'copy-paste-zombie',name:'Copy-Paste Zombie',icon:'🧟',ability:'Copy Curse',effect:'Keep meaning while changing wording and structure.'},
    S7:{id:'casual-talk-troll',name:'Casual Talk Troll',icon:'🧌',ability:'Tone Drift',effect:'Replace informal wording with an appropriate academic tone.'},
    S8:{id:'structure-warden',name:'Structure Maze Warden',icon:'🐍',ability:'Order Shift',effect:'Restore topic, support, example, and closing order.'},
    S9:{id:'paragraph-beast',name:'Broken Paragraph Beast',icon:'🐺',ability:'Link Break',effect:'Reconnect ideas with one clear support and logical flow.'},
    S10:{id:'graph-fog-dragon',name:'Graph Fog Dragon',icon:'🐉',ability:'Trend Fog',effect:'Describe visible data without inventing causes.'},
    S11:{id:'rude-mail-gremlin',name:'Rude Mail Gremlin',icon:'👹',ability:'Purpose Blur',effect:'Make the request polite, concise, and easy to act on.'},
    S12:{id:'plagiarism-monster',name:'Plagiarism Monster',icon:'👾',ability:'Credit Drain',effect:'Recognize responsible paraphrase, citation, and AI use.'},
    S13:{id:'lecture-storm',name:'Lecture Storm',icon:'🌪️',ability:'Keyword Scatter',effect:'Capture the main point first and details second.'},
    S14:{id:'nervous-ghost',name:'Nervous Ghost',icon:'👻',ability:'Fluency Freeze',effect:'Deliver one point, one support, and one clear close.'},
    S15:{id:'stagnation-emperor',name:'Stagnation Emperor',icon:'👑',ability:'Integration Lock',effect:'Connect a problem, evidence, limitation, and solution.'}
  };

  var MODIFIERS=[
    {id:'time-attack',label:'Time Attack',icon:'⏱',note:'Work efficiently while protecting accuracy.',pressure:true},
    {id:'evidence-first',label:'Evidence First',icon:'🔎',note:'Identify the evidence before choosing a conclusion.'},
    {id:'no-extra-clue',label:'No Extra Clue',icon:'🚫',note:'Try independently before opening optional support.'},
    {id:'compare-two',label:'Compare Two',icon:'⚖️',note:'Compare two plausible answers and justify the stronger one.'},
    {id:'one-pass',label:'One-Pass Source',icon:'👁️',note:'Read or listen carefully before moving to the response.'},
    {id:'audience-shift',label:'Audience Shift',icon:'🎭',note:'Adapt the response for a different audience.'},
    {id:'constraint-lock',label:'Constraint Lock',icon:'🔒',note:'Follow one extra condition without losing the main message.'},
    {id:'reverse-check',label:'Reverse Check',icon:'↩️',note:'Explain why a tempting option is weaker.'}
  ];

  var REFLECTIONS=[
    'Which clue mattered most in this mission, and why?',
    'What almost fooled you, and how did you correct it?',
    'Which strategy helped you work more accurately?',
    'What will you do differently in the next replay?',
    'Which evidence best supported your response?',
    'Where did you lose time, and how can you improve?',
    'How did the enemy ability change the way you approached the task?',
    'What part of your answer would you revise first?'
  ];

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function esc(v){return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}');}catch(_){return{};}}
  function write(v){try{localStorage.setItem(STATE_KEY,JSON.stringify(v||{}));}catch(_){}return v||{};}
  function hash(s){var h=2166136261;for(var i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}return h>>>0;}
  function pick(list,seed){return list&&list.length?list[hash(seed)%list.length]:null;}
  function sid(v){var m=String(v||'').toUpperCase().match(/S?(1[0-5]|[1-9])/);return m?'S'+Number(m[1]):'';}
  function historyKey(sessionId,type){return sessionId+'::'+type;}
  function remember(sessionId,type,id,limit){var st=read(),k=historyKey(sessionId,type),arr=Array.isArray(st[k])?st[k]:[];arr=arr.filter(function(x){return x!==id;});arr.push(id);st[k]=arr.slice(-Number(limit||6));write(st);}
  function fresh(sessionId,type,pool,getId,seed){var st=read(),hist=st[historyKey(sessionId,type)]||[],available=(pool||[]).filter(function(x){return hist.indexOf(String(getId(x)))<0;});var chosen=pick(available.length?available:pool,seed);if(chosen)remember(sessionId,type,String(getId(chosen)),type==='reflection'?6:5);return chosen;}

  function build(mission){
    if(!mission)return null;
    var sessionId=sid(mission.sessionId),enemy=ENEMIES[sessionId]||ENEMIES.S1;
    var seed=[mission.runId,mission.taskId,mission.sourceId,mission.encounter,mission.stage].join('|');
    var pool=MODIFIERS.filter(function(x){
      if(mission.stage==='Pressure Round')return true;
      if(mission.stage==='Mini Rescue')return x.id!=='one-pass';
      return !x.pressure;
    });
    var modifier=fresh(sessionId,'modifier',pool,function(x){return x.id;},seed+'|modifier');
    var reflection=fresh(sessionId,'reflection',REFLECTIONS.map(function(x,i){return{id:'r'+i,text:x};}),function(x){return x.id;},seed+'|reflection');
    var timeLimit=mission.timeLimitSec||((mission.stage==='Pressure Round'&&modifier&&modifier.pressure)?45:0);
    return {
      phaseCVersion:VERSION,sessionId:sessionId,runId:mission.runId||'',taskId:mission.taskId||'',stage:mission.stage||'',skill:mission.skill||'',
      enemyId:enemy.id,enemyName:enemy.name,enemyIcon:enemy.icon,enemyAbility:enemy.ability,enemyEffect:enemy.effect,
      modifierId:modifier&&modifier.id||'',modifierLabel:modifier&&modifier.label||'',modifierIcon:modifier&&modifier.icon||'',modifierNote:modifier&&modifier.note||'',
      pressureActive:mission.stage==='Pressure Round'||!!(modifier&&modifier.pressure),timeLimitSec:Number(timeLimit||0),
      miniRescue:mission.stage==='Mini Rescue',reflectionPrompt:reflection&&reflection.text||REFLECTIONS[0],
      rewardToken:mission.stage==='Mini Rescue'?'Rescue Fragment':mission.rewardToken||'Mission Token',generatedAt:new Date().toISOString()
    };
  }

  function prepare(mission){
    var data=build(mission);if(!data)return null;
    active=Object.assign({},mission,data);
    window.EAPPhaseCActiveEncounter=clone(active);
    if(window.EAPPhaseBActiveMission)window.EAPPhaseBActiveMission=Object.assign({},window.EAPPhaseBActiveMission,data);
    window.dispatchEvent(new CustomEvent('eap:phase-c-encounter-ready',{detail:clone(active)}));
    startTimer();schedule();return clone(active);
  }
  function current(){return active?clone(active):(window.EAPPhaseCActiveEncounter?clone(window.EAPPhaseCActiveEncounter):null);}
  function clear(){active=null;window.EAPPhaseCActiveEncounter=null;stopTimer();document.querySelectorAll('.phase-c-card,.phase-c-mini').forEach(function(x){x.remove();});}

  function stopTimer(){if(timerId){clearInterval(timerId);timerId=null;}}
  function startTimer(){stopTimer();var m=current();if(!m||!m.pressureActive||!m.timeLimitSec)return;var end=Date.now()+m.timeLimitSec*1000;active.pressureEndsAt=end;timerId=setInterval(function(){if(!active){stopTimer();return;}active.secondsLeft=Math.max(0,Math.ceil((end-Date.now())/1000));render();if(active.secondsLeft<=0){stopTimer();window.dispatchEvent(new CustomEvent('eap:phase-c-pressure-ended',{detail:clone(active)}));}},250);}

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='\n.phase-c-card{margin:10px 0 14px;padding:14px;border-radius:16px;border:1px solid rgba(251,191,36,.48);background:linear-gradient(135deg,#3f1d0b,#7c2d12);color:#fff7ed;box-shadow:0 12px 30px rgba(124,45,18,.22)}.phase-c-top{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.phase-c-enemy{display:flex;gap:9px;align-items:center;font-weight:900}.phase-c-enemy b{font-size:18px}.phase-c-chips{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}.phase-c-chip{padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);font:800 11px/1.2 system-ui}.phase-c-effect{line-height:1.45;font-weight:720}.phase-c-timer{font-size:20px;font-weight:950;color:#fde68a}.phase-c-mini{margin:10px 0;padding:13px;border-radius:14px;background:#fff7ed;border:1px solid #fdba74;color:#7c2d12}.phase-c-mini button{margin-top:8px}.phase-c-mini-grid{display:grid;grid-template-columns:1fr;gap:7px;margin-top:8px}.phase-c-mini-choice{text-align:left;padding:10px 12px;border-radius:10px;border:1px solid #fed7aa;background:#fff;cursor:pointer;font-weight:750}.phase-c-mini-choice:hover{outline:2px solid #fb923c}.phase-c-msg{font-weight:850;margin-top:7px}@media(max-width:700px){.phase-c-card{padding:11px}.phase-c-top{align-items:flex-start}}';document.head.appendChild(s);
  }

  function host(){var app=document.getElementById('app');if(!app)return null;return app.querySelector('.phase-b-mission-card,.phase-a2-panel,.session-path-panel,.panel,main section,section')||app;}
  function render(){
    addStyle();var m=current(),h=host();if(!m||!h||/Boss Gate|Boss Battle/i.test(text(document.getElementById('app')&&document.getElementById('app').innerText)))return;
    var card=document.querySelector('.phase-c-card');if(!card){card=document.createElement('div');card.className='phase-c-card';h.insertAdjacentElement('afterend',card);}
    var left=Number.isFinite(Number(m.secondsLeft))?Number(m.secondsLeft):Number(m.timeLimitSec||0);
    card.innerHTML='<div class="phase-c-top"><div class="phase-c-enemy"><b>'+esc(m.enemyIcon)+'</b><div><div>'+esc(m.enemyName)+'</div><small>'+esc(m.enemyAbility)+'</small></div></div>'+(m.pressureActive?'<div class="phase-c-timer">⏱ '+left+'s</div>':'')+'</div><div class="phase-c-chips"><span class="phase-c-chip">🎮 Phase C</span><span class="phase-c-chip">'+esc(m.modifierIcon+' '+m.modifierLabel)+'</span><span class="phase-c-chip">'+esc(m.stage)+'</span></div><div class="phase-c-effect"><b>Enemy effect:</b> '+esc(m.enemyEffect)+'<br><b>Modifier:</b> '+esc(m.modifierNote)+'</div>';
    if(m.miniRescue)renderMini(m,card);
  }

  function miniChoices(m){
    var source=window.EAPPhaseBActiveMission||m,correct=text(source.sourceEvidence||source.sourceMain||'Use the strongest evidence from the source.');
    var wrong1=text(source.sourceLimitation||'Use a broad conclusion without enough evidence.');
    var wrong2='Choose a related detail even when it does not support the mission.';
    var list=[{t:correct,c:true},{t:wrong1,c:false},{t:wrong2,c:false}];
    return list.sort(function(a,b){return hash(m.taskId+a.t)-hash(m.taskId+b.t);});
  }
  function renderMini(m,card){
    var box=document.querySelector('.phase-c-mini');if(!box){box=document.createElement('div');box.className='phase-c-mini';card.insertAdjacentElement('afterend',box);}
    if(box.dataset.done==='1')return;
    var choices=miniChoices(m);
    box.innerHTML='<b>⚔️ Mini Rescue</b><div>Defeat '+esc(m.enemyName)+' by choosing the strongest support.</div><div class="phase-c-mini-grid">'+choices.map(function(x,i){return '<button type="button" class="phase-c-mini-choice" data-correct="'+(x.c?'1':'0')+'">'+esc(String.fromCharCode(65+i)+'. '+x.t)+'</button>';}).join('')+'</div><div class="phase-c-msg"></div>';
    box.querySelectorAll('.phase-c-mini-choice').forEach(function(btn){btn.onclick=function(){var ok=btn.dataset.correct==='1',msg=box.querySelector('.phase-c-msg');msg.textContent=ok?'✅ Mini Rescue cleared · Rescue Fragment earned':'🛡️ Not yet — compare the claim with the strongest evidence.';if(ok){box.dataset.done='1';box.querySelectorAll('button').forEach(function(b){b.disabled=true;});window.dispatchEvent(new CustomEvent('eap:phase-c-mini-rescue-complete',{detail:{sessionId:m.sessionId,taskId:m.taskId,rewardToken:m.rewardToken}}));}};});
  }

  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(render,80);}
  window.addEventListener('eap:phase-b-mission-ready',function(e){prepare(e&&e.detail);});
  window.addEventListener('eap:phase-a-task-complete',clear);
  window.addEventListener('load',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});

  window.EAPPhaseCDynamicEncounter={version:VERSION,phase:'C1-C5',prepare:prepare,current:current,clear:clear,reflectionPrompt:function(){var m=current();return m&&m.reflectionPrompt||REFLECTIONS[0];},state:function(){return clone(read());}};
})();