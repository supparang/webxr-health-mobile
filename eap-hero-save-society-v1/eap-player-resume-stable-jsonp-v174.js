/* =========================================================
   EAP Hero • Official Resume Transport v176 SINGLE-FLIGHT
   - One JSONP request at a time.
   - No automatic retry loop.
   - Authority Runtime explicitly requests refresh after submit/retry.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_RESUME_TRANSPORT_V176__)return;
  window.__EAP_RESUME_TRANSPORT_V176__=true;

  var VERSION='20260802-EAP-RESUME-TRANSPORT-V176-SINGLE-FLIGHT';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var CALLBACK='__eapCloudResume_official_v176';
  var active=null;
  var activeAt=0;
  var lastRequestAt=0;
  var lastSuccessAt=0;
  var COOLDOWN=15000;
  var TIMEOUT=20000;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return{};}}
  function profile(){
    var p=read(PROFILE_KEY),s=read(STATE_KEY),cfg=window.EAP_SHEET_CONFIG||{};
    return {
      studentId:clean(p.studentId||p.id||s.studentId||s.id),
      studentName:clean(p.studentName||p.name||s.studentName||s.name||s.playerName),
      section:clean(p.section||s.section||cfg.section||'122')||'122'
    };
  }
  function endpoint(){return clean((window.EAP_SHEET_CONFIG||{}).webAppUrl);}
  function valid(p){return !!(p.studentId&&p.studentName&&p.studentId.toLowerCase()!=='guest');}
  function diagnostic(message){
    try{
      var s=read(STATE_KEY);
      s.cloudResumeDiagnostic=message;
      s.cloudResumeDiagnosticAt=new Date().toISOString();
      s.cloudResumeTransportVersion=VERSION;
      localStorage.setItem(STATE_KEY,JSON.stringify(s));
    }catch(_){}
  }
  function cleanup(){
    if(!active)return;
    clearTimeout(active._timer);
    if(active.parentNode){try{active.parentNode.removeChild(active);}catch(_){}}
    active=null;activeAt=0;
  }

  window[CALLBACK]=function(data){
    cleanup();
    if(!data||data.ok!==true){diagnostic('single_flight_server_not_ok');return;}
    lastSuccessAt=Date.now();
    diagnostic('single_flight_applied');
    try{
      if(window.EAPPlayerResume&&typeof window.EAPPlayerResume.applyCloudResponse==='function'){
        window.EAPPlayerResume.applyCloudResponse(data);
      }
    }catch(error){diagnostic('single_flight_apply_error:'+clean(error&&error.message||error));}
    try{window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:{data:data,changed:true,transportVersion:VERSION}}));}catch(_){}
  };

  function request(force){
    var now=Date.now(),p=profile(),ep=endpoint();
    if(!ep||!valid(p)){diagnostic('single_flight_waiting_identity');return false;}
    if(active&&now-activeAt<TIMEOUT)return true;
    if(active)cleanup();
    if(!force&&now-lastRequestAt<COOLDOWN)return false;
    lastRequestAt=now;

    var url=new URL(ep,location.href);
    url.searchParams.set('action','player_resume');
    url.searchParams.set('studentId',p.studentId);
    url.searchParams.set('studentName',p.studentName);
    url.searchParams.set('section',p.section);
    url.searchParams.set('callback',CALLBACK);
    url.searchParams.set('force','1');
    url.searchParams.set('_',String(now));

    var script=document.createElement('script');
    script.async=true;
    script.referrerPolicy='no-referrer';
    script.src=url.toString();
    script.onerror=function(){diagnostic('single_flight_script_error');cleanup();};
    script._timer=setTimeout(function(){diagnostic('single_flight_timeout');cleanup();},TIMEOUT);
    active=script;activeAt=now;
    diagnostic('single_flight_started');
    document.head.appendChild(script);
    return true;
  }

  window.EAPPlayerResumeStableJSONP={
    version:VERSION,
    request:request,
    callback:CALLBACK,
    diagnostics:function(){return{active:!!active,lastRequestAt:lastRequestAt,lastSuccessAt:lastSuccessAt,cooldownMs:COOLDOWN};}
  };

  function boot(){setTimeout(function(){request(false);},700);}
  window.addEventListener('eap:profile-changed',function(){cleanup();lastRequestAt=0;request(true);});
  window.addEventListener('online',function(){request(false);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
