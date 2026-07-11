/* =========================================================
   EAP Hero Living Mission Director v20260711
   Phase C-F foundation
   - Dynamic encounter modifiers, enemy abilities, reflection prompts,
     reward-only progression, daily/weekly campaign metadata, and mentor hints.
   - Extends Phase B mission metadata and UI for S1-S15.
   - Does NOT change academic score, pass/fail, Sheet receiver, teacher review,
     boss completion, or route unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION='v20260711-EAP-LIVING-MISSION-DIRECTOR-CF1';
  var STATE_KEY='EAP_LIVING_MISSION_DIRECTOR_CF1';
  var STYLE_ID='eap-living-mission-director-style';
  var CARD_ID='eapLivingMissionCard';
  var timer=null;

  var ENEMIES={
    Reading:[
      {id:'detail-spider',name:'Detail Trap Spider',ability:'Detail Web',effect:'Two details look important; choose the one that truly supports the claim.'},
      {id:'claim-phantom',name:'Fake Claim Phantom',ability:'Overclaim Mist',effect:'Reject conclusions that go beyond the source.'},
      {id:'signal-goblin',name:'Signal Word Goblin',ability:'Keyword Swap',effect:'Track contrast, cause, and example signals carefully.'}
    ],
    Listening:[
      {id:'noise-monster',name:'Noise Monster',ability:'Signal Jam',effect:'Hold the main point before collecting details.'},
      {id:'echo-ghost',name:'Echo Ghost',ability:'Purpose Echo',effect:'Separate repeated words from the speaker’s real purpose.'},
      {id:'detail-bat',name:'Detail Bat',ability:'Fast Detail',effect:'Capture one useful detail without losing the central message.'}
    ],
    Writing:[
      {id:'copy-zombie',name:'Copy-Paste Zombie',ability:'Copy Curse',effect:'Use new wording while preserving the source meaning.'},
      {id:'tone-troll',name:'Casual Tone Troll',ability:'Tone Distortion',effect:'Keep the response clear, polite, and academic.'},
      {id:'structure-warden',name:'Structure Maze Warden',ability:'Order Shift',effect:'Connect claim, evidence, explanation, and closing logically.'}
    ],
    Speaking:[
      {id:'nervous-ghost',name:'Nervous Ghost',ability:'Pause Fog',effect:'Use a clear opening, one support point, and a short close.'},
      {id:'question-sphinx',name:'Question Sphinx',ability:'Alignment Test',effect:'Answer the exact mission rather than a nearby topic.'},
      {id:'clarity-slime',name:'Clarity Slime',ability:'Message Blur',effect:'Keep the response focused and easy to follow.'}
    ]
  };

  var MODIFIERS=[
    {id:'evidence-first',label:'Evidence First',icon:'🔎',note:'Identify evidence before selecting or producing the conclusion.',pressure:false},
    {id:'one-chance',label:'One Chance',icon:'🎯',note:'Commit carefully; review the source before submitting.',pressure:true},
    {id:'no-extra-hint',label:'Independent Run',icon:'🧠',note:'Try independently before opening support.',pressure:true},
    {id:'audience-shift',label:'Audience Shift',icon:'👥',note:'Adapt the response for the named audience.',pressure:false},
    {id:'constraint-lock',label:'Constraint Lock',icon:'🔒',note:'Respect one explicit condition while keeping the meaning accurate.',pressure:true},
    {id:'compare-decide',label:'Compare & Decide',icon:'⚖️',note:'Compare two plausible interpretations and choose the better-supported one.',pressure:false}
  ];

  var REFLECTIONS=[
    'Which clue mattered most, and why?',
    'What almost fooled you in this mission?',
    'What strategy helped you stay accurate?',
    'What would you change in your next replay?',
    'Where did evidence improve your answer?',
    'How did the pressure condition affect your decision?'
  ];

  var WEEKLY=['Evidence Week','Vocabulary Week','Critical Reading Week','Academic Writing Week','Presentation Week'];
  var DAILY=['No-Hint Rescue','Evidence Hunter','Fast but Careful','One Strong Detail','Clear Academic Message'];

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function esc(v){return text(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}');}catch(_){return{};}}
  function write(v){try{localStorage.setItem(STATE_KEY,JSON.stringify(v||{}));}catch(_){}return v||{};}
  function hash(s){var h=2166136261;for(var i=0;i<String(s).length;i++){h^=String(s).charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}return h>>>0;}
  function pick(list,seed){return list&&list.length?list[hash(seed)%list.length]:null;}
  function dayKey(){return new Date().toISOString().slice(0,10);}
  function weekKey(){var d=new Date(),onejan=new Date(d.getFullYear(),0,1);return d.getFullYear()+'-W'+Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);}
  function phaseB(){return window.EAPPhaseBDynamicReplay||null;}
  function currentMission(){var b=phaseB();return b&&b.current?b.current():(window.EAPPhaseBActiveMission||null);}

  function historyList(state,key){state.history=state.history||{};state.history[key]=Array.isArray(state.history[key])?state.history[key]:[];return state.history[key];}
  function chooseFresh(list,state,key,seed,windowSize){
    var history=historyList(state,key),fresh=list.filter(function(x){return history.indexOf(x.id)<0;}),chosen=pick(fresh.length?fresh:list,seed);
    if(chosen){history.push(chosen.id);state.history[key]=history.slice(-(windowSize||6));}
    return chosen;
  }

  function skillOf(m){var s=text(m&&m.skill);return ENEMIES[s]?s:'Reading';}
  function buildLiving(m){
    if(!m)return null;
    var state=read(),seed=[m.runId,m.taskId,m.sourceId,m.encounter,m.adaptiveLevel].join('|'),skill=skillOf(m);
    var enemy=chooseFresh(ENEMIES[skill],state,'enemy-'+skill,seed+'|enemy',5);
    var modifier=chooseFresh(MODIFIERS,state,'modifier-'+skill,seed+'|modifier',6);
    var reflection=pick(REFLECTIONS,seed+'|reflection');
    var day=pick(DAILY,dayKey()),week=pick(WEEKLY,weekKey());
    var tokens=Number(state.tokens||0),reputation=Number(state.reputation||0);
    var living={
      livingDirectorVersion:VERSION,
      enemyId:enemy&&enemy.id||'',enemyName:enemy&&enemy.name||'',enemyAbility:enemy&&enemy.ability||'',enemyEffect:enemy&&enemy.effect||'',
      modifierId:modifier&&modifier.id||'',modifierLabel:modifier&&modifier.label||'',modifierIcon:modifier&&modifier.icon||'',modifierNote:modifier&&modifier.note||'',
      pressureActive:!!(modifier&&modifier.pressure)||!!m.timeLimitSec,
      reflectionPrompt:reflection,dailyChallenge:day,weeklyCampaign:week,
      mentorMode:m.adaptiveLevel==='B1+'?'Independent':m.adaptiveLevel==='B1'?'Coach':'Guided',
      mentorMessage:m.adaptiveLevel==='B1+'?'No direct answer: justify your choice with evidence.':m.adaptiveLevel==='B1'?'Try first, then check one clue.':'Use the source title, one keyword, and one support detail.',
      rewardPreview:m.role==='exposure'?'Exploration Token':m.pressure?'Pressure Token':'Mission Token',
      tokenBalance:tokens,reputation:reputation,
      generatedAt:new Date().toISOString()
    };
    state.activeByTask=state.activeByTask||{};state.activeByTask[(m.runId||'run')+'::'+m.taskId]=living;write(state);
    return living;
  }

  function activeLiving(m){
    if(!m)return null;var state=read(),key=(m.runId||'run')+'::'+m.taskId;
    return state.activeByTask&&state.activeByTask[key]?clone(state.activeByTask[key]):buildLiving(m);
  }

  function award(detail){
    var state=read(),m=detail&&detail.mission||currentMission();if(!m)return;
    var key=(m.runId||'run')+'::'+m.taskId;if(state.awarded&&state.awarded[key])return;
    state.awarded=state.awarded||{};state.awarded[key]=new Date().toISOString();
    state.tokens=Number(state.tokens||0)+1;state.reputation=Math.min(100,Number(state.reputation||0)+1);
    state.completed=Number(state.completed||0)+1;write(state);
    window.dispatchEvent(new CustomEvent('eap:living-reward',{detail:{taskId:m.taskId,tokens:state.tokens,reputation:state.reputation}}));
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;s.textContent='\n#'+CARD_ID+'{margin:10px 0 16px;padding:14px;border-radius:16px;border:1px solid rgba(167,139,250,.48);background:linear-gradient(135deg,#312e81,#581c87 58%,#0f766e);color:#fff;box-shadow:0 14px 32px rgba(49,46,129,.25)}#'+CARD_ID+' .lm-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}#'+CARD_ID+' .lm-tags{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}#'+CARD_ID+' .lm-tag{padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.2);font:800 11px/1.2 system-ui}#'+CARD_ID+' .lm-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}#'+CARD_ID+' .lm-box{padding:10px;border-radius:12px;background:rgba(15,23,42,.35);border:1px solid rgba(255,255,255,.15);font-size:12px;line-height:1.4}#'+CARD_ID+' strong{color:#fde68a}@media(max-width:700px){#'+CARD_ID+' .lm-grid{grid-template-columns:1fr}}';document.head.appendChild(s);
  }

  function decorate(){
    addStyle();var app=document.getElementById('app'),m=currentMission();if(!app||!m||/Boss Gate|Boss Battle/i.test(text(app.innerText)))return;
    var living=activeLiving(m),host=app.querySelector('.phase-b-mission-card,.phase-a2-panel,.session-path-panel,.panel,main section,section');if(!host||!living)return;
    var card=document.getElementById(CARD_ID);if(!card){card=document.createElement('section');card.id=CARD_ID;host.insertAdjacentElement('afterend',card);}
    var state=read();
    card.innerHTML='<div class="lm-head"><b>🌍 Living Mission Director</b><span class="lm-tag">Reputation '+Number(state.reputation||0)+'%</span></div><div class="lm-tags"><span class="lm-tag">👾 '+esc(living.enemyName)+'</span><span class="lm-tag">'+esc(living.modifierIcon)+' '+esc(living.modifierLabel)+'</span><span class="lm-tag">🧭 '+esc(living.mentorMode)+'</span>'+(living.pressureActive?'<span class="lm-tag">🔥 Pressure Active</span>':'')+'</div><div class="lm-grid"><div class="lm-box"><strong>'+esc(living.enemyAbility)+'</strong><br>'+esc(living.enemyEffect)+'</div><div class="lm-box"><strong>Mission condition</strong><br>'+esc(living.modifierNote)+'</div><div class="lm-box"><strong>AI Mentor</strong><br>'+esc(living.mentorMessage)+'</div><div class="lm-box"><strong>After-mission reflection</strong><br>'+esc(living.reflectionPrompt)+'</div></div><div class="lm-tags"><span class="lm-tag">📅 '+esc(living.dailyChallenge)+'</span><span class="lm-tag">🗓 '+esc(living.weeklyCampaign)+'</span><span class="lm-tag">💎 Tokens '+Number(state.tokens||0)+'</span></div>';
  }

  function patchPhaseB(){
    var b=phaseB();if(!b||typeof b.prepare!=='function'||b.__livingPatched)return false;
    var original=b.prepare;b.prepare=function(){var m=original.apply(this,arguments);if(m){var living=activeLiving(m);Object.assign(m,living||{});window.EAPPhaseBActiveMission=clone(m);setTimeout(decorate,50);}return m;};
    b.__livingPatched=true;return true;
  }

  var wait=setInterval(function(){if(patchPhaseB())clearInterval(wait);},100);
  window.addEventListener('eap:phase-b-mission-ready',function(){setTimeout(decorate,50);});
  window.addEventListener('eap:phase-a-task-complete',function(e){award(e&&e.detail||{});setTimeout(decorate,80);});
  window.addEventListener('load',function(){setTimeout(decorate,120);});
  new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(decorate,90);}).observe(document.documentElement,{childList:true,subtree:true});

  window.EAPLivingMissionDirector={version:VERSION,phase:'C-F foundation',current:function(){var m=currentMission();return m?Object.assign({},clone(m),activeLiving(m)||{}):null;},state:function(){return clone(read());},award:award,decorate:decorate};
})();