/* =========================================================
   EAP Hero • Player Resume Fetch Bridge v171
   - Reads official player_resume JSON directly with fetch.
   - Applies only responses returned by Google Sheet/backend.
   - Never derives route or unlocks locally.
   - JSONP modules remain as compatibility fallback.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_PLAYER_RESUME_FETCH_BRIDGE_V171__) return;
  window.__EAP_PLAYER_RESUME_FETCH_BRIDGE_V171__ = true;

  var VERSION='20260723-EAP-PLAYER-RESUME-FETCH-BRIDGE-V171';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var endpoint=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
  var defaultSection=String((window.EAP_SHEET_CONFIG||{}).section||'122');
  var active=false;
  var lastStartedAt=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return{};}}
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
  function diagnostic(message){
    try{
      var s=read(STATE_KEY);
      s.cloudResumeDiagnostic=message;
      s.cloudResumeDiagnosticAt=new Date().toISOString();
      s.cloudResumeFetchBridgeVersion=VERSION;
      localStorage.setItem(STATE_KEY,JSON.stringify(s));
    }catch(_){}
  }
  function request(force){
    var p=profile();
    if(!endpoint||!valid(p)||!ready()) return false;
    var now=Date.now();
    if(active) return true;
    if(!force&&now-lastStartedAt<60000) return true;
    active=true;
    lastStartedAt=now;
    diagnostic('fetch_started');

    var url=new URL(endpoint,location.href);
    url.searchParams.set('action','player_resume');
    url.searchParams.set('studentId',p.studentId);
    url.searchParams.set('studentName',p.studentName);
    url.searchParams.set('section',p.section);
    url.searchParams.set('_',String(now));

    var controller=typeof AbortController==='function'?new AbortController():null;
    var timer=setTimeout(function(){if(controller)controller.abort();},45000);

    fetch(url.toString(),{
      method:'GET',
      mode:'cors',
      cache:'no-store',
      credentials:'omit',
      redirect:'follow',
      signal:controller?controller.signal:undefined
    }).then(function(response){
      if(!response.ok) throw new Error('HTTP '+response.status);
      return response.text();
    }).then(function(text){
      var data;
      try{data=JSON.parse(text);}catch(error){throw new Error('invalid_json:'+error.message);}
      if(!data||data.ok!==true) throw new Error('server_not_ok');
      window.EAPPlayerResume.applyCloudResponse(data);
      diagnostic('fetch_official_response_applied');
      window.dispatchEvent(new CustomEvent('eap:resume-synced',{
        detail:{data:data,changed:true,fetchBridge:true,version:VERSION}
      }));
    }).catch(function(error){
      diagnostic('fetch_failed:'+String(error&&error.message||error));
      if(window.EAPPlayerResumeLateRecovery&&typeof window.EAPPlayerResumeLateRecovery.request==='function'){
        try{window.EAPPlayerResumeLateRecovery.request(true);}catch(_){}
      }
    }).finally(function(){
      clearTimeout(timer);
      active=false;
    });
    return true;
  }

  window.EAPPlayerResumeFetchBridge={version:VERSION,request:request};
  window.addEventListener('eap:profile-changed',function(){setTimeout(function(){request(true);},180);});
  window.addEventListener('online',function(){request(false);});
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){request(true);},260);},{once:true});
  }else{
    setTimeout(function(){request(true);},260);
  }
})();
