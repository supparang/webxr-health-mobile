/* =========================================================
   EAP Hero • Cloud Route UI Authority v159
   FIX 2026-08-12
   - EAP_Progress / Authority Runtime is the single route authority.
   - A verified serverResume is sufficient; stale cloudResumeStatus cannot
     block navigation or show an endless Google Sheet waiting message.
   - Current official route is always open; prior unlocked routes remain reviewable.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260812-EAP-CLOUD-ROUTE-UI-AUTHORITY-V159-SERVER-VERIFIED';
  var KEY='EAP_HERO_PROGRESS_V3';
  var NOTICE_ID='eap-cloud-route-notice-v157';
  var BAD_OUTPUT=/legacy evidence retained|browser-storage migration|completed legacy evidence/i;
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}}
  function write(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch(_){return false;}}
  function norm(v){var t=clean(v).toUpperCase(),m;m=t.match(/(?:BOSS\s*GATE|GATE|BOSS|B)\s*([1-5])/);if(m)return'B'+Number(m[1]);m=t.match(/(?:SESSION\s*|S)\s*(1[0-5]|[1-9])/);if(m)return'S'+Number(m[1]);return'';}
  function sessionNo(v){var m=norm(v).match(/^S(\d+)$/);return m?Number(m[1]):0;}
  function gateNo(v){var m=norm(v).match(/^B(\d+)$/);return m?Number(m[1]):0;}
  function runtimeVerified(){var a=window.EAPAuthorityRuntime;try{return !!(a&&typeof a.isVerified==='function'&&a.isVerified());}catch(_){return false;}}
  function runtimeRoute(){var a=window.EAPAuthorityRuntime;try{return norm(a&&typeof a.currentRoute==='function'?a.currentRoute():'');}catch(_){return'';}}
  function verifiedSnapshot(s){
    s=s||read();var r=s.serverResume||{};
    var route=norm(r.currentRoute||r.currentCloudRoute||r.nextRoute||s.currentRoute||s.currentCloudRoute);
    if(!route)return false;
    return !!(r.serverVerified===true||r.cloudVerified===true||r.compact===true||r.routeProgress||clean(r.version));
  }
  function cloudReady(s){return runtimeVerified()||verifiedSnapshot(s);}
  function officialRoute(s){s=s||read();var r=s.serverResume||{};return runtimeRoute()||norm(r.currentRoute||r.currentCloudRoute||r.nextRoute||s.currentCloudRoute||s.currentRoute||'');}
  function unlocked(id,s){
    s=s||read();id=norm(id);if(!id||!cloudReady(s))return false;
    var current=officialRoute(s);if(id===current)return true;
    var ur=s.unlockedRoutes||{},us=s.unlockedSessions||{},r=s.serverResume||{},rr=r.unlockedRoutes||{};
    if(ur[id]===true||(ur[id]&&ur[id].unlocked===true)||rr[id]===true)return true;
    var n=sessionNo(id);if(n&&(us[n]===true||us[String(n)]===true))return true;
    return false;
  }
  function setViewRoute(s,id){id=norm(id);if(!id)return;s.activeViewRoute=id;s.cloudUiAuthorityVersion=VERSION;write(s);try{localStorage.setItem('EAP_HERO_ACTIVE_VIEW_ROUTE',id);}catch(_){}}
  function notice(msg){var old=document.getElementById(NOTICE_ID);if(old)old.remove();var n=document.createElement('div');n.id=NOTICE_ID;n.textContent=msg;n.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:999999;padding:13px 18px;max-width:min(660px,calc(100vw - 28px));border-radius:15px;background:#7f1d1d;color:#fff;font:900 14px system-ui;text-align:center;box-shadow:0 16px 36px rgba(0,0,0,.35)';document.body.appendChild(n);setTimeout(function(){if(n.isConnected)n.remove();},2500);}
  function openRoute(id){
    id=norm(id);var s=read();if(!id)return false;
    if(!cloudReady(s)){
      /* Do not trap the learner in an endless UI wait. Ask the canonical
         authority for one refresh and let the next verified event reopen. */
      try{if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.refresh==='function')window.EAPAuthorityRuntime.refresh();}catch(_){}
      notice('กำลังยืนยันเส้นทางล่าสุดจาก Google Sheet');return false;
    }
    if(!unlocked(id,s)){notice(id+' ยังไม่เปิดจาก Google Sheet · ด่านปัจจุบันคือ '+officialRoute(s));return false;}
    setViewRoute(s,id);
    var g=gateNo(id),n=sessionNo(id);
    if(g){
      try{if(window.EAPBossFourSkillV4&&typeof window.EAPBossFourSkillV4.start==='function'){window.EAPBossFourSkillV4.start(g);return true;}}catch(_){}
      try{if(window.EAPHero&&typeof window.EAPHero.startGateBoss==='function'){window.EAPHero.startGateBoss(id);return true;}}catch(_){}
    }
    if(n){try{if(window.EAPHero&&typeof window.EAPHero.skillHub==='function'){window.EAPHero.skillHub(n);return true;}}catch(_){}}
    return false;
  }
  function sessionButtons(){return Array.from(document.querySelectorAll('#app button,#app a[href],#app [role="button"]')).filter(function(n){return sessionNo(n.textContent)>0;});}
  function applyButtons(s){var ready=cloudReady(s),current=officialRoute(s);sessionButtons().forEach(function(b){var id='S'+sessionNo(b.textContent),ok=ready&&unlocked(id,s);b.dataset.eapCloudUnlocked=ok?'true':'false';b.dataset.eapOfficialCurrent=id===current?'true':'false';b.setAttribute('aria-disabled',ok?'false':'true');if(!ok){b.style.setProperty('opacity','.42','important');b.style.setProperty('filter','grayscale(.65)','important');b.style.setProperty('cursor','not-allowed','important');b.title=ready?'ยังไม่เปิดจาก Google Sheet':'กำลังยืนยันเส้นทางล่าสุด';}else{b.style.removeProperty('opacity');b.style.removeProperty('filter');b.style.removeProperty('cursor');b.title=id===current?'ด่านปัจจุบันจาก Google Sheet':'ด่านก่อนหน้าที่เปิดให้ทบทวน';}if(id===current){b.style.setProperty('outline','3px solid #facc15','important');b.style.setProperty('outline-offset','2px','important');}else{b.style.removeProperty('outline');b.style.removeProperty('outline-offset');}});}
  function hideLegacyPortfolio(){document.querySelectorAll('#app table tbody tr').forEach(function(tr){var t=clean(tr.textContent);if(/Invalid Date/i.test(t)||BAD_OUTPUT.test(t))tr.remove();});}
  function addStatus(s){var host=document.querySelector('#app h1,#app h2');if(!host)return;var id='eap-official-route-status-v156',box=document.getElementById(id);if(!box){box=document.createElement('div');box.id=id;host.insertAdjacentElement('afterend',box);}var ready=cloudReady(s),r=officialRoute(s);box.textContent=ready?('เส้นทางทางการจาก Google Sheet: '+r+' · พร้อมเรียนต่อ'):'กำลังยืนยันเส้นทางล่าสุดจาก Google Sheet…';box.style.cssText='margin:8px 0 14px;padding:10px 13px;border-radius:12px;background:'+(ready?'#123d2a':'#44330b')+';color:'+(ready?'#bbf7d0':'#fde68a')+';font:800 13px system-ui;border:1px solid '+(ready?'#2f855a':'#a16207');}
  function guard(e){
    var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
    var s=read(),txt=clean(b.textContent),action=clean(b.getAttribute('data-eap-lobby-action'));
    var isContinue=action==='continue'||/^(?:▶\s*)?(?:Start\s*\/\s*Continue|Continue Session|Continue)$/i.test(txt),n=sessionNo(txt);
    if(!isContinue&&!n)return;
    if(!cloudReady(s)){
      e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
      try{if(window.EAPAuthorityRuntime&&typeof window.EAPAuthorityRuntime.refresh==='function')window.EAPAuthorityRuntime.refresh();}catch(_){}
      notice('กำลังยืนยันเส้นทางล่าสุดจาก Google Sheet');return false;
    }
    e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
    if(isContinue){openRoute(officialRoute(s));return false;}openRoute('S'+n);return false;
  }
  function reconcile(){var s=read();applyButtons(s);hideLegacyPortfolio();addStatus(s);if(cloudReady(s)){try{document.documentElement.dataset.eapCloudResumeReady='true';window.dispatchEvent(new CustomEvent('eap:cloud-route-ready',{detail:{route:officialRoute(s),version:VERSION}}));}catch(_){}}window.EAPCloudRouteUIAuthority={version:VERSION,route:function(){return officialRoute(read());},open:function(){return openRoute(officialRoute(read()));},unlocked:function(id){return unlocked(id,read());},ready:function(){return cloudReady(read());},diagnostics:function(){var x=read();return{route:officialRoute(x),ready:cloudReady(x),runtimeVerified:runtimeVerified(),verifiedSnapshot:verifiedSnapshot(x),serverResume:x.serverResume};}};document.documentElement.dataset.eapCloudRouteUiAuthorityVersion=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,90);}
  document.addEventListener('click',guard,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced','eap:single-authority-applied'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(reconcile,80);setTimeout(reconcile,700);setTimeout(reconcile,1800);setInterval(reconcile,1800);
})();