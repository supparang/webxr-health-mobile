/* =========================================================
   EAP Hero • Start / Resume Gate v184 RETIRED
   VERSION: 20260812-EAP-START-RESUME-GATE-V184-RETIRED

   EAP_Progress v150 + EAPAuthorityRuntime are the only progression
   authorities. This compatibility shim intentionally DOES NOT intercept
   Start / Continue clicks and DOES NOT issue its own player_resume request.
   This removes the duplicate gate/race that could leave the UI stuck on
   "กำลังตรวจสอบความคืบหน้าจาก Google Sheet" after reload.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260812-EAP-START-RESUME-GATE-V184-RETIRED';
  window.__EAP_START_RESUME_GATE_V183__=true;
  window.__EAP_START_RESUME_GATE_V184__=true;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return {};}}
  function identity(){
    var keys=['EAP_HERO_ACTIVE_PLAYER_V1','EAP_ACTIVE_PLAYER','EAP_HERO_ACTIVE_PLAYER'];
    var a={};
    for(var i=0;i<keys.length;i++){
      a=read(keys[i]);
      if(clean(a.studentId||a.id))break;
    }
    var p=read('EAP_HERO_PLAYER_PROFILE_V1');
    var s=read('EAP_HERO_PROGRESS_V3');
    var cfg=window.EAP_SHEET_CONFIG||{};
    return {
      studentId:clean(a.studentId||a.id||p.studentId||p.id||s.studentId||s.id),
      section:clean(a.section||p.section||s.section||cfg.section||'122')||'122'
    };
  }
  function snapshotVerified(){
    try{
      if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.isVerified==='function'){
        return !!window.EAPAuthorityRuntime.isVerified();
      }
    }catch(_){ }
    var s=read('EAP_HERO_PROGRESS_V3'),r=s.serverResume||{};
    var route=clean(r.currentRoute||r.currentCloudRoute||s.currentRoute||s.currentCloudRoute).toUpperCase();
    return !!(route&&/^(?:S(?:1[0-5]|[1-9])|B[1-5])$/.test(route)&&(
      r.serverVerified===true||r.cloudVerified===true||r.compact===true||
      r.service==='eap-progress-authority'||s.cloudResumeStatus==='verified'||s.cloudResumeStatus==='ok'
    ));
  }
  function requestProgress(){
    try{
      if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.refresh==='function'){
        return Promise.resolve(window.EAPAuthorityRuntime.refresh());
      }
    }catch(_){ }
    return Promise.resolve(false);
  }

  /* Remove a stale toast left by v183, if one survived a hot reload. */
  try{
    var old=document.getElementById('eap-start-resume-gate-v177-toast');
    if(old)old.remove();
  }catch(_){ }

  document.documentElement.dataset.eapStartResumeGate=VERSION;
  document.documentElement.dataset.eapStartResumeGateMode='retired-no-click-intercept';
  window.EAPStartResumeGateV183={version:VERSION,identity:identity,snapshotVerified:snapshotVerified,request:requestProgress,retired:true};
})();
