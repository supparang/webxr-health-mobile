/* =========================================================
   EAP Hero • Lobby Cloud Loading Truth v159
   - Never displays fallback S1 as an official route while Cloud Resume is loading.
   - Disables Start / Continue until Google Sheet confirms progress.
   - After confirmation, displays only currentCloudRoute from the server resume.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_LOBBY_CLOUD_LOADING_TRUTH_V159__) return;
  window.__EAP_LOBBY_CLOUD_LOADING_TRUTH_V159__ = true;

  var VERSION='20260722-EAP-LOBBY-CLOUD-LOADING-TRUTH-V159';
  var KEY='EAP_HERO_PROGRESS_V3';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}}
  function norm(v){
    var s=clean(v).toUpperCase(),m;
    m=s.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);if(m)return'S'+Number(m[1]);
    m=s.match(/^B(?:OSS(?:\s*GATE)?)?\s*0?([1-5])$/i);if(m)return'B'+Number(m[1]);
    return'';
  }
  function ready(s){return !!(s&&s.cloudResumeStatus==='ok'&&s.serverResume&&clean(s.serverResume.resumeKey)&&norm(s.currentCloudRoute));}
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
  function apply(){
    var lobby=document.getElementById('eap-student-compact-lobby');
    if(!lobby)return;
    var s=read(),ok=ready(s),rid=ok?norm(s.currentCloudRoute):'';
    var now=lobby.querySelector('.lob-now');
    var title=now&&now.querySelector('.lob-title');
    var metas=now&&now.querySelectorAll('.lob-meta');
    var hint=now&&now.querySelector('.profile-hint');
    var kicker=now&&now.querySelector('.lob-kicker');
    var btn=lobby.querySelector('[data-eap-lobby-action="continue"]');

    lobby.dataset.eapCloudReady=ok?'true':'false';
    lobby.dataset.eapLobbyTruthVersion=VERSION;

    if(!ok){
      if(kicker)kicker.textContent='กำลังตรวจสอบ';
      if(title)title.textContent='กำลังโหลดความคืบหน้าจาก Google Sheet…';
      if(metas&&metas[0])metas[0].textContent='ยังไม่กำหนดด่านจนกว่าจะได้รับคำตอบจาก Server';
      if(hint)hint.textContent='กรุณารอสักครู่ ระบบจะไม่เดาเป็น S1 และจะไม่เปิดด่านก่อนยืนยันสำเร็จ';
      if(btn){
        btn.disabled=true;
        btn.setAttribute('aria-disabled','true');
        btn.textContent='⏳ กำลังตรวจสอบความคืบหน้า';
        btn.style.setProperty('opacity','.62','important');
        btn.style.setProperty('cursor','wait','important');
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
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,60);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced','eap:profile-changed'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(apply,80);setTimeout(apply,500);setInterval(apply,1500);
})();
