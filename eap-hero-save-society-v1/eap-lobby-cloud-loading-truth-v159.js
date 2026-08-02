/* =========================================================
   EAP Hero • Lobby Cloud Loading Truth v160
   - Google Sheet remains the sole progress authority.
   - Restores the last official player_resume cache immediately when available.
   - Refreshes the server in the background instead of blocking the learner.
   - Never derives route or unlocks from local mission evidence.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_LOBBY_CLOUD_LOADING_TRUTH_V160__) return;
  window.__EAP_LOBBY_CLOUD_LOADING_TRUTH_V160__ = true;

  var VERSION='20260802-EAP-LOBBY-CLOUD-LOADING-TRUTH-V160-OFFICIAL-CACHE-RESTORE';
  var KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var CACHE_PREFIX='EAP_HERO_SERVER_RESUME_CACHE_V5_';
  var timer=0;
  var startedAt=Date.now();

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function readKey(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return{};}}
  function writeKey(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function read(){return readKey(KEY);}
  function norm(v){
    var s=clean(v).toUpperCase(),m;
    m=s.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);if(m)return'S'+Number(m[1]);
    m=s.match(/^B(?:OSS(?:\s*GATE)?)?\s*0?([1-5])$/i);if(m)return'B'+Number(m[1]);
    return'';
  }
  function profile(){
    var p=readKey(PROFILE_KEY),s=read();
    return {
      studentId:clean(p.studentId||p.id||s.studentId||s.id||''),
      section:clean(p.section||s.section||'122')||'122'
    };
  }
  function cacheKey(){
    var p=profile();
    if(!p.studentId)return'';
    return CACHE_PREFIX+encodeURIComponent(p.section+'__'+p.studentId);
  }
  function compact(data){
    data=data||{};
    var rid=norm(data.currentCloudRoute||data.currentRoute||data.nextRoute);
    var records=Array.isArray(data.records)?data.records.slice(0,80):[];
    return {
      ok:true,
      resumeKey:clean(data.resumeKey||data.serverRevision||data.generatedAt||data.checkedAt||Date.now()),
      acceptedAt:new Date().toISOString(),
      currentRoute:rid,
      currentCloudRoute:rid,
      nextRoute:norm(data.nextRoute||rid)||rid,
      records:records,
      recordCount:records.length,
      unlockedRoutes:data.unlockedRoutes||data.unlockedRouteIds||{},
      cloudVerified:true,
      serverVerified:true,
      authorityMode:'sheet-only',
      version:clean(data.version||'')
    };
  }
  function restoreOfficialCache(){
    var s=read();
    if(ready(s))return s;
    var key=cacheKey();
    if(!key)return s;
    var cached=readKey(key);
    var rid=norm(cached.currentCloudRoute||cached.currentRoute||cached.nextRoute);
    if(cached.ok!==true||!rid)return s;
    var c=compact(cached);
    s.cloudResumeStatus='ok';
    s.cloudResumeRequired=true;
    s.cloudFirst=true;
    s.currentCloudRoute=rid;
    s.currentRoute=rid;
    s.activeRoute=rid;
    s.unlockedRoutes=c.unlockedRoutes;
    s.serverResume=c;
    s.portfolio=Array.isArray(s.portfolio)?s.portfolio:[];
    writeKey(KEY,s);
    try{window.dispatchEvent(new CustomEvent('eap:official-cache-restored',{detail:{data:c,currentRoute:rid}}));}catch(_){}
    return s;
  }
  function ready(s){
    if(!s||s.cloudResumeStatus!=='ok')return false;
    var rid=norm(s.currentCloudRoute||s.currentRoute);
    if(!rid)return false;
    var r=s.serverResume||{};
    return !!(clean(r.resumeKey)||r.cloudVerified===true||r.serverVerified===true||Array.isArray(r.records));
  }
  function routeDef(id){
    var p=window.EAP_HERO_SESSION_CONTENT_PACK;
    if(!p||!Array.isArray(p.routes))return null;
    id=norm(id);
    return p.routes.find(function(r){return norm(r.routeId)===id;})||null;
  }
  function label(id){
    id=norm(id);
    if(/^S/.test(id))return'Week '+Number(id.slice(1))+' / '+id;
    if(/^B/.test(id))return id+' Boss Gate';
    return'';
  }
  function requestRefresh(){
    try{
      if(window.EAPPlayerResumeStableJSONP&&typeof window.EAPPlayerResumeStableJSONP.request==='function'){
        window.EAPPlayerResumeStableJSONP.request(true);
      }else if(window.EAPPlayerResume&&typeof window.EAPPlayerResume.sync==='function'){
        window.EAPPlayerResume.sync({force:true,silent:true});
      }
    }catch(_){}
  }
  function apply(){
    var lobby=document.getElementById('eap-student-compact-lobby');
    if(!lobby)return;
    var s=restoreOfficialCache(),ok=ready(s),rid=ok?norm(s.currentCloudRoute||s.currentRoute):'';
    var now=lobby.querySelector('.lob-now');
    var title=now&&now.querySelector('.lob-title');
    var metas=now&&now.querySelectorAll('.lob-meta');
    var hint=now&&now.querySelector('.profile-hint');
    var kicker=now&&now.querySelector('.lob-kicker');
    var btn=lobby.querySelector('[data-eap-lobby-action="continue"]');

    lobby.dataset.eapCloudReady=ok?'true':'false';
    lobby.dataset.eapLobbyTruthVersion=VERSION;

    if(!ok){
      var slow=Date.now()-startedAt>12000;
      if(kicker)kicker.textContent=slow?'การเชื่อมต่อช้า':'กำลังตรวจสอบ';
      if(title)title.textContent=slow?'ยังรอคำตอบจาก Google Sheet':'กำลังโหลดความคืบหน้าจาก Google Sheet…';
      if(metas&&metas[0])metas[0].textContent='ยังไม่กำหนดด่านจนกว่าจะได้รับคำตอบจาก Server';
      if(hint)hint.textContent=slow?'กดตรวจสอบอีกครั้งได้ โดยระบบจะไม่เดาความคืบหน้าเอง':'กรุณารอสักครู่ ระบบจะไม่เดาเป็น S1 และจะไม่เปิดด่านก่อนยืนยันสำเร็จ';
      if(btn){
        btn.disabled=!slow;
        btn.setAttribute('aria-disabled',slow?'false':'true');
        btn.textContent=slow?'↻ ตรวจสอบ Google Sheet อีกครั้ง':'⏳ กำลังตรวจสอบความคืบหน้า';
        btn.style.setProperty('opacity',slow?'1':'.62','important');
        btn.style.setProperty('cursor',slow?'pointer':'wait','important');
        if(slow&&!btn.dataset.eapRetryBound){
          btn.dataset.eapRetryBound='1';
          btn.addEventListener('click',function(event){
            if(ready(read()))return;
            event.preventDefault();event.stopPropagation();
            startedAt=Date.now();requestRefresh();schedule();
          },true);
        }
      }
      return;
    }

    var def=routeDef(rid);
    if(kicker)kicker.textContent='ตอนนี้';
    if(title)title.textContent=label(rid);
    if(metas&&metas[0])metas[0].textContent=clean(def&&def.title||rid);
    if(hint)hint.textContent='ความคืบหน้ายืนยันจาก Google Sheet แล้ว · กด Start / Continue เพื่อเล่น '+rid;
    if(btn){
      btn.disabled=false;
      btn.setAttribute('aria-disabled','false');
      btn.textContent='▶ Start / Continue';
      btn.style.removeProperty('opacity');
      btn.style.removeProperty('cursor');
      btn.dataset.eapOfficialRoute=rid;
    }
    requestRefresh();
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,60);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced','eap:cloud-resume-applied','eap:official-cache-restored','eap:profile-changed'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(apply,80);setTimeout(apply,500);setInterval(apply,1500);
})();
