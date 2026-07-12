/* =========================================================
   EAP Hero Living Mission Runtime v20260712
   Phase C-F runtime layer — PAGE-LIFECYCLE SAFE
   - Turns Living Mission metadata into visible gameplay conditions.
   - Countdown HUD, independent-run hint lock, one-chance submit lock,
     pressure feedback, and dynamic reflection cue.
   - Runtime exists ONLY on a real active Skill Mission.
   - Lobby / Map / Profile / Report / Boss always clear timer, HUD and locks.
   - Does not change score, pass/fail, Sheet sync, teacher review,
     boss completion, or route unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION='v20260712-EAP-LIVING-MISSION-RUNTIME-CF3-PAGE-SAFE';
  var STYLE_ID='eap-living-mission-runtime-style';
  var HUD_ID='eapLivingRuntimeHud';
  var timer=null, interval=null, activeKey='', deadline=0, submitted=false;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function director(){return window.EAPLivingMissionDirector||null;}
  function mission(){var d=director();return d&&d.current?d.current():null;}
  function app(){return document.getElementById('app');}
  function runner(){return window.EAPPhaseAMultiTaskRunner||null;}
  function pageMode(){var r=runner();return r&&typeof r.pageMode==='function'?r.pageMode():'other';}
  function keyOf(m){return m?(String(m.runId||'run')+'::'+String(m.taskId||'task')):'';}

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;
    s.textContent='#'+HUD_ID+'{position:sticky;top:8px;z-index:40;margin:8px 0 12px;padding:10px 12px;border-radius:14px;background:linear-gradient(135deg,#7f1d1d,#c2410c);color:#fff;box-shadow:0 10px 26px rgba(127,29,29,.25);display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;font:800 12px/1.25 system-ui}#'+HUD_ID+' .lmrt-time{font-size:18px}#'+HUD_ID+' .lmrt-note{opacity:.92}.eap-living-hint-locked{display:none!important}.eap-living-one-chance-used{opacity:.5!important;pointer-events:none!important}';
    document.head.appendChild(s);
  }

  function isSkillPage(){return pageMode()==='skill';}
  function targetHost(){
    var a=app();if(!a)return null;
    return a.querySelector('.phase-b-mission-card,#eapLivingMissionCard,.phase-a2-panel,.mission-shell,.skill-mission,.panel,main section,section')||null;
  }

  function clearRuntime(){
    clearInterval(interval);interval=null;deadline=0;submitted=false;activeKey='';
    var hud=document.getElementById(HUD_ID);if(hud)hud.remove();
    document.querySelectorAll('.eap-living-hint-locked').forEach(function(el){el.classList.remove('eap-living-hint-locked');});
    document.querySelectorAll('.eap-living-one-chance-used').forEach(function(el){el.classList.remove('eap-living-one-chance-used');});
    document.querySelectorAll('[data-eap-living-one-chance]').forEach(function(el){delete el.dataset.eapLivingOneChance;});
  }

  function lockHints(m){
    var should=m&&m.modifierId==='no-extra-hint'&&isSkillPage();
    document.querySelectorAll('button,a').forEach(function(el){
      var t=text(el.textContent);
      if(/Need a 10-sec clue|AI Mentor|Hint|Clue/i.test(t)&&!/Mission condition|Independent Run/i.test(t))el.classList.toggle('eap-living-hint-locked',!!should);
    });
  }

  function submitButtons(){
    if(!isSkillPage())return [];
    var a=app();if(!a)return [];
    return Array.prototype.slice.call(a.querySelectorAll('button')).filter(function(el){return /Submit|Save Evidence|Finish|Check Answer|บันทึก|ส่งคำตอบ/i.test(text(el.textContent));});
  }

  function installOneChance(m){
    if(!m||m.modifierId!=='one-chance'||!isSkillPage())return;
    submitButtons().forEach(function(btn){
      if(btn.dataset.eapLivingOneChance==='1')return;
      btn.dataset.eapLivingOneChance='1';
      btn.addEventListener('click',function(){
        if(submitted)return;
        submitted=true;
        setTimeout(function(){submitButtons().forEach(function(b){if(b!==btn)b.classList.add('eap-living-one-chance-used');});},40);
      },true);
    });
  }

  function timeLimit(m){
    var n=Number(m&&m.timeLimitSec||0);
    if(n>0)return n;
    if(m&&m.pressureActive)return m.adaptiveLevel==='B1+'?35:m.adaptiveLevel==='B1'?45:60;
    return 0;
  }

  function renderHud(m){
    if(!isSkillPage()){clearRuntime();return;}
    var host=targetHost();if(!host){clearRuntime();return;}
    var limit=timeLimit(m);
    if(!limit){var old=document.getElementById(HUD_ID);if(old)old.remove();return;}
    var hud=document.getElementById(HUD_ID);
    if(!hud){hud=document.createElement('div');hud.id=HUD_ID;host.insertAdjacentElement('afterbegin',hud);}
    if(!deadline)deadline=Date.now()+limit*1000;
    var left=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    hud.innerHTML='<span>🔥 Pressure Mission · '+text(m.modifierLabel||'Timed challenge')+'</span><span class="lmrt-note">Accuracy still matters more than speed.</span><span class="lmrt-time">'+left+'s</span>';
    if(left<=0){clearInterval(interval);interval=null;var note=hud.querySelector('.lmrt-note');if(note)note.textContent='Time reached. Finish carefully; your academic score is not auto-failed.';}
  }

  function applyReflection(m){
    if(!m||!m.reflectionPrompt)return;
    var ta=document.getElementById('phaseAReflection');
    if(ta&&!ta.dataset.eapLivingReflection){
      ta.dataset.eapLivingReflection='1';
      ta.placeholder=m.reflectionPrompt+' Write 2–4 sentences.';
      var lead=ta.parentElement&&ta.parentElement.querySelector('.lead');if(lead)lead.textContent=m.reflectionPrompt;
    }
  }

  function apply(){
    addStyle();
    if(!isSkillPage()){clearRuntime();return;}
    var m=mission();
    if(!m){clearRuntime();return;}
    var k=keyOf(m);
    if(activeKey&&activeKey!==k)clearRuntime();
    activeKey=k;
    lockHints(m);installOneChance(m);applyReflection(m);renderHud(m);
    if(timeLimit(m)>0&&!interval)interval=setInterval(function(){renderHud(m);},250);
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(apply,90);}
  window.addEventListener('eap:phase-b-mission-ready',schedule);
  window.addEventListener('eap:phase-a-task-launch',schedule);
  window.addEventListener('eap:phase-a-task-complete',clearRuntime);
  window.addEventListener('eap:phase-a-ui-cleared',clearRuntime);
  window.addEventListener('load',schedule);
  window.addEventListener('popstate',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});

  window.EAPLivingMissionRuntime={version:VERSION,apply:apply,clear:clearRuntime,current:function(){return mission();}};
  schedule();
})();