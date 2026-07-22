/* =========================================================
   EAP Hero • Resume Route Truth v152
   - Makes Start / Continue and lobby "current route" use the same
     Progress Truth as Skill Hub and Map.
   - Ignores stale currentRoute/currentCloudRoute values that point past
     the first incomplete Session.
   - Keeps passed Sessions reviewable but never resumes into a future Session.
   - UI/routing only; does not modify Sheet authority or scores.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-RESUME-ROUTE-TRUTH-V152';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var ACTIVE_KEYS=['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION'];
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function writeState(s){try{localStorage.setItem(STATE_KEY,JSON.stringify(s));return true;}catch(_){return false;}}
  function pack(){var p=window.EAP_HERO_SESSION_CONTENT_PACK;return p&&Array.isArray(p.routes)?p:null;}
  function routeById(id){var p=pack(),rid=clean(id).toUpperCase();if(!p)return null;return p.routes.find(function(r){return clean(r.routeId).toUpperCase()===rid;})||null;}
  function truth(){
    var api=window.EAPProgressTruthResolver,d=null;
    try{d=api&&typeof api.diagnostics==='function'?api.diagnostics():null;}catch(_){d=null;}
    var progress=d&&d.sessionProgress||{};
    var first=1;
    for(var i=1;i<=15;i++){
      var row=progress['S'+i]||progress[String(i)]||{};
      if(row.passed===true||row.complete===true){first=i+1;continue;}
      first=i;break;
    }
    if(first>15)first=15;
    return {session:first,routeId:'S'+first,progress:progress};
  }
  function canonicalRoute(){
    var t=truth();
    return routeById(t.routeId)||{routeId:t.routeId,title:'Session '+t.session,routeType:'session'};
  }
  function persist(route){
    var rid=clean(route&&route.routeId||'S1').toUpperCase();
    var n=Number((rid.match(/^S(\d+)$/)||[])[1]||1);
    try{
      localStorage.setItem(ACTIVE_KEYS[0],rid);
      localStorage.setItem(ACTIVE_KEYS[1],rid);
      localStorage.setItem(ACTIVE_KEYS[2],String(n));
    }catch(_){ }
    var s=readState();
    s.currentRoute=rid;s.currentCloudRoute=rid;s.activeRoute=rid;s.currentSession=n;
    s.resumeTruthVersion=VERSION;
    writeState(s);
  }
  function patchGuard(){
    var g=window.EAPRoadmapLockGuard;
    if(!g||g.__eapResumeTruthV152)return;
    var original=typeof g.currentRoute==='function'?g.currentRoute.bind(g):null;
    g.currentRoute=function(){
      var route=canonicalRoute();persist(route);return route;
    };
    g.__eapResumeTruthV152={version:VERSION,originalCurrentRoute:original};
  }
  function openTruthRoute(){
    var route=canonicalRoute(),n=Number((route.routeId.match(/^S(\d+)$/)||[])[1]||1);
    persist(route);
    if(window.EAPHero&&typeof window.EAPHero.skillHub==='function'){window.EAPHero.skillHub(n);return true;}
    if(window.EAPSkillHubRouteLock&&typeof window.EAPSkillHubRouteLock.runCurrentRoute==='function'){window.EAPSkillHubRouteLock.runCurrentRoute();return true;}
    if(window.EAPHero&&typeof window.EAPHero.map==='function'){window.EAPHero.map();return true;}
    setTimeout(openTruthRoute,200);return false;
  }
  function updateLobby(){
    var route=canonicalRoute(),n=Number((route.routeId.match(/^S(\d+)$/)||[])[1]||1);
    var panel=document.getElementById('eap-student-compact-lobby');
    if(panel){
      var title=panel.querySelector('.lob-title');if(title)title.textContent='Week '+n+' / S'+n;
      var meta=panel.querySelector('.lob-meta');if(meta&&route.title)meta.textContent=route.title;
    }
    var bodyText=clean(document.body&&document.body.innerText||'');
    if(/STUDENT LOBBY/i.test(bodyText))persist(route);
  }
  function guardContinue(e){
    var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
    var text=clean(b.textContent),action=clean(b.getAttribute('data-eap-lobby-action'));
    if(action==='continue'||/^(?:▶\s*)?(?:Start\s*\/\s*Continue|Continue Session|Continue)$/i.test(text)){
      var lobby=b.closest('#eap-student-compact-lobby');
      if(lobby||/Start\s*\/\s*Continue/i.test(text)){
        e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();openTruthRoute();return false;
      }
    }
  }
  function reconcile(){
    patchGuard();
    var route=canonicalRoute();persist(route);updateLobby();
    window.EAPResumeRouteTruth={version:VERSION,currentRoute:canonicalRoute,open:openTruthRoute,diagnostics:function(){return{truth:truth(),route:canonicalRoute(),state:readState()};}};
    document.documentElement.dataset.eapResumeRouteTruthVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,100);}
  document.addEventListener('click',guardContinue,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:progress-truth-updated','eap:resume-synced','eap:local-result-saved'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(reconcile,50);setTimeout(reconcile,700);setTimeout(reconcile,1800);
})();