/* =========================================================
   EAP Hero Cloud Resume Lifecycle Completion v20260715
   V2 CLOUD ROUTE AUTHORITY
   - Cloud/Sheet currentCloudRoute wins over early roadmap fallback.
   - Derives the first incomplete route from verified Cloud-restored state
     when currentCloudRoute is temporarily missing.
   - Keeps localStorage only as a UI cache of verified Cloud route.
   - Refreshes Lobby and guarantees Start / Continue reaches that route.
   - Does not alter scores, pass/fail, evidence, teacher review, or unlocks.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_CLOUD_RESUME_LIFECYCLE_COMPLETION_V2__) return;
  window.__EAP_CLOUD_RESUME_LIFECYCLE_COMPLETION_V2__=true;

  var VERSION='v20260715-EAP-CLOUD-RESUME-LIFECYCLE-COMPLETION-V2-CLOUD-ROUTE-AUTHORITY';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var STYLE_ID='eap-cloud-resume-lifecycle-style-v2';
  var watchdogTimer=null;
  var refreshTimer=null;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}');}catch(_){return {};}}
  function routeId(v){
    var raw=text(v&&v.routeId||v).toUpperCase();
    if(/^\d+$/.test(raw)) return 'S'+Number(raw);
    var sm=raw.match(/^S(?:ESSION)?\s*(\d+)$/i); if(sm) return 'S'+Number(sm[1]);
    var bm=raw.match(/^B(?:OSS)?\s*(\d+)$/i); if(bm) return 'B'+Number(bm[1]);
    return raw;
  }
  function sessionNo(rid){var m=routeId(rid).match(/^S(\d+)$/);return m?Number(m[1]):0;}
  function bossNo(rid){var m=routeId(rid).match(/^B(\d+)$/);return m?Number(m[1]):0;}
  function pack(){var p=window.EAP_HERO_SESSION_CONTENT_PACK;return p&&Array.isArray(p.routes)?p:null;}
  function routeList(){var p=pack();if(!p)return[];var order=Array.isArray(p.routeOrder)&&p.routeOrder.length?p.routeOrder:p.routes.map(function(r){return r.routeId;});return order.map(function(id){return p.routes.find(function(r){return routeId(r.routeId)===routeId(id);});}).filter(Boolean);}
  function routeById(rid){var id=routeId(rid);return routeList().find(function(r){return routeId(r.routeId)===id;})||null;}
  function isTrue(v){return v===true||String(v).toUpperCase()==='TRUE'||String(v)==='1';}
  function score(v){var n=Number(v);return Number.isFinite(n)?n:0;}

  function cloudStateReady(s){
    if(!s||typeof s!=='object') return false;
    if(s.cloudResumeStatus==='ok') return true;
    if(s.serverResume&&(score(s.serverResume.recordCount)>0||text(s.serverResume.resumeKey))) return true;
    return Array.isArray(s.portfolio)&&s.portfolio.some(function(x){return x&&(x.cloudVerified||x.serverVerified||x.restoredFromSheet);});
  }

  function requiredSkills(route){
    if(!route)return[];
    if(route.routeType==='boss_gate')return['reading','listening','writing','speaking'];
    var c=route.skillContract||{};
    var req=['reading','listening','writing','speaking'].filter(function(sk){return /^(Core|Support|Integrated)$/i.test(text(c[sk]));});
    return req.length?req:['reading','writing'];
  }

  function completedFromCloudState(s,route){
    var rid=routeId(route&&route.routeId),n=sessionNo(rid),completed=s.completedSessions||{};
    if(isTrue(completed[rid])||(n&&isTrue(completed[n])))return true;
    var sp=s.sessionProgress||{};
    var st=sp[rid]||(n?sp[n]:null)||{};
    if(isTrue(st.completed)||isTrue(st.complete)||isTrue(st.passed))return true;
    var req=requiredSkills(route),best={};
    (Array.isArray(s.portfolio)?s.portfolio:[]).forEach(function(row){
      if(!row||routeId(row.routeId||row.sessionId||row.session)!==rid)return;
      if(!(row.cloudVerified||row.serverVerified||row.restoredFromSheet||row.sheetConfirmed))return;
      var sk=text(row.skill).toLowerCase();
      best[sk]=Math.max(score(best[sk]),score(row.bestScore!==undefined?row.bestScore:row.score));
    });
    return req.length>0&&req.every(function(sk){return score(best[sk])>=60;});
  }

  function deriveCloudRoute(s){
    var direct=routeById(s&&s.currentCloudRoute);
    if(direct)return direct;
    var list=routeList();
    for(var i=0;i<list.length;i++)if(!completedFromCloudState(s,list[i]))return list[i];
    return list[list.length-1]||null;
  }

  function verifiedRoute(){
    var s=readState();
    if(cloudStateReady(s)){
      var cloud=deriveCloudRoute(s);
      if(cloud)return cloud;
    }
    try{
      if(window.EAPRoadmapLockGuard&&typeof window.EAPRoadmapLockGuard.currentRoute==='function'){
        var r=window.EAPRoadmapLockGuard.currentRoute();
        if(r&&routeId(r.routeId))return r;
      }
    }catch(_){}
    return routeById(s.currentCloudRoute||s.currentRoute||'')||null;
  }

  function mirrorVerifiedRoute(route){
    if(!route||!routeId(route.routeId))return;
    var rid=routeId(route.routeId);
    try{
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',rid);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE',rid);
      var n=sessionNo(rid);
      if(n)localStorage.setItem('EAP_HERO_CURRENT_SESSION',String(n));
      else localStorage.removeItem('EAP_HERO_CURRENT_SESSION');
    }catch(_){}
  }

  function pageMode(){
    try{if(window.EAPPhaseAMultiTaskRunner&&typeof window.EAPPhaseAMultiTaskRunner.pageMode==='function')return window.EAPPhaseAMultiTaskRunner.pageMode();}catch(_){}
    var a=document.getElementById('app'),t=text(a&&a.innerText);
    if(/STUDENT LOBBY|Start\s*\/\s*Continue/i.test(t))return'lobby';
    if(/Learning Route|Campus Map/i.test(t))return'map';
    if(/My Learning Report|Recent Portfolio/i.test(t))return'report';
    if(/Student ID|Academic Hero Profile/i.test(t)&&a&&a.querySelector('input'))return'profile';
    return'other';
  }

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');s.id=STYLE_ID;
    s.textContent='body.eap-cloud-resume-lobby-ready #app{display:block!important}body.eap-cloud-resume-lobby-ready #eap-student-compact-lobby{max-width:920px!important;margin:18px auto!important}body.eap-cloud-resume-lobby-ready #eapLivingRuntimeHud,body.eap-cloud-resume-lobby-ready #phaseA2MissionPanel{display:none!important}';
    document.head.appendChild(s);
  }

  function clearTransient(){
    var mode=pageMode(),safe=mode==='lobby'||mode==='map'||mode==='profile'||mode==='report';
    document.body.classList.toggle('eap-cloud-resume-lobby-ready',mode==='lobby');
    if(!safe)return;
    try{if(window.EAPLivingMissionRuntime&&typeof window.EAPLivingMissionRuntime.clear==='function')window.EAPLivingMissionRuntime.clear();}catch(_){}
    try{if(window.EAPPhaseAMultiTaskRunner&&typeof window.EAPPhaseAMultiTaskRunner.clearTransient==='function')window.EAPPhaseAMultiTaskRunner.clearTransient('cloud-resume-'+mode);}catch(_){}
    var hud=document.getElementById('eapLivingRuntimeHud');if(hud)hud.remove();
    var panel=document.getElementById('phaseA2MissionPanel');if(panel)panel.remove();
  }

  function refreshUI(){
    addStyle();
    var route=verifiedRoute();
    if(route)mirrorVerifiedRoute(route);
    clearTransient();
    try{if(window.EAPRoadmapLockGuard&&typeof window.EAPRoadmapLockGuard.refresh==='function')window.EAPRoadmapLockGuard.refresh();}catch(_){}
    try{if(window.EAPRoadmapCurrentRouteSync&&typeof window.EAPRoadmapCurrentRouteSync.sync==='function')window.EAPRoadmapCurrentRouteSync.sync();}catch(_){}
    if(route)mirrorVerifiedRoute(route);
    try{if(window.EAPStudentHomeRoadmap&&typeof window.EAPStudentHomeRoadmap.refresh==='function')window.EAPStudentHomeRoadmap.refresh();}catch(_){}
    try{if(window.EAPStudentHomeLobby&&typeof window.EAPStudentHomeLobby.refresh==='function')window.EAPStudentHomeLobby.refresh();}catch(_){}
  }

  function openRoute(route){
    route=route||verifiedRoute();if(!route)return false;
    mirrorVerifiedRoute(route);
    var rid=routeId(route.routeId),bn=bossNo(rid),sn=sessionNo(rid);
    if(bn){
      if(window.EAPBossFourSkillV4&&typeof window.EAPBossFourSkillV4.start==='function'){window.EAPBossFourSkillV4.start(bn);return true;}
      if(window.EAPHero&&typeof window.EAPHero.startGateBoss==='function'){window.EAPHero.startGateBoss(rid);return true;}
      return false;
    }
    if(window.EAPHero&&typeof window.EAPHero.skillHub==='function'&&sn){window.EAPHero.skillHub(sn);return true;}
    if(window.EAPSkillHubRouteLock&&typeof window.EAPSkillHubRouteLock.runCurrentRoute==='function'){try{var out=window.EAPSkillHubRouteLock.runCurrentRoute();if(out!==false)return true;}catch(_){}}
    if(window.EAPHero&&typeof window.EAPHero.showMap==='function'){window.EAPHero.showMap();return true;}
    return false;
  }

  function armContinueWatchdog(){
    clearTimeout(watchdogTimer);var before=pageMode();
    watchdogTimer=setTimeout(function(){var after=pageMode();if((before==='lobby'||before==='map')&&(after==='lobby'||after==='other'))openRoute(verifiedRoute());setTimeout(refreshUI,180);},850);
  }

  function onClick(e){
    var btn=e.target&&e.target.closest&&e.target.closest('[data-eap-lobby-action="continue"],button,a,[role="button"]');if(!btn)return;
    var label=text(btn.textContent).replace(/^[📘👤🧭▶]+\s*/,'');
    if(btn.matches('[data-eap-lobby-action="continue"]')||/^Start\s*\/\s*Continue$|^Continue(?: Session)?$/i.test(label))armContinueWatchdog();
  }

  function scheduleRefresh(delay){clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshUI,delay||120);}
  document.addEventListener('click',onClick,true);
  window.addEventListener('eap:resume-synced',function(){scheduleRefresh(60);setTimeout(refreshUI,300);setTimeout(refreshUI,900);});
  window.addEventListener('storage',function(e){if(!e||e.key===STATE_KEY)scheduleRefresh(80);});
  window.addEventListener('load',function(){scheduleRefresh(80);setTimeout(refreshUI,650);setTimeout(refreshUI,1800);});
  window.addEventListener('popstate',function(){scheduleRefresh(100);});
  new MutationObserver(function(){scheduleRefresh(120);}).observe(document.documentElement,{childList:true,subtree:true});

  window.EAPCloudResumeLifecycleCompletion={version:VERSION,refresh:refreshUI,currentRoute:verifiedRoute,openCurrent:function(){return openRoute(verifiedRoute());}};
  scheduleRefresh(80);
})();