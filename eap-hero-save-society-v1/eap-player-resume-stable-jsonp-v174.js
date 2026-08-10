/* =========================================================
   EAP Hero • Official Resume Transport v179 ID-FIRST
   - One JSONP request at a time.
   - Google Sheet remains the progression authority.
   - studentId + section are sufficient to request player_resume.
   - Prefer the explicitly active learner over stale profile/progress cache.
   - A previously verified Sheet state may keep the UI usable while refresh runs.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_RESUME_TRANSPORT_V179__)return;
  window.__EAP_RESUME_TRANSPORT_V179__=true;

  var VERSION='20260810-EAP-RESUME-TRANSPORT-V179-ID-FIRST-ACTIVE-PLAYER';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var ACTIVE_KEYS=['EAP_HERO_ACTIVE_PLAYER_V1','EAP_ACTIVE_PLAYER','EAP_HERO_ACTIVE_PLAYER'];
  var CALLBACK='__eapCloudResume_official_v179';
  var active=null;
  var activeAt=0;
  var lastRequestAt=0;
  var lastSuccessAt=0;
  var COOLDOWN=12000;
  var TIMEOUT=45000;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return{};}}
  function activeProfile(){
    for(var i=0;i<ACTIVE_KEYS.length;i++){
      var a=read(ACTIVE_KEYS[i]);
      if(clean(a.studentId||a.id)) return a;
    }
    return {};
  }
  function profile(){
    var a=activeProfile(),p=read(PROFILE_KEY),s=read(STATE_KEY),cfg=window.EAP_SHEET_CONFIG||{};
    var studentId=clean(a.studentId||a.id||p.studentId||p.id||s.studentId||s.id);
    var section=clean(a.section||p.section||s.section||cfg.section||'122')||'122';
    var studentName=clean(a.studentName||a.name||p.studentName||p.name||s.studentName||s.name||s.playerName||'');
    return {studentId:studentId,studentName:studentName,section:section};
  }
  function endpoint(){return clean((window.EAP_SHEET_CONFIG||{}).webAppUrl);}
  /* ID-first contract: name is display metadata, not a prerequisite for authority lookup. */
  function valid(p){return !!(p.studentId&&p.section&&p.studentId.toLowerCase()!=='guest');}

  function hasVerifiedSheetState(){
    var s=read(STATE_KEY),r=s&&s.serverResume||{};
    var route=clean(s.currentCloudRoute||s.currentRoute||r.currentRoute||r.routeId);
    var verified=!!(
      s.cloudResumeStatus==='ok'||s.cloudVerified===true||s.serverVerified===true||
      r.cloudVerified===true||r.serverVerified===true||r.compact===true
    );
    return !!(verified&&route);
  }
  function diagnostic(message){
    try{
      var s=read(STATE_KEY);
      s.cloudResumeDiagnostic=message;
      s.cloudResumeDiagnosticAt=new Date().toISOString();
      s.cloudResumeTransportVersion=VERSION;
      localStorage.setItem(STATE_KEY,JSON.stringify(s));
    }catch(_){}
  }
  function emitFailed(code,message){
    diagnostic(code);
    try{window.dispatchEvent(new CustomEvent('eap:resume-failed',{detail:{code:code,message:message||'เชื่อมต่อ Google Sheet ไม่สำเร็จ',transportVersion:VERSION}}));}catch(_){}
  }
  function emitSynced(detail){
    try{window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:Object.assign({transportVersion:VERSION},detail||{})}));}catch(_){}
  }
  function cleanup(){
    if(!active)return;
    clearTimeout(active._timer);
    if(active.parentNode){try{active.parentNode.removeChild(active);}catch(_){}}
    active=null;activeAt=0;
  }

  window[CALLBACK]=function(data){
    cleanup();
    if(!data||data.ok!==true){
      if(hasVerifiedSheetState()){
        diagnostic('server_not_ok_using_verified_sheet_state');
        emitSynced({changed:false,cached:true,refreshFailed:true});
        return;
      }
      emitFailed('single_flight_server_not_ok','Google Sheet ตอบกลับแต่ยังยืนยันความคืบหน้าไม่ได้');
      return;
    }
    lastSuccessAt=Date.now();
    diagnostic('single_flight_applied');
    try{
      if(window.EAPPlayerResume&&typeof window.EAPPlayerResume.applyCloudResponse==='function'){
        window.EAPPlayerResume.applyCloudResponse(data);
      }
    }catch(error){
      if(hasVerifiedSheetState()){
        diagnostic('apply_error_using_verified_sheet_state');
        emitSynced({changed:false,cached:true,applyError:true});
        return;
      }
      emitFailed('single_flight_apply_error:'+clean(error&&error.message||error),'ได้รับข้อมูลแล้วแต่ยังนำความคืบหน้ามาใช้ไม่ได้');
      return;
    }
    emitSynced({data:data,changed:true,cached:false});
  };

  function request(force){
    var now=Date.now(),p=profile(),ep=endpoint();
    if(!ep){emitFailed('single_flight_missing_endpoint','ยังไม่พบปลายทาง Google Sheet');return false;}
    if(!valid(p)){
      emitFailed('single_flight_waiting_identity','ยังไม่มีรหัสนักศึกษาและ Section สำหรับตรวจสอบ Google Sheet');
      return false;
    }
    if(active&&now-activeAt<TIMEOUT)return true;
    if(active)cleanup();
    if(!force&&now-lastRequestAt<COOLDOWN)return false;
    lastRequestAt=now;

    if(hasVerifiedSheetState()){
      diagnostic('verified_sheet_state_refreshing_background');
      emitSynced({changed:false,cached:true,refreshing:true});
    }

    var url=new URL(ep,location.href);
    url.searchParams.set('action','player_resume');
    url.searchParams.set('studentId',p.studentId);
    if(p.studentName)url.searchParams.set('studentName',p.studentName);
    url.searchParams.set('section',p.section);
    url.searchParams.set('callback',CALLBACK);
    url.searchParams.set('force','1');
    url.searchParams.set('_',String(now));

    var script=document.createElement('script');
    script.async=true;
    script.referrerPolicy='no-referrer';
    script.src=url.toString();
    script.onerror=function(){
      cleanup();
      if(hasVerifiedSheetState()){
        diagnostic('script_error_using_verified_sheet_state');
        emitSynced({changed:false,cached:true,refreshFailed:true});
        return;
      }
      emitFailed('single_flight_script_error','เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณาลองอีกครั้ง');
    };
    script._timer=setTimeout(function(){
      cleanup();
      if(hasVerifiedSheetState()){
        diagnostic('timeout_using_verified_sheet_state');
        emitSynced({changed:false,cached:true,refreshTimedOut:true});
        return;
      }
      emitFailed('single_flight_timeout','Google Sheet ตอบกลับช้าเกินกำหนด กรุณาลองอีกครั้ง');
    },TIMEOUT);
    active=script;activeAt=now;
    diagnostic('single_flight_started:'+p.section+'|'+p.studentId);
    document.head.appendChild(script);
    return true;
  }

  window.EAPPlayerResumeStableJSONP={
    version:VERSION,
    request:request,
    callback:CALLBACK,
    profile:profile,
    diagnostics:function(){return{active:!!active,lastRequestAt:lastRequestAt,lastSuccessAt:lastSuccessAt,cooldownMs:COOLDOWN,timeoutMs:TIMEOUT,verifiedSheetState:hasVerifiedSheetState(),profile:profile()};}
  };

  function boot(){setTimeout(function(){request(false);},700);}
  window.addEventListener('eap:profile-changed',function(){cleanup();lastRequestAt=0;request(true);});
  window.addEventListener('online',function(){request(false);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
