/* =========================================================
   EAP Hero • Gate Route Alias Finalizer v147
   - Canonical route contract uses B1–B5.
   - Converts GATE1 / GATE 1 / BOSS1 / BOSS GATE 1 to B1 before
     Production Authority evaluates access.
   - Does not change unlock requirements or Sheet authority.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-GATE-ROUTE-ALIAS-FINALIZER-V147';
  var METHODS=['startGateBoss','openBoss','skillHub','openSkillMission'];
  var timer=0;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function canonical(v){
    if(v&&typeof v==='object'&&v.routeId)v=v.routeId;
    var raw=text(v).toUpperCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
    var m=raw.match(/^(?:B|BOSS|BOSS GATE|GATE)\s*0?([1-5])$/i);
    if(m)return 'B'+Number(m[1]);
    m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
    if(m)return 'S'+Number(m[1]);
    return text(v);
  }
  function patchMethod(name){
    var hero=window.EAPHero;
    if(!hero||typeof hero[name]!=='function'||hero[name].__eapGateAliasV147)return false;
    var original=hero[name];
    var wrapped=function(){
      var args=Array.prototype.slice.call(arguments);
      if(name==='openSkillMission'){
        if(/reading|listening|writing|speaking/i.test(String(args[0]||'')))args[1]=canonical(args[1]);
        else args[0]=canonical(args[0]);
      }else args[0]=canonical(args[0]);
      return original.apply(this,args);
    };
    wrapped.__eapGateAliasV147=true;
    wrapped.__original=original.__original||original;
    hero[name]=wrapped;
    return true;
  }
  function normalizeDom(){
    document.querySelectorAll('[data-eap-roadmap-route],[data-route-id]').forEach(function(el){
      if(el.dataset.eapRoadmapRoute)el.dataset.eapRoadmapRoute=canonical(el.dataset.eapRoadmapRoute);
      if(el.dataset.routeId)el.dataset.routeId=canonical(el.dataset.routeId);
    });
  }
  function normalizeStorage(){
    ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE'].forEach(function(key){
      try{var v=localStorage.getItem(key),c=canonical(v);if(v&&c!==v)localStorage.setItem(key,c);}catch(_){}
    });
  }
  function patch(){
    METHODS.forEach(patchMethod);normalizeDom();normalizeStorage();
    document.documentElement.dataset.eapGateAliasVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(patch,80);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-route-id','data-eap-roadmap-route']});
  window.addEventListener('load',function(){patch();setTimeout(patch,500);setTimeout(patch,1500);});
  window.addEventListener('eap:production-authority-refresh',schedule);
  window.EAPGateRouteAlias={version:VERSION,canonical:canonical,patch:patch};
  patch();
})();