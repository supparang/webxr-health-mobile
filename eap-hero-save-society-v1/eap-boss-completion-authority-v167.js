/* =========================================================
   EAP Hero • Boss Completion Authority v167
   Single owner for Boss Gate completion delivery.

   Contract
   - Google Sheet / player_resume is the only progression authority.
   - Never advances B1-B5 locally.
   - Sends exactly four integrated skill completion rows through the
     trusted submit_attempt GET transport used by the core game.
   - One verification refresh after delivery; one bounded retry only.
   - Can repair a recent real Single-Run completion after reload by using
     state.lastBossSingleRun written by the Boss Single-Run Finalizer.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_BOSS_COMPLETION_AUTHORITY_V167__) return;
  window.__EAP_BOSS_COMPLETION_AUTHORITY_V167__=true;

  var VERSION='20260811-EAP-BOSS-COMPLETION-AUTHORITY-V167';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var PENDING_KEY='EAP_BOSS_COMPLETION_AUTHORITY_V167_PENDING';
  var SKILLS=['Reading','Listening','Writing','Speaking'];
  var NEXT={B1:'S4',B2:'S7',B3:'S10',B4:'S13',B5:'B5'};
  var activeJob=null;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}}
  function now(){return new Date().toISOString();}
  function endpoint(){return text((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');}
  function state(){return read(STATE_KEY,{})||{};}
  function profile(){
    var s=state(),a=read(ACTIVE_KEY,{})||{},p=read(PROFILE_KEY,{})||{};
    var x=Object.assign({},s.profile||{},s.player||{},p||{},a||{});
    return {
      studentId:text(x.studentId||x.id||s.studentId||s.id),
      studentName:text(x.studentName||x.name||s.studentName||s.name||s.playerName||'Student'),
      section:text(x.section||s.section||(window.EAP_SHEET_CONFIG||{}).section||'122')||'122'
    };
  }
  function route(v){
    var r=text(v).toUpperCase();
    var m=r.match(/^B(?:OSS\s*GATE)?\s*0?([1-5])$/i);if(m)return 'B'+Number(m[1]);
    m=r.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);if(m)return 'S'+Number(m[1]);
    return r;
  }
  function currentServerRoute(){
    try{
      if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.currentRoute==='function'){
        var r=route(window.EAPAuthorityRuntime.currentRoute());if(r)return r;
      }
    }catch(_){}
    var s=state(),sr=s.serverResume||{};
    return route(sr.currentRoute||sr.currentCloudRoute||s.currentCloudRoute||'');
  }
  function pageText(){var root=document.getElementById('app')||document.body;return text(root&&root.innerText||'');}
  function gateFrom(v){
    var s=text(v),m=s.match(/\bB([1-5])\s*(?:Boss\s*Gate|Gate)?\b/i)||s.match(/Boss\s*Gate\s*([1-5])/i);
    return m?'B'+Number(m[1]):'';
  }
  function title(g){return ({B1:'Boss Gate 1: Academic Foundations',B2:'Boss Gate 2: Reading, Listening and Summary',B3:'Boss Gate 3: Academic Writing Control',B4:'Boss Gate 4: Academic Communication and Ethics',B5:'Boss Gate 5: Final Academic Mission'})[g]||g;}
  function recentSingleRun(){
    var x=state().lastBossSingleRun||{};
    var g=route(x.gate||'');
    var t=new Date(text(x.at||'')).getTime();
    if(!/^B[1-5]$/.test(g)||!isFinite(t)||Date.now()-t>6*60*60*1000)return null;
    return {gate:g,at:text(x.at),nextRoute:route(x.nextRoute||NEXT[g]),source:'lastBossSingleRun'};
  }
  function visibleCompletion(){
    var body=pageText();
    if(!/Boss\s+Defeated!/i.test(body))return null;
    var g=gateFrom(body)||route(currentServerRoute());
    if(!/^B[1-5]$/.test(g))return null;
    return {gate:g,at:now(),nextRoute:NEXT[g],source:'boss-defeated-visible'};
  }
  function completionEvidence(){return visibleCompletion()||recentSingleRun();}
  function scoreFromPage(){
    var m=pageText().match(/(\d{1,3})%\s*Accuracy/i);
    if(m)return Math.max(0,Math.min(100,Number(m[1])));
    return 100; // Single-Run Finalizer currently declares 100% only after successful completion.
  }
  function attempt(job,skill){
    var p=profile(),score=job.score,token=String(job.at||'').replace(/[^0-9A-Za-z]/g,'').slice(-20)||'complete';
    return {
      action:'submit_attempt',submissionKind:'fresh_evidence_v118',bridgeVersion:'boss-v167',
      attemptId:'boss-authority-v167-'+p.studentId+'-'+job.gate+'-'+skill.toLowerCase()+'-'+token,
      studentId:p.studentId,studentName:p.studentName,section:p.section,
      course:'EAP Hero: Save the Society',routeId:job.gate,routeType:'boss_gate',
      sessionId:job.gate,sessionTitle:title(job.gate),routeTitle:title(job.gate),
      skill:skill,skillRole:'Integrated',score:score,accuracy:score,passMark:60,
      passed:true,completed:true,complete:true,bossWin:true,bossGateComplete:true,
      legacyCompletion:false,teacherReviewRequired:false,teacherReviewStatus:'',
      hintUsed:0,replay:false,clientTimestamp:now(),sourceUrl:location.href,
      bossCompletionSyncVersion:VERSION
    };
  }
  function sendTrustedGet(a,delay){
    setTimeout(function(){
      var ep=endpoint();if(!ep)return;
      try{
        var u=new URL(ep,location.href);
        Object.keys(a).forEach(function(k){u.searchParams.set(k,String(a[k]));});
        u.searchParams.set('_v',VERSION);u.searchParams.set('_ts',String(Date.now()));
        /* eap-sheet-transport-v124 intercepts this submit_attempt URL and
           forwards it with the receiver trust marker. */
        fetch(u.toString(),{method:'GET',cache:'no-store'}).catch(function(){});
      }catch(_){}
    },delay);
  }
  function refreshOnce(delay){
    setTimeout(function(){
      try{
        if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.refresh==='function'){
          window.EAPAuthorityRuntime.refresh();return;
        }
        if(window.EAPPlayerResumeStableJSONP&&typeof window.EAPPlayerResumeStableJSONP.request==='function'){
          window.EAPPlayerResumeStableJSONP.request(true);
        }
      }catch(_){}
    },delay);
  }
  function confirmed(job){return currentServerRoute()===job.nextRoute;}
  function deliver(ev,allowRetry){
    var p=profile();if(!p.studentId||p.studentId==='guest')return false;
    var official=currentServerRoute();
    if(!/^B[1-5]$/.test(official))return false;
    ev=ev||completionEvidence();if(!ev||ev.gate!==official)return false;
    var sig=p.section+'|'+p.studentId+'|'+ev.gate+'|'+ev.at;
    var pending=read(PENDING_KEY,{})||{};
    if(activeJob&&activeJob.signature===sig)return true;
    activeJob={signature:sig,gate:ev.gate,nextRoute:NEXT[ev.gate],at:ev.at,score:scoreFromPage(),tries:Number(pending.signature===sig?pending.tries:0)||0};
    activeJob.tries+=1;
    write(PENDING_KEY,{signature:sig,gate:activeJob.gate,nextRoute:activeJob.nextRoute,at:activeJob.at,tries:activeJob.tries,studentId:p.studentId,section:p.section,version:VERSION});
    SKILLS.forEach(function(skill,i){sendTrustedGet(attempt(activeJob,skill),i*220);});
    refreshOnce(3000);
    setTimeout(function(){
      if(!activeJob)return;
      if(confirmed(activeJob)){
        write(PENDING_KEY,{confirmed:true,gate:activeJob.gate,nextRoute:activeJob.nextRoute,at:now(),studentId:p.studentId,section:p.section,version:VERSION});
        try{window.dispatchEvent(new CustomEvent('eap:boss-server-confirmed',{detail:{gate:activeJob.gate,nextRoute:activeJob.nextRoute,version:VERSION}}));}catch(_){}
        activeJob=null;return;
      }
      var retryJob=activeJob;activeJob=null;
      if(allowRetry!==false&&retryJob.tries<2){setTimeout(function(){deliver(ev,false);},2500);}
    },6500);
    return true;
  }

  window.addEventListener('eap:boss-defeated-visible',function(e){
    var g=route(e&&e.detail&&e.detail.gate)||gateFrom(pageText());
    if(/^B[1-5]$/.test(g))deliver({gate:g,at:now(),nextRoute:NEXT[g],source:'event'},true);
  });
  window.addEventListener('eap:single-authority-applied',function(){
    if(activeJob&&confirmed(activeJob)){
      write(PENDING_KEY,{confirmed:true,gate:activeJob.gate,nextRoute:activeJob.nextRoute,at:now(),version:VERSION});
      activeJob=null;
    }
  });
  window.addEventListener('load',function(){setTimeout(function(){deliver(completionEvidence(),true);},800);});
  setTimeout(function(){deliver(completionEvidence(),true);},1200);

  window.EAPBossCompletionAuthorityV167={
    version:VERSION,
    repair:function(){activeJob=null;return deliver(completionEvidence(),true);},
    diagnostics:function(){return {version:VERSION,serverRoute:currentServerRoute(),profile:profile(),evidence:completionEvidence(),pending:read(PENDING_KEY,{}),activeJob:activeJob};}
  };
})();
