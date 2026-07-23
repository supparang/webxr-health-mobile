/* =========================================================
   EAP Hero • Player Resume Late Response Recovery v170
   - One resilient JSONP request for slow Apps Script responses.
   - Uses the same protected __eapCloudResume_ callback namespace.
   - Never deletes the callback or script before the server responds.
   - Applies only the official server response through EAPPlayerResume.
   - Never derives route or unlocks locally.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_PLAYER_RESUME_LATE_RESPONSE_V170__) return;
  window.__EAP_PLAYER_RESUME_LATE_RESPONSE_V170__ = true;

  var VERSION='20260723-EAP-PLAYER-RESUME-LATE-RESPONSE-V170-PERSISTENT-CALLBACK';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var endpoint=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
  var defaultSection=String((window.EAP_SHEET_CONFIG||{}).section||'122');
  var active=false;
  var lastStartedAt=0;
  var sequence=0;
  var activeCallback='';
  var activeScript=null;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return{};}}
  function profile(){
    var p=read(PROFILE_KEY),s=read(STATE_KEY);
    p=p&&typeof p==='object'?p:{};
    s=s&&typeof s==='object'?s:{};
    return {
      studentId:clean(p.studentId||p.id||s.studentId||s.id||''),
      studentName:clean(p.studentName||p.name||s.studentName||s.name||s.playerName||''),
      section:clean(p.section||s.section||defaultSection)||defaultSection
    };
  }
  function valid(p){return !!(p.studentId&&p.studentName&&p.studentId.toLowerCase()!=='guest');}
  function ready(){return !!(window.EAPPlayerResume&&typeof window.EAPPlayerResume.applyCloudResponse==='function');}

  function setDiagnostic(message){
    try {
      var s=read(STATE_KEY);
      s.cloudResumeDiagnostic=message;
      s.cloudResumeDiagnosticAt=new Date().toISOString();
      localStorage.setItem(STATE_KEY,JSON.stringify(s));
    } catch(_) {}
  }

  function finishSuccess(){
    active=false;
    setDiagnostic('official_server_response_received');
    /* Keep callback and script alive to absorb redirected/late duplicate delivery. */
  }

  function request(force){
    var p=profile();
    if(!endpoint||!valid(p)||!ready()) return false;
    var now=Date.now();
    if(active) return true;
    if(!force&&now-lastStartedAt<120000) return true;

    active=true;
    lastStartedAt=now;
    sequence+=1;

    var cb='__eapCloudResume_persistent_'+now+'_'+sequence;
    var script=document.createElement('script');
    activeCallback=cb;
    activeScript=script;

    window[cb]=function(data){
      if(!data||data.ok!==true){
        setDiagnostic('server_callback_not_ok');
        return;
      }
      try {
        window.EAPPlayerResume.applyCloudResponse(data);
        window.dispatchEvent(new CustomEvent('eap:resume-synced',{
          detail:{data:data,changed:true,lateRecovery:true,version:VERSION}
        }));
        finishSuccess();
      } catch(error) {
        setDiagnostic('apply_cloud_response_error:'+String(error&&error.message||error));
      }
    };

    script.onerror=function(){
      active=false;
      setDiagnostic('persistent_jsonp_script_error');
    };

    var url=new URL(endpoint,location.href);
    url.searchParams.set('action','player_resume');
    url.searchParams.set('studentId',p.studentId);
    url.searchParams.set('studentName',p.studentName);
    url.searchParams.set('section',p.section);
    url.searchParams.set('callback',cb);
    url.searchParams.set('nocache',String(now));
    script.async=true;
    script.src=url.toString();
    document.head.appendChild(script);
    setDiagnostic('persistent_jsonp_started:'+cb);
    return true;
  }

  function boot(){
    setTimeout(function(){request(true);},500);
  }

  window.EAPPlayerResumeLateRecovery={
    version:VERSION,
    request:request,
    activeCallback:function(){return activeCallback;},
    activeScript:function(){return activeScript;}
  };
  window.addEventListener('eap:profile-changed',function(){setTimeout(function(){request(true);},250);});
  window.addEventListener('online',function(){request(false);});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();