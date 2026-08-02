/* =========================================================
   EAP Hero • Pending Evidence Sync v130
   - Sends every fresh local evidence record not yet cloud-confirmed.
   - Retries queued delivery until player_resume confirms the record.
   - Uses canonical EAP identity.
   - Backend dedupe is protected by deterministic attemptId.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260802-EAP-PENDING-EVIDENCE-SYNC-V130-RETRY-UNTIL-CONFIRMED';
  var WEB_APP_URL='https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var SENT_KEY='EAP_HERO_PENDING_SENT_V130';
  var SUBMISSION_KIND='fresh_evidence_v118';
  var RETRY_MS=12000;
  var inFlight={};
  var timer=0;

  function clean(v){return String(v==null?'':v).trim();}
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function number(v,f){var n=Number(v);return Number.isFinite(n)?n:(f===undefined?0:f);}
  function normSession(v){var m=clean(v).toUpperCase().match(/(?:SESSION\s*|S)?(1[0-5]|[1-9])/);return m?'S'+Number(m[1]):'';}
  function normSkill(v){var t=clean(v).toLowerCase();return ['Reading','Writing','Listening','Speaking'].find(function(s){return t.indexOf(s.toLowerCase())>=0;})||'';}
  function profile(state){
    var canonical=read(PROFILE_KEY,{})||{};
    var embedded=(state&&(state.profile||state.player))||{};
    return {
      studentId:clean(canonical.studentId||canonical.id||embedded.studentId||embedded.id||(state&&state.studentId)),
      studentName:clean(canonical.studentName||canonical.name||embedded.studentName||embedded.name||(state&&state.studentName)),
      section:clean(canonical.section||embedded.section||(state&&state.section)||'122')||'122'
    };
  }
  function scoreOf(r){return number(r.latestScore!==undefined?r.latestScore:(r.score!==undefined?r.score:(r.bestScore!==undefined?r.bestScore:r.autoScore)),0);}
  function stampOf(r){return clean(r.updatedAt||r.latestAt||r.completedAt||r.clientTimestamp||r.timestamp||r.evidenceId||Date.now());}
  function cloudConfirmed(r){return r&&(r.cloudVerified===true||r.serverVerified===true||r.restoredFromSheet===true||r.sourceAuthority==='sheet'||r.authority==='sheet');}
  function attemptId(p,r){
    var base=['eap','v130',p.studentId,normSession(r.sessionId||r.routeId||r.session),normSkill(r.skill||r.skillName).toLowerCase(),clean(r.evidenceId||stampOf(r))].join('-');
    return base.replace(/[^A-Za-z0-9_-]/g,'').slice(0,220);
  }
  function pendingRows(state){
    return (Array.isArray(state&&state.portfolio)?state.portfolio:[]).filter(function(r){
      if(!r||cloudConfirmed(r))return false;
      if(r.legacyCompletion===true||String(r.legacyCompletion).toUpperCase()==='TRUE')return false;
      return !!normSession(r.sessionId||r.routeId||r.session)&&!!normSkill(r.skill||r.skillName)&&scoreOf(r)>0;
    });
  }
  function payloadFor(p,r){
    var score=scoreOf(r);
    return {
      action:'submit_attempt',submissionKind:SUBMISSION_KIND,
      attemptId:attemptId(p,r),studentId:p.studentId,studentName:p.studentName||'Student',section:p.section,
      sessionId:normSession(r.sessionId||r.routeId||r.session),sessionTitle:clean(r.sessionTitle),
      skill:normSkill(r.skill||r.skillName),score:score,
      accuracy:r.accuracy===''?'':number(r.accuracy!==undefined?r.accuracy:r.bestAccuracy,''),
      passMark:60,passed:score>=60,legacyCompletion:false,
      hintUsed:number(r.aiUses!==undefined?r.aiUses:r.hintUsed,0),replay:r.replay===true,
      clientTimestamp:stampOf(r),sourceUrl:location.href,evidenceId:clean(r.evidenceId),syncVersion:VERSION
    };
  }
  function markQueued(state,r,payload){
    r.pendingSheetSync=true;
    r.sheetDeliveryQueued=true;
    r.sheetAttemptId=payload.attemptId;
    r.sheetQueuedAt=new Date().toISOString();
    state.localPendingSync=true;
    write(STATE_KEY,state);
    try{window.dispatchEvent(new CustomEvent('eap:sheet-delivery-queued',{detail:payload}));}catch(_){ }
  }
  function deliver(state,r,payload,sent){
    var prior=sent[payload.attemptId];
    if(inFlight[payload.attemptId])return;
    if(prior&&Date.now()-Number(prior.queuedAt||0)<RETRY_MS)return;
    inFlight[payload.attemptId]=true;
    var body=JSON.stringify(payload),accepted=false;
    try{if(navigator.sendBeacon)accepted=navigator.sendBeacon(WEB_APP_URL,new Blob([body],{type:'text/plain;charset=UTF-8'}));}catch(_){accepted=false;}
    if(!accepted){
      try{
        fetch(WEB_APP_URL,{method:'POST',mode:'no-cors',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:body})
          .catch(function(){delete inFlight[payload.attemptId];schedule(2500);});
        accepted=true;
      }catch(_){accepted=false;}
    }
    if(accepted){
      sent[payload.attemptId]={queuedAt:Date.now(),sessionId:payload.sessionId,skill:payload.skill,score:payload.score};
      write(SENT_KEY,sent);markQueued(state,r,payload);delete inFlight[payload.attemptId];
      setTimeout(function(){try{window.EAPPlayerResumeStableJSONP&&window.EAPPlayerResumeStableJSONP.request&&window.EAPPlayerResumeStableJSONP.request(true);}catch(_){ }},2200);
    }else delete inFlight[payload.attemptId];
  }
  function sync(){
    var state=read(STATE_KEY,{}),p=profile(state),sent=read(SENT_KEY,{})||{};
    if(!p.studentId||p.studentId==='guest')return false;
    var rows=pendingRows(state);
    rows.forEach(function(r){deliver(state,r,payloadFor(p,r),sent);});
    document.documentElement.dataset.eapPendingEvidenceSyncVersion=VERSION;
    return rows.length>0;
  }
  function schedule(delay){clearTimeout(timer);timer=setTimeout(sync,delay||120);}
  ['load','storage','eap:local-result-saved','eap:progress-truth-updated','eap:profile-saved','eap:cloud-resume-applied','eap:resume-synced'].forEach(function(name){window.addEventListener(name,function(){schedule(100);});});
  new MutationObserver(function(){schedule(180);}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(sync,3000);setTimeout(sync,200);setTimeout(sync,1200);
  window.EAPPendingEvidenceSyncV130={version:VERSION,sync:sync,pending:function(){return pendingRows(read(STATE_KEY,{}));}};
})();
