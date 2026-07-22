/* =========================================================
   EAP Hero Production Authority v4 SERVER-RESUME-ONLY
   - currentRoute and unlockedRoutes come only from player_resume.
   - Never re-derives progression from raw records in the browser.
   - localStorage is only a cache of the last accepted server resume.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_PRODUCTION_AUTHORITY_V4__) return;
  window.__EAP_PRODUCTION_AUTHORITY_V4__ = true;

  var VERSION='v20260722-EAP-PRODUCTION-AUTHORITY-V4-SERVER-RESUME-ONLY';
  var ORDER=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  var live={verified:false,currentRoute:'',unlocked:{},data:null,identity:''};
  var renderTimer=0;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function norm(v){
    var raw=text(v&&v.routeId||v).toUpperCase(),m;
    m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i); if(m)return'S'+Number(m[1]);
    m=raw.match(/^(?:B|BOSS|GATE|BOSS\s*GATE)\s*0?([1-5])$/i); if(m)return'B'+Number(m[1]);
    if(/^\d+$/.test(raw))return'S'+Number(raw);
    return raw;
  }
  function readState(){try{return JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}')||{};}catch(_){return{};}}
  function profile(){
    var s=readState(),p=Object.assign({},s.profile||{},s.player||{},s.user||{});
    return {studentId:text(p.studentId||p.id||s.studentId||s.id||''),section:text(p.section||s.section||'122')||'122'};
  }
  function identityKey(){var p=profile();return p.section+'__'+p.studentId;}
  function pack(){var p=window.EAP_HERO_SESSION_CONTENT_PACK;return p&&Array.isArray(p.routes)?p:null;}
  function route(id){var p=pack(),rid=norm(id);return p&&p.routes.find(function(r){return norm(r.routeId)===rid;})||{routeId:rid,routeType:/^B/.test(rid)?'boss_gate':'session'};}
  function unlockMap(value,current){
    var out={};
    if(Array.isArray(value)) value.forEach(function(x){var id=norm(x);if(id)out[id]=true;});
    else if(value&&typeof value==='object') Object.keys(value).forEach(function(k){var id=norm(k),v=value[k];if(id&&(v===true||(v&&v.unlocked===true)))out[id]=true;});
    var ci=ORDER.indexOf(current);
    if(ci>=0) for(var i=0;i<=ci;i++) out[ORDER[i]]=true;
    return out;
  }
  function validResume(data){
    if(!data||data.ok!==true)return false;
    var rid=norm(data.currentCloudRoute||data.currentRoute||data.nextRoute);
    if(ORDER.indexOf(rid)<0)return false;
    var p=profile();
    if(p.studentId&&text(data.studentId)&&text(data.studentId)!==p.studentId)return false;
    if(p.section&&text(data.section)&&text(data.section)!==p.section)return false;
    return true;
  }
  function acceptResume(event){
    var detail=event&&event.detail||{},data=detail.data||detail;
    if(!validResume(data))return false;
    var rid=norm(data.currentCloudRoute||data.currentRoute||data.nextRoute);
    live={verified:true,currentRoute:rid,unlocked:unlockMap(data.unlockedRoutes||data.unlockedRouteIds,rid),data:data,identity:identityKey()};
    try{
      var s=readState();
      s.cloudResumeStatus='ok';
      s.currentCloudRoute=rid;
      s.currentRoute=rid;
      s.unlockedRoutes=live.unlocked;
      s.serverResume=Object.assign({},s.serverResume||{},{resumeKey:text(data.resumeKey||data.generatedAt||Date.now()),acceptedAt:new Date().toISOString()});
      localStorage.setItem('EAP_HERO_PROGRESS_V3',JSON.stringify(s));
    }catch(_){}
    schedule();
    window.dispatchEvent(new CustomEvent('eap:live-sheet-authority-applied',{detail:diagnostics()}));
    return true;
  }
  function bootstrap(){
    var s=readState(),rid=norm(s.currentCloudRoute);
    if(s.cloudResumeStatus==='ok'&&ORDER.indexOf(rid)>=0){
      live={verified:true,currentRoute:rid,unlocked:unlockMap(s.unlockedRoutes,rid),data:s,identity:identityKey()};
    }
  }
  function currentId(){return live.verified?live.currentRoute:'';}
  function canOpen(id){id=norm(id);return !!(live.verified&&live.unlocked[id]===true);}
  function reason(id){
    id=norm(id);
    if(!live.verified)return'กำลังตรวจความคืบหน้าจาก Google Sheet';
    return canOpen(id)?'':('ด่านปัจจุบันจาก Google Sheet คือ '+live.currentRoute);
  }
  function toast(msg){
    var el=document.getElementById('eap-production-authority-toast');
    if(!el){el=document.createElement('div');el.id='eap-production-authority-toast';el.style.cssText='position:fixed;z-index:1000000;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(92vw,680px);padding:13px 16px;border-radius:14px;background:#7f1d1d;color:#fff;font:800 13px/1.4 system-ui;box-shadow:0 14px 34px #0005;text-align:center';document.body.appendChild(el);}
    el.textContent=msg;clearTimeout(el._timer);el._timer=setTimeout(function(){if(el.parentNode)el.remove();},3500);
  }
  function routeArg(name,args){
    if(name==='openSkillMission')return norm(/reading|listening|writing|speaking/i.test(String(args[0]||''))?args[1]:args[0]);
    return norm(args[0]);
  }
  function patchMethod(obj,name){
    if(!obj||typeof obj[name]!=='function'||obj[name].__eapServerOnlyV4)return false;
    var original=obj[name].__original||obj[name];
    var guarded=function(){var rid=routeArg(name,arguments);if(rid&&!canOpen(rid)){toast('ด่าน '+rid+' ยังไม่เปิดจากข้อมูล Google Sheet — '+reason(rid));return false;}return original.apply(this,arguments);};
    guarded.__eapServerOnlyV4=true;guarded.__original=original;obj[name]=guarded;return true;
  }
  function patchApis(){var h=window.EAPHero,c=false;c=patchMethod(h,'skillHub')||c;c=patchMethod(h,'openSkillMission')||c;c=patchMethod(h,'startGateBoss')||c;c=patchMethod(h,'openBoss')||c;return c;}
  function decorate(){
    document.querySelectorAll('[data-eap-roadmap-route],[data-route-id]').forEach(function(el){
      var rid=norm(el.dataset.eapRoadmapRoute||el.dataset.routeId);if(ORDER.indexOf(rid)<0)return;
      var open=canOpen(rid);el.classList.toggle('eap-locked',!open);el.classList.toggle('eap-current',rid===currentId());el.setAttribute('aria-disabled',open?'false':'true');el.title=open?(rid===currentId()?'ด่านปัจจุบันจาก Google Sheet':'ด่านที่เปิดให้ทบทวน'):reason(rid);
    });
    document.documentElement.dataset.eapAuthority=VERSION;
  }
  function schedule(){clearTimeout(renderTimer);renderTimer=setTimeout(function(){patchApis();decorate();},60);}
  function reset(){live={verified:false,currentRoute:'',unlocked:{},data:null,identity:identityKey()};schedule();}
  function diagnostics(){return{version:VERSION,authorityMode:'server-resume-only',liveVerified:live.verified,currentRoute:live.currentRoute,unlockedRoutes:Object.keys(live.unlocked),identity:live.identity};}

  document.addEventListener('click',function(event){
    var el=event.target&&event.target.closest&&event.target.closest('[data-eap-roadmap-route],[data-route-id]');if(!el)return;
    var rid=norm(el.dataset.eapRoadmapRoute||el.dataset.routeId);if(rid&&!canOpen(rid)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();toast('ด่าน '+rid+' ยังไม่เปิดจากข้อมูล Google Sheet — '+reason(rid));}
  },true);
  window.addEventListener('eap:resume-synced',acceptResume);
  window.addEventListener('eap:profile-changed',reset);
  window.addEventListener('load',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){patchApis();},500);

  bootstrap();
  window.EAPRoadmapLockGuard={version:VERSION,authorityMode:'server-resume-only',currentRoute:function(){return currentId()?route(currentId()):null;},currentRouteId:currentId,isUnlocked:canOpen,canOpen:canOpen,reason:reason,normalizeRoute:norm,refresh:schedule,diagnostics:diagnostics,acceptResume:acceptResume};
  window.EAP15ReleaseRuntime=window.EAPRoadmapLockGuard;
  schedule();
})();