/* =========================================================
   EAP Hero • Cloud Route UI Authority v155
   - Google Sheet / Cloud Resume is the single source of truth.
   - Uses currentCloudRoute, unlockedRoutes and sessionProgress restored by
     eap-player-resume-v1.js.
   - Keeps Lobby, Continue and Session buttons consistent.
   - Does not rebuild or overwrite official progress from local portfolio.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-CLOUD-ROUTE-UI-AUTHORITY-V155';
  var KEY='EAP_HERO_PROGRESS_V3';
  var NOTICE_ID='eap-cloud-route-notice-v155';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}}
  function write(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch(_){return false;}}
  function norm(v){
    var t=clean(v).toUpperCase();
    var g=t.match(/(?:BOSS\s*GATE|GATE|BOSS|B)\s*([1-5])/);if(g)return'B'+Number(g[1]);
    var s=t.match(/(?:SESSION\s*|S)\s*(1[0-5]|[1-9])/);if(s)return'S'+Number(s[1]);
    return'';
  }
  function sessionNo(v){var m=norm(v).match(/^S(\d+)$/);return m?Number(m[1]):0;}
  function gateNo(v){var m=norm(v).match(/^B(\d+)$/);return m?Number(m[1]):0;}
  function cloudReady(state){return state&&state.cloudResumeStatus==='ok'&&state.serverResume&&clean(state.serverResume.resumeKey);}
  function route(state){
    state=state||read();
    var r=norm(state.currentCloudRoute||'');
    if(r)return r;
    var order=['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
    var progress=state.sessionProgress||{};
    for(var i=0;i<order.length;i++){
      var id=order[i],row=progress[id]||progress[String(sessionNo(id))]||{};
      if(!(row.completed===true||row.complete===true||row.passed===true))return id;
    }
    return'B5';
  }
  function unlocked(id,state){
    state=state||read();id=norm(id);if(!id)return false;
    var ur=state.unlockedRoutes||{},us=state.unlockedSessions||{};
    if(ur[id]===true||(ur[id]&&ur[id].unlocked===true))return true;
    var n=sessionNo(id);if(n&&(us[n]===true||us[String(n)]===true))return true;
    return id===route(state);
  }
  function persistCloudRoute(state,id){
    id=norm(id);if(!id)return;
    state.currentRoute=id;state.activeRoute=id;state.cloudUiAuthorityVersion=VERSION;
    if(sessionNo(id))state.currentSession=sessionNo(id);
    write(state);
    try{localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',id);localStorage.setItem('EAP_HERO_CURRENT_ROUTE',id);}catch(_){ }
  }
  function notice(msg){
    var old=document.getElementById(NOTICE_ID);if(old)old.remove();
    var n=document.createElement('div');n.id=NOTICE_ID;n.textContent=msg;
    n.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:999999;padding:13px 18px;max-width:min(620px,calc(100vw - 28px));border-radius:15px;background:#7f1d1d;color:#fff;font:900 14px system-ui;text-align:center;box-shadow:0 16px 36px rgba(0,0,0,.35)';
    document.body.appendChild(n);setTimeout(function(){if(n.isConnected)n.remove();},3200);
  }
  function openRoute(id){
    id=norm(id);var state=read();if(!id)return false;
    persistCloudRoute(state,id);
    var g=gateNo(id),s=sessionNo(id);
    if(g){
      if(window.EAPBossFourSkillV4&&typeof window.EAPBossFourSkillV4.start==='function'){window.EAPBossFourSkillV4.start(g);return true;}
      if(window.EAPHero&&typeof window.EAPHero.startGateBoss==='function'){window.EAPHero.startGateBoss(id);return true;}
    }
    if(s){
      if(window.EAPHero&&typeof window.EAPHero.skillHub==='function'){window.EAPHero.skillHub(s);return true;}
    }
    setTimeout(function(){openRoute(id);},180);return false;
  }
  function lobbyUpdate(state,id){
    var panel=document.getElementById('eap-student-compact-lobby');if(!panel)return;
    var title=panel.querySelector('.lob-title'),meta=panel.querySelector('.lob-meta');
    var s=sessionNo(id),g=gateNo(id);
    if(title)title.textContent=s?('Week '+s+' / S'+s):('B'+g+' Boss Gate');
    if(meta)meta.textContent=s?'เรียนต่อจากความคืบหน้าที่ Google Sheet ยืนยันแล้ว':'Checkpoint ก่อนเข้าสู่ช่วง Session ถัดไป';
  }
  function sessionButtons(){
    return [...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].filter(function(n){return sessionNo(n.textContent)>0;});
  }
  function applyButtons(state,id){
    sessionButtons().forEach(function(b){
      var sid='S'+sessionNo(b.textContent),ok=unlocked(sid,state);
      b.dataset.eapCloudUnlocked=ok?'true':'false';
      b.setAttribute('aria-disabled',ok?'false':'true');
      if(!ok){b.style.setProperty('opacity','.48','important');b.style.setProperty('filter','grayscale(.55)','important');b.style.setProperty('cursor','not-allowed','important');b.title='ยังไม่เปิดจาก Google Sheet';}
      else{b.style.removeProperty('opacity');b.style.removeProperty('filter');b.style.removeProperty('cursor');if(b.title==='ยังไม่เปิดจาก Google Sheet')b.removeAttribute('title');}
    });
  }
  function guard(e){
    var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
    var state=read();
    if(!cloudReady(state))return;
    var text=clean(b.textContent),action=clean(b.getAttribute('data-eap-lobby-action'));
    if(action==='continue'||/^(?:▶\s*)?(?:Start\s*\/\s*Continue|Continue Session|Continue)$/i.test(text)){
      e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();openRoute(route(state));return false;
    }
    var n=sessionNo(text);if(!n)return;
    var id='S'+n;
    if(!unlocked(id,state)){
      e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
      notice(id+' ยังไม่เปิดจาก Google Sheet · ตอนนี้ควรทำ '+route(state));return false;
    }
  }
  function reconcile(){
    var state=read();
    if(!cloudReady(state))return;
    var id=route(state);persistCloudRoute(state,id);lobbyUpdate(state,id);applyButtons(state,id);
    window.EAPCloudRouteUIAuthority={version:VERSION,route:function(){return route(read());},open:function(){return openRoute(route(read()));},unlocked:function(id){return unlocked(id,read());},diagnostics:function(){var s=read();return{route:route(s),cloudReady:cloudReady(s),currentCloudRoute:s.currentCloudRoute,unlockedRoutes:s.unlockedRoutes,sessionProgress:s.sessionProgress};}};
    document.documentElement.dataset.eapCloudRouteUiAuthorityVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,100);}
  document.addEventListener('click',guard,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(reconcile,100);setTimeout(reconcile,900);setTimeout(reconcile,2200);
})();