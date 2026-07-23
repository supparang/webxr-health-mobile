/* =========================================================
   EAP Hero • Player Resume Late Response Recovery v169
   - Adds one resilient JSONP request for slow Apps Script responses.
   - Does not discard the callback at the 35-second warning point.
   - Applies only the official server response through EAPPlayerResume.
   - Never derives route or unlocks locally.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_PLAYER_RESUME_LATE_RESPONSE_V169__) return;
  window.__EAP_PLAYER_RESUME_LATE_RESPONSE_V169__ = true;

  var VERSION='20260723-EAP-PLAYER-RESUME-LATE-RESPONSE-V169';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var endpoint=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
  var defaultSection=String((window.EAP_SHEET_CONFIG||{}).section||'122');
  var active=false;
  var lastStartedAt=0;
  var sequence=0;

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

  function request(force){
    var p=profile();
    if(!endpoint||!valid(p)||!ready()) return false;
    var now=Date.now();
    if(active) return true;
    if(!force&&now-lastStartedAt<30000) return true;

    active=true;
    lastStartedAt=now;
    sequence+=1;

    var cb='__eapResumeLateV169_'+now+'_'+sequence;
    var script=document.createElement('script');
    var hardTimer=0;

    function finish(){
      active=false;
      clearTimeout(hardTimer);
      if(script.parentNode) script.parentNode.removeChild(script);
      /* Keep a harmless callback for genuinely late redirected responses. */
      setTimeout(function(){
        try { window[cb]=function(){}; } catch(_) {}
      },0);
    }

    window[cb]=function(data){
      try {
        if(data&&data.ok===true){
          window.EAPPlayerResume.applyCloudResponse(data);
          window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:{data:data,changed:true,lateRecovery:true,version:VERSION}}));
        }
      } finally {
        finish();
      }
    };

    script.onerror=function(){finish();};
    hardTimer=setTimeout(function(){finish();},180000);

    var url=new URL(endpoint,location.href);
    url.searchParams.set('action','player_resume');
    url.searchParams.set('studentId',p.studentId);
    url.searchParams.set('studentName',p.studentName);
    url.searchParams.set('section',p.section);
    url.searchParams.set('callback',cb);
    url.searchParams.set('nocache',String(now));
    script.async=true;
    script.referrerPolicy='no-referrer';
    script.src=url.toString();
    document.head.appendChild(script);
    return true;
  }

  function boot(){
    setTimeout(function(){request(true);},700);
    setTimeout(function(){request(false);},12000);
  }

  window.EAPPlayerResumeLateRecovery={version:VERSION,request:request};
  window.addEventListener('eap:profile-changed',function(){setTimeout(function(){request(true);},250);});
  window.addEventListener('online',function(){request(false);});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();