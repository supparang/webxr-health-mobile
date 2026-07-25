/* =========================================================
   EAP Hero • Cloud Resume Continuity v173
   - Keeps the last server-confirmed route usable during a slow reconnect.
   - Restores only a matching player-scoped, server-confirmed snapshot.
   - Never derives route, unlocks, scores, or completion locally.
   - Starts one official retry through the existing resume transports.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_CLOUD_RESUME_CONTINUITY_V173__)return;
  window.__EAP_CLOUD_RESUME_CONTINUITY_V173__=true;

  var VERSION='20260725-EAP-CLOUD-RESUME-CONTINUITY-V173';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var SNAPSHOT_PREFIX='EAP_HERO_PLAYER_STATE_V1_';
  var DEFAULT_SECTION=String((window.EAP_SHEET_CONFIG||{}).section||'122');
  var retried=false;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return{};}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}}
  function profile(){
    var p=read(PROFILE_KEY),s=read(STATE_KEY);
    return {
      studentId:clean(p.studentId||p.id||s.studentId||s.id||''),
      studentName:clean(p.studentName||p.name||s.studentName||s.name||s.playerName||''),
      section:clean(p.section||s.section||DEFAULT_SECTION)||DEFAULT_SECTION
    };
  }
  function valid(p){return !!(p.studentId&&p.studentName&&p.studentId.toLowerCase()!=='guest');}
  function key(p){return encodeURIComponent(p.section+'__'+p.studentId);}
  function route(v){v=clean(v).toUpperCase();return /^(?:S(?:1[0-5]|[1-9])|B[1-5])$/.test(v)?v:'';}
  function matchingOfficial(s,p){
    if(!s||typeof s!=='object')return false;
    var sid=clean(s.studentId||(s.profile&&s.profile.studentId)||(s.player&&s.player.studentId));
    var sec=clean(s.section||(s.profile&&s.profile.section)||(s.player&&s.player.section)||DEFAULT_SECTION)||DEFAULT_SECTION;
    var resumeKey=clean(s.serverResume&&s.serverResume.resumeKey);
    return sid===p.studentId&&sec===p.section&&resumeKey===key(p)&&!!route(s.currentCloudRoute||s.currentRoute)&&!!clean(s.serverResume&&s.serverResume.syncedAt);
  }
  function dispatch(s){
    try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(s),storageArea:localStorage}));}catch(_){}
    try{window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:{data:s.serverResume||{},changed:false,continuity:true,version:VERSION}}));}catch(_){}
  }
  function restore(){
    var p=profile();if(!valid(p))return false;
    var live=read(STATE_KEY),snap=read(SNAPSHOT_PREFIX+key(p)),chosen=null;
    if(matchingOfficial(live,p))chosen=live;
    else if(matchingOfficial(snap,p))chosen=snap;
    if(!chosen)return false;
    chosen.cloudResumeStatus='ok';
    chosen.cloudResumeRequired=true;
    chosen.cloudFirst=true;
    chosen.currentCloudRoute=route(chosen.currentCloudRoute||chosen.currentRoute);
    chosen.currentRoute=chosen.currentCloudRoute;
    chosen.activeRoute=chosen.currentCloudRoute;
    chosen.cloudResumeContinuity=true;
    chosen.cloudResumeContinuityVersion=VERSION;
    chosen.cloudResumeContinuityAt=new Date().toISOString();
    write(STATE_KEY,chosen);write(SNAPSHOT_PREFIX+key(p),chosen);dispatch(chosen);return true;
  }
  function retry(){
    if(retried)return;retried=true;
    setTimeout(function(){
      try{
        if(window.EAPPlayerResumeFetchBridge&&typeof window.EAPPlayerResumeFetchBridge.request==='function')window.EAPPlayerResumeFetchBridge.request(true);
        else if(window.EAPPlayerResumeLateRecovery&&typeof window.EAPPlayerResumeLateRecovery.request==='function')window.EAPPlayerResumeLateRecovery.request(true);
        else if(window.EAPPlayerResume&&typeof window.EAPPlayerResume.sync==='function')window.EAPPlayerResume.sync({silent:true});
      }catch(_){}
    },350);
  }
  function boot(){restore();retry();setTimeout(restore,900);setTimeout(restore,2500);}
  ['eap:profile-changed','online'].forEach(function(n){window.addEventListener(n,function(){retried=false;boot();});});
  window.EAPCloudResumeContinuity={version:VERSION,restore:restore,retry:function(){retried=false;retry();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
