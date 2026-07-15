/* =========================================================
   EAP Hero Live Resume Identity Normalizer v20260715
   - Repairs fresh player_resume responses that omit top-level studentId/section.
   - Uses the active profile only to label the already-returned live response.
   - Does not accept stale cache: generatedAt must be recent.
   - Feeds the normalized live response into Production Authority.
   - Does not alter scores, evidence, pass/fail, or unlock requirements.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_LIVE_RESUME_IDENTITY_NORMALIZER_V1__)return;
  window.__EAP_LIVE_RESUME_IDENTITY_NORMALIZER_V1__=true;

  var VERSION='v20260715-EAP-LIVE-RESUME-IDENTITY-NORMALIZER-V1';
  var STATE='EAP_HERO_PROGRESS_V3';
  var PROFILE='EAP_HERO_PLAYER_PROFILE_V1';
  var lastSignature='';

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}');}catch(_){return{};}}
  function profile(){
    var s=read(STATE),p=Object.assign({},s.profile||{},s.player||{},s.user||{},read(PROFILE)||{});
    return {
      studentId:text(p.studentId||p.id||s.studentId||s.id||''),
      studentName:text(p.studentName||p.name||s.studentName||s.name||s.playerName||''),
      section:text(p.section||s.section||(window.EAP_SHEET_CONFIG||{}).section||'122')||'122'
    };
  }
  function recent(stamp){
    var ms=Date.parse(text(stamp));
    return Number.isFinite(ms)&&Math.abs(Date.now()-ms)<=10*60*1000;
  }
  function matchingRows(records,p){
    var rows=Array.isArray(records)?records:[];
    if(!rows.length)return true;
    var identified=rows.filter(function(r){return text(r&&r.studentId||r&&r.id);});
    if(!identified.length)return true;
    return identified.some(function(r){
      var sid=text(r.studentId||r.id),sec=text(r.section||p.section)||p.section;
      return sid===p.studentId&&sec===p.section;
    });
  }
  function normalize(event){
    var detail=event&&event.detail||{},data=detail.data||detail,p=profile();
    if(!data||data.ok!==true||!Array.isArray(data.records)||!p.studentId)return false;
    if(!recent(data.generatedAt))return false;
    if(data.studentId&&text(data.studentId)!==p.studentId)return false;
    if(data.section&&text(data.section)!==p.section)return false;
    if(!matchingRows(data.records,p))return false;

    var fixed=Object.assign({},data,{
      studentId:p.studentId,
      studentName:text(data.studentName||p.studentName),
      section:p.section
    });
    var sig=p.section+'|'+p.studentId+'|'+text(fixed.generatedAt)+'|'+fixed.records.length;
    if(sig===lastSignature)return false;
    lastSignature=sig;

    var guard=window.EAPRoadmapLockGuard;
    if(!guard||typeof guard.acceptResume!=='function')return false;
    var accepted=guard.acceptResume({detail:{data:fixed,source:'live_player_resume_normalized',live:true}});
    if(accepted){
      try{if(window.EAPCloudResumeLifecycleCompletion&&typeof window.EAPCloudResumeLifecycleCompletion.refresh==='function')window.EAPCloudResumeLifecycleCompletion.refresh();}catch(_){}
      window.dispatchEvent(new CustomEvent('eap:live-resume-normalized',{detail:{version:VERSION,studentId:p.studentId,section:p.section,recordCount:fixed.records.length,generatedAt:fixed.generatedAt}}));
    }
    return accepted;
  }

  window.addEventListener('eap:resume-synced',function(e){setTimeout(function(){normalize(e);},20);});
  window.EAPLiveResumeIdentityNormalizer={version:VERSION,normalize:normalize,profile:profile};
})();