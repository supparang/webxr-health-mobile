/* =========================================================
   EAP Hero • Stable Official Resume JSONP v175
   - Uses one permanent protected callback name for Apps Script redirects/slow delivery.
   - Applies only the official player_resume response.
   - Never derives route, unlocks, scores, or completion locally.
   - Retries one request at a time without creating a callback storm.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_PLAYER_RESUME_STABLE_JSONP_V175__)return;
  window.__EAP_PLAYER_RESUME_STABLE_JSONP_V175__=true;

  var VERSION='20260725-EAP-PLAYER-RESUME-STABLE-JSONP-V175';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var CALLBACK='__eapCloudResume_official_v175';
  var endpoint=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
  var defaultSection=String((window.EAP_SHEET_CONFIG||{}).section||'122');
  var activeScript=null;
  var activeSince=0;
  var retryTimer=0;
  var lastSuccessAt=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return{};}}
  function writeDiagnostic(message){
    try{
      var s=read(STATE_KEY);
      s.cloudResumeDiagnostic=message;
      s.cloudResumeDiagnosticAt=new Date().toISOString();
      s.cloudResumeStableTransportVersion=VERSION;
      localStorage.setItem(STATE_KEY,JSON.stringify(s));
    }catch(_){}
  }
  function profile(){
    var p=read(PROFILE_KEY),s=read(STATE_KEY);
    return {
      studentId:clean(p.studentId||p.id||s.studentId||s.id||''),
      studentName:clean(p.studentName||p.name||s.studentName||s.name||s.playerName||''),
      section:clean(p.section||s.section||defaultSection)||defaultSection
    };
  }
  function valid(p){return !!(p.studentId&&p.studentName&&p.studentId.toLowerCase()!=='guest');}
  function ready(){return !!(window.EAPPlayerResume&&typeof window.EAPPlayerResume.applyCloudResponse==='function');}
  function removeActive(){
    if(activeScript&&activeScript.parentNode){try{activeScript.parentNode.removeChild(activeScript);}catch(_){}}
    activeScript=null;activeSince=0;
  }
  function schedule(ms){clearTimeout(retryTimer);retryTimer=setTimeout(function(){request(false);},ms);}

  window[CALLBACK]=function(data){
    if(!data||data.ok!==true){
      writeDiagnostic('stable_jsonp_server_not_ok');
      removeActive();
      schedule(12000);
      return;
    }
    try{
      if(!ready())throw new Error('resume_module_not_ready');
      window.EAPPlayerResume.applyCloudResponse(data);
      lastSuccessAt=Date.now();
      writeDiagnostic('stable_jsonp_official_response_applied');
      window.dispatchEvent(new CustomEvent('eap:resume-synced',{
        detail:{data:data,changed:true,stableJsonp:true,version:VERSION}
      }));
    }catch(error){
      writeDiagnostic('stable_jsonp_apply_error:'+String(error&&error.message||error));
    }
    removeActive();
    schedule(60000);
  };

  function request(force){
    var p=profile();
    if(!endpoint||!valid(p)||!ready()){
      writeDiagnostic('stable_jsonp_waiting_for_profile_or_module');
      schedule(1200);
      return false;
    }
    var now=Date.now();
    if(activeScript){
      if(now-activeSince<120000)return true;
      removeActive();
    }
    if(!force&&lastSuccessAt&&now-lastSuccessAt<45000)return true;

    var url=new URL(endpoint,location.href);
    url.searchParams.set('action','player_resume');
    url.searchParams.set('studentId',p.studentId);
    url.searchParams.set('studentName',p.studentName);
    url.searchParams.set('section',p.section);
    url.searchParams.set('callback',CALLBACK);
    url.searchParams.set('_',String(now));

    var script=document.createElement('script');
    script.async=true;
    script.referrerPolicy='no-referrer';
    script.src=url.toString();
    script.onerror=function(){
      writeDiagnostic('stable_jsonp_script_error');
      removeActive();
      schedule(8000);
    };
    activeScript=script;
    activeSince=now;
    writeDiagnostic('stable_jsonp_started');
    document.head.appendChild(script);
    return true;
  }

  function boot(){request(true);setTimeout(function(){request(false);},2500);}
  window.EAPPlayerResumeStableJSONP={version:VERSION,request:request,callback:CALLBACK};
  window.addEventListener('eap:profile-changed',function(){removeActive();request(true);});
  window.addEventListener('online',function(){removeActive();request(true);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();