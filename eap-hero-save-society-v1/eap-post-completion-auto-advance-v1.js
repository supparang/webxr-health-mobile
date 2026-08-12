/* =========================================================
   EAP Hero • Post Completion Auto Advance v2
   VERSION: 20260812-EAP-POST-COMPLETION-AUTO-ADVANCE-V2

   PURPOSE
   - EAP_Progress v150 remains the sole progression authority.
   - When the viewed Session has completed required skills but the verified
     route has not advanced yet, request one authoritative refresh.
   - When the verified route advances, open it automatically.
   - Checkpoints: S3->B1, S6->B2, S9->B3, S12->B4, S15->B5.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_POST_COMPLETION_AUTO_ADVANCE_V2__) return;
  window.__EAP_POST_COMPLETION_AUTO_ADVANCE_V2__ = true;

  var VERSION='20260812-EAP-POST-COMPLETION-AUTO-ADVANCE-V2';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var VIEW_KEY='EAP_HERO_ACTIVE_VIEW_ROUTE';
  var CHECKPOINT_NEXT={S3:'B1',S6:'B2',S9:'B3',S12:'B4',S15:'B5'};
  var timer=0;
  var lastRefreshAt=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function norm(v){
    var raw=clean(v).toUpperCase(),m;
    m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);if(m)return'S'+Number(m[1]);
    m=raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i);if(m)return'B'+Number(m[1]);
    return raw;
  }
  function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function viewRoute(s){
    var v='';try{v=localStorage.getItem(VIEW_KEY)||'';}catch(_){}
    return norm(v || (s&&s.activeViewRoute) || '');
  }
  function officialRoute(s){
    s=s||read();var r=s.serverResume||{};
    try{if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.currentRoute==='function'){var live=norm(window.EAPAuthorityRuntime.currentRoute());if(live)return live;}}catch(_){}
    return norm(s.currentRoute||s.currentCloudRoute||r.currentRoute||r.currentCloudRoute||r.nextRoute||'');
  }
  function routeCompleted(route,s){
    route=norm(route);s=s||read();var r=s.serverResume||{};var rp=r.routeProgress||s.routeProgress||{};var x=rp[route]||{};
    if(x.completed===true||x.passed===true)return true;
    var n=route.match(/^S(\d+)$/);if(!n)return false;
    var guards=[].slice.call(document.querySelectorAll('.eap-strict-skill-truth-guard[data-session="'+Number(n[1])+'"]'));
    return guards.some(function(g){return /สถานะ Skill บังคับ:\s*2\/2\s*ผ่านแล้ว/i.test(clean(g.textContent));});
  }
  function requestAuthoritativeRefresh(){
    var now=Date.now();
    if(now-lastRefreshAt<2500)return false;
    lastRefreshAt=now;
    try{if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.refresh==='function'){window.EAPAuthorityRuntime.refresh();return true;}}catch(_){}
    try{if(window.EAPPlayerResumeStableJSONP&&typeof window.EAPPlayerResumeStableJSONP.request==='function'){window.EAPPlayerResumeStableJSONP.request(true);return true;}}catch(_){}
    return false;
  }
  function openOfficial(route){
    route=norm(route);if(!route)return false;
    var g=route.match(/^B(\d+)$/),ss=route.match(/^S(\d+)$/);
    try{if(g&&window.EAPBossFourSkillV4&&typeof window.EAPBossFourSkillV4.start==='function'){window.EAPBossFourSkillV4.start(Number(g[1]));return true;}}catch(_){}
    try{if(g&&window.EAPHero&&typeof window.EAPHero.startGateBoss==='function'){window.EAPHero.startGateBoss(route);return true;}}catch(_){}
    try{if(ss&&window.EAPHero&&typeof window.EAPHero.skillHub==='function'){window.EAPHero.skillHub(Number(ss[1]));return true;}}catch(_){}
    try{var a=window.EAPCloudRouteUIAuthority;if(a&&typeof a.open==='function'&&typeof a.route==='function'&&norm(a.route())===route){a.open();return true;}}catch(_){}
    return false;
  }
  function maybeAdvance(){
    var s=read(),view=viewRoute(s),official=officialRoute(s);
    if(!view||!routeCompleted(view,s))return false;

    /* Completion is visible but authority still points at this Session.
       Refresh once so EAP_Progress v150 can return the canonical next route. */
    if(!official||view===official){
      requestAuthoritativeRefresh();
      return false;
    }

    var key='EAP_AUTO_ADVANCED_'+view+'_TO_'+official;
    try{if(sessionStorage.getItem(key)==='1')return false;sessionStorage.setItem(key,'1');}catch(_){}
    setTimeout(function(){openOfficial(official);},180);
    return true;
  }
  function patchCheckpointLabels(){
    document.querySelectorAll('.eap-strict-skill-truth-guard[data-session]').forEach(function(g){
      var sid='S'+Number(g.dataset.session||0),next=CHECKPOINT_NEXT[sid];if(!next)return;
      var condition=g.querySelector('.condition');if(condition){condition.innerHTML=condition.innerHTML.replace(/จึงปลดล็อก\s*<b>[^<]+<\/b>/i,'จึงปลดล็อก <b>'+next+'</b>');}
    });
  }
  function reconcile(){patchCheckpointLabels();maybeAdvance();document.documentElement.dataset.eapPostCompletionAutoAdvance=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,120);}

  ['eap:single-authority-applied','eap:resume-synced','eap:cloud-route-ready','eap:evidence-submitted','eap:portfolio-hydrated-v150','storage'].forEach(function(name){window.addEventListener(name,schedule);});
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setInterval(reconcile,1500);
  setTimeout(reconcile,200);setTimeout(reconcile,900);setTimeout(reconcile,2200);
  window.EAPPostCompletionAutoAdvanceV2={version:VERSION,reconcile:reconcile,maybeAdvance:maybeAdvance,refresh:requestAuthoritativeRefresh};
})();