/* =========================================================
   EAP Hero • Standard Single Boss Run v149
   - Every student Boss entry is one standard run only.
   - Prevents automatic Rematch Remix / Elite Remix escalation.
   - Keeps scenario and item rotation, but fixes the run plan at
     3 Reading + 3 Listening + 1 Writing + 1 Speaking = 8 tasks.
   - Works before the replay-bank wrapper chooses a scenario by
     resetting only its run-count metadata immediately before start.
========================================================= */
(function(){
  'use strict';

  var VERSION='20260722-EAP-BOSS-STANDARD-SINGLE-RUN-V149';
  var RUN_KEY='EAP_BOSS_REPLAY_RUN_COUNT_V40';
  var patchedFn=null;
  var timer=0;

  function gateNo(value){
    var n=Number(String(value||'').replace(/\D/g,''));
    return n>=1&&n<=5?n:1;
  }

  function resetGateRun(gate){
    try{
      var all=JSON.parse(localStorage.getItem(RUN_KEY)||'{}')||{};
      all[String(gate)]=0;
      all[gate]=0;
      localStorage.setItem(RUN_KEY,JSON.stringify(all));
    }catch(_){ }
  }

  function normalizeVisibleLabels(){
    var app=document.getElementById('app');
    if(!app)return;
    var text=String(app.innerText||'');
    if(!/Boss Gate\s*[1-5]/i.test(text))return;

    app.querySelectorAll('.pill').forEach(function(el){
      var value=String(el.textContent||'').trim();
      if(/^(Rematch Remix|Elite Remix|Fallback Run|First Clash)$/i.test(value)){
        el.textContent='Standard Single Run';
      }
      if(/^\d+\s+Tasks$/i.test(value)){
        el.textContent='8 Tasks';
      }
    });
  }

  function patchStart(){
    var hero=window.EAPHero;
    if(!hero||typeof hero.startGateBoss!=='function')return false;
    if(hero.startGateBoss===patchedFn)return true;
    if(hero.startGateBoss.__eap149)return true;

    var original=hero.startGateBoss;
    var wrapped=function(gateId){
      var gate=gateNo(gateId);
      resetGateRun(gate);
      try{ window.EAPBossReplayScenario=null; }catch(_){ }
      var result=original.apply(this,arguments);
      setTimeout(normalizeVisibleLabels,30);
      setTimeout(normalizeVisibleLabels,180);
      return result;
    };
    wrapped.__eap149=true;
    wrapped.__eap149Original=original;
    hero.startGateBoss=wrapped;
    patchedFn=wrapped;
    document.documentElement.dataset.eapBossRunPolicy=VERSION;
    return true;
  }

  function scan(){
    patchStart();
    normalizeVisibleLabels();
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(scan,40);
  }

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',function(){scan();setTimeout(scan,300);setTimeout(scan,1000);});
  setInterval(scan,500);
  scan();
})();