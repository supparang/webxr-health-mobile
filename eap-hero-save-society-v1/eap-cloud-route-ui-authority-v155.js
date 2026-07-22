/* =========================================================
   EAP Hero • Cloud Route UI Authority v156
   - Google Sheet / Cloud Resume is the sole authority for official progress.
   - Opening an older unlocked session changes only activeViewRoute.
   - It NEVER overwrites currentCloudRoute/currentRoute.
   - Blocks route navigation while authoritative resume is unavailable.
   - Quarantines legacy browser-migration rows from Recent Portfolio UI.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-CLOUD-ROUTE-UI-AUTHORITY-V156';
  var KEY='EAP_HERO_PROGRESS_V3';
  var NOTICE_ID='eap-cloud-route-notice-v156';
  var BAD_OUTPUT=/legacy evidence retained|browser-storage migration|completed legacy evidence/i;
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(_){return{};}}
  function write(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch(_){return false;}}
  function norm(v){
    var t=clean(v).toUpperCase(),m;
    m=t.match(/(?:BOSS\s*GATE|GATE|BOSS|B)\s*([1-5])/);if(m)return'B'+Number(m[1]);
    m=t.match(/(?:SESSION\s*|S)\s*(1[0-5]|[1-9])/);if(m)return'S'+Number(m[1]);
    return'';
  }
  function sessionNo(v){var m=norm(v).match(/^S(\d+)$/);return m?Number(m[1]):0;}
  function gateNo(v){var m=norm(v).match(/^B(\d+)$/);return m?Number(m[1]):0;}
  function cloudReady(s){return !!(s&&s.cloudResumeStatus==='ok'&&s.serverResume&&clean(s.serverResume.resumeKey)&&norm(s.currentCloudRoute));}
  function officialRoute(s){return norm((s||read()).currentCloudRoute||'');}
  function unlocked(id,s){
    s=s||read();id=norm(id);if(!id||!cloudReady(s))return false;
    var ur=s.unlockedRoutes||{},us=s.unlockedSessions||{};
    if(ur[id]===true||(ur[id]&&ur[id].unlocked===true))return true;
    var n=sessionNo(id);if(n&&(us[n]===true||us[String(n)]===true))return true;
    return id===officialRoute(s);
  }
  function setViewRoute(s,id){
    id=norm(id);if(!id)return;
    s.activeViewRoute=id;s.cloudUiAuthorityVersion=VERSION;
    write(s);
    try{localStorage.setItem('EAP_HERO_ACTIVE_VIEW_ROUTE',id);}catch(_){ }
  }
  function notice(msg){
    var old=document.getElementById(NOTICE_ID);if(old)old.remove();
    var n=document.createElement('div');n.id=NOTICE_ID;n.textContent=msg;
    n.style.cssText='position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:999999;padding:13px 18px;max-width:min(660px,calc(100vw - 28px));border-radius:15px;background:#7f1d1d;color:#fff;font:900 14px system-ui;text-align:center;box-shadow:0 16px 36px rgba(0,0,0,.35)';
    document.body.appendChild(n);setTimeout(function(){if(n.isConnected)n.remove();},3500);
  }
  function openRoute(id){
    id=norm(id);var s=read();if(!id)return false;
    if(!cloudReady(s)){notice('กำลังตรวจสอบความคืบหน้าจาก Google Sheet · ยังไม่เปิดด่านจนกว่าจะยืนยันสำเร็จ');return false;}
    if(!unlocked(id,s)){notice(id+' ยังไม่เปิดจาก Google Sheet · ด่านปัจจุบันคือ '+officialRoute(s));return false;}
    setViewRoute(s,id);
    var g=gateNo(id),n=sessionNo(id);
    if(g){
      if(window.EAPBossFourSkillV4&&typeof window.EAPBossFourSkillV4.start==='function'){window.EAPBossFourSkillV4.start(g);return true;}
      if(window.EAPHero&&typeof window.EAPHero.startGateBoss==='function'){window.EAPHero.startGateBoss(id);return true;}
    }
    if(n&&window.EAPHero&&typeof window.EAPHero.skillHub==='function'){window.EAPHero.skillHub(n);return true;}
    setTimeout(function(){openRoute(id);},180);return false;
  }
  function sessionButtons(){
    return Array.from(document.querySelectorAll('#app button,#app a[href],#app [role="button"]')).filter(function(n){return sessionNo(n.textContent)>0;});
  }
  function applyButtons(s){
    var ready=cloudReady(s),current=officialRoute(s);
    sessionButtons().forEach(function(b){
      var id='S'+sessionNo(b.textContent),ok=ready&&unlocked(id,s);
      b.dataset.eapCloudUnlocked=ok?'true':'false';
      b.dataset.eapOfficialCurrent=id===current?'true':'false';
      b.setAttribute('aria-disabled',ok?'false':'true');
      if(!ok){
        b.style.setProperty('opacity','.42','important');b.style.setProperty('filter','grayscale(.65)','important');b.style.setProperty('cursor','not-allowed','important');
        b.title=ready?'ยังไม่เปิดจาก Google Sheet':'กำลังตรวจสอบ Google Sheet';
      }else{
        b.style.removeProperty('opacity');b.style.removeProperty('filter');b.style.removeProperty('cursor');
        b.title=id===current?'ด่านปัจจุบันจาก Google Sheet':'ด่านก่อนหน้าที่เปิดให้ทบทวน';
      }
      if(id===current){b.style.setProperty('outline','3px solid #facc15','important');b.style.setProperty('outline-offset','2px','important');}
      else{b.style.removeProperty('outline');b.style.removeProperty('outline-offset');}
    });
  }
  function hideLegacyPortfolio(){
    document.querySelectorAll('#app table tbody tr').forEach(function(tr){
      var t=clean(tr.textContent);
      if(/Invalid Date/i.test(t)||BAD_OUTPUT.test(t)){tr.remove();}
    });
    document.querySelectorAll('#app [data-legacy-completion="true"],#app .legacy-completion').forEach(function(n){n.remove();});
  }
  function addStatus(s){
    var host=document.querySelector('#app h1,#app h2');if(!host)return;
    var id='eap-official-route-status-v156',box=document.getElementById(id);
    if(!box){box=document.createElement('div');box.id=id;host.insertAdjacentElement('afterend',box);}
    var ready=cloudReady(s),r=officialRoute(s);
    box.textContent=ready?('เส้นทางทางการจาก Google Sheet: '+r+' · การกดด่านเก่าเป็นเพียงการทบทวน ไม่เปลี่ยนความก้าวหน้า'):'กำลังตรวจสอบความก้าวหน้าจาก Google Sheet…';
    box.style.cssText='margin:8px 0 14px;padding:10px 13px;border-radius:12px;background:'+(ready?'#123d2a':'#44330b')+';color:'+(ready?'#bbf7d0':'#fde68a')+';font:800 13px system-ui;border:1px solid '+(ready?'#2f855a':'#a16207');
  }
  function guard(e){
    var b=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!b)return;
    var s=read(),txt=clean(b.textContent),action=clean(b.getAttribute('data-eap-lobby-action'));
    var isContinue=action==='continue'||/^(?:▶\s*)?(?:Start\s*\/\s*Continue|Continue Session|Continue)$/i.test(txt);
    var n=sessionNo(txt);
    if(!isContinue&&!n)return;
    e.preventDefault();e.stopImmediatePropagation();e.stopPropagation();
    if(!cloudReady(s)){notice('กำลังตรวจสอบความคืบหน้าจาก Google Sheet · กรุณารอให้ระบบยืนยันก่อน');return false;}
    if(isContinue){openRoute(officialRoute(s));return false;}
    openRoute('S'+n);return false;
  }
  function reconcile(){
    var s=read();
    applyButtons(s);hideLegacyPortfolio();addStatus(s);
    window.EAPCloudRouteUIAuthority={version:VERSION,route:function(){return officialRoute(read());},open:function(){return openRoute(officialRoute(read()));},unlocked:function(id){return unlocked(id,read());},diagnostics:function(){var x=read();return{route:officialRoute(x),cloudReady:cloudReady(x),activeViewRoute:x.activeViewRoute,currentCloudRoute:x.currentCloudRoute,unlockedRoutes:x.unlockedRoutes,sessionProgress:x.sessionProgress};}};
    document.documentElement.dataset.eapCloudRouteUiAuthorityVersion=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(reconcile,90);}
  document.addEventListener('click',guard,true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced'].forEach(function(n){window.addEventListener(n,schedule);});
  setTimeout(reconcile,80);setTimeout(reconcile,700);setTimeout(reconcile,1800);setInterval(reconcile,2500);
})();