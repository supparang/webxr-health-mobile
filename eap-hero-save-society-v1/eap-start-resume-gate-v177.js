/* =========================================================
   EAP Hero • Start / Resume Gate v181
   PURPOSE
   - Never leave Start / Continue in an indefinite checking state.
   - Google Sheet remains the only progression authority.
   - A server-verified learner-scoped snapshot is sufficient to Start immediately.
   - Background refresh must never block an already verified route.
   - ID-first resume is allowed: studentId + section are sufficient.
   - IMPORTANT: never intercept the Identity/Profile modal "เรียนต่อ" button.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_START_RESUME_GATE_V181__) return;
  window.__EAP_START_RESUME_GATE_V181__=true;

  var VERSION='20260811-EAP-START-RESUME-GATE-V181-VERIFIED-SNAPSHOT-PASS';
  var CHECK_TIMEOUT=20000;
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE_KEYS=['EAP_HERO_ACTIVE_PLAYER_V1','EAP_ACTIVE_PLAYER','EAP_HERO_ACTIVE_PLAYER'];
  var VALID_ROUTE=/^(?:S(?:1[0-5]|[1-9])|B[1-5])$/;
  var checking=false;
  var checkTimer=0;
  var toastTimer=0;
  var pendingStart=null;
  var allowNextStart=false;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return{};}}
  function authority(){return window.EAPAuthorityRuntime||null;}

  function currentIdentity(){
    var a={};
    for(var i=0;i<ACTIVE_KEYS.length;i++){
      a=read(ACTIVE_KEYS[i]);
      if(clean(a.studentId||a.id)) break;
    }
    var p=read(PROFILE_KEY),s=read(STATE_KEY),cfg=window.EAP_SHEET_CONFIG||{};
    return {
      studentId:clean(a.studentId||a.id||p.studentId||p.id||s.studentId||s.id),
      section:clean(a.section||p.section||s.section||cfg.section||'122')||'122'
    };
  }

  function runtimeVerified(){
    var a=authority();
    try{return !!(a&&typeof a.isVerified==='function'&&a.isVerified());}catch(_){return false;}
  }

  function snapshotVerified(){
    var s=read(STATE_KEY),r=s&&s.serverResume||{},id=currentIdentity();
    var route=clean(r.currentRoute||r.currentCloudRoute||s.currentCloudRoute||s.currentRoute).toUpperCase();
    var resumeId=clean(r.studentId||s.studentId||s.id);
    var resumeSection=clean(r.section||s.section||'122')||'122';
    var verified=!!(
      s.cloudResumeStatus==='ok' &&
      (r.cloudVerified===true||r.serverVerified===true||r.compact===true) &&
      VALID_ROUTE.test(route)
    );
    if(!verified||!id.studentId) return false;
    if(resumeId&&resumeId!==id.studentId) return false;
    if(resumeSection&&resumeSection!==id.section) return false;
    if(r.identityKey&&clean(r.identityKey)!==id.section+'|'+id.studentId) return false;
    return true;
  }

  function verified(){return runtimeVerified()||snapshotVerified();}

  function refresh(force){
    var t=window.EAPPlayerResumeStableJSONP;
    try{if(t&&typeof t.request==='function') return t.request(force===true);}catch(_){}
    var a=authority();
    try{if(a&&typeof a.refresh==='function') return a.refresh();}catch(_){}
    return false;
  }

  function refreshInBackground(){
    setTimeout(function(){try{refresh(false);}catch(_){}},250);
  }

  function isIdentityModalNode(node){
    if(!node||!node.closest) return false;
    return !!node.closest('#eap-profile-modal-v116,#eap-profile-modal-v115,#eap-profile-modal-v114,#eap-profile-modal-v113');
  }
  function isStart(el){
    if(!el) return false;
    var node=el.closest?el.closest('button,a,[role="button"]'):el;
    if(!node) return false;
    if(isIdentityModalNode(node)) return false;
    var label=clean(node.textContent);
    return /^\s*[▶▷►]?\s*start\s*\/\s*continue\s*$/i.test(label) ? node : false;
  }
  function toast(message,kind){
    var old=document.getElementById('eap-start-resume-gate-v177-toast');
    if(old) old.remove();
    var el=document.createElement('div');
    el.id='eap-start-resume-gate-v177-toast';
    el.setAttribute('role','status');
    el.textContent=message;
    el.style.cssText='position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483646;max-width:min(92vw,680px);padding:13px 18px;border-radius:14px;color:#fff;font:800 14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;box-shadow:0 12px 34px rgba(0,0,0,.28);background:'+(kind==='error'?'#b42318':kind==='ok'?'#047857':'#9a3412');
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){try{el.remove();}catch(_){}},kind==='error'?9000:5000);
  }
  function replayPendingStart(){
    var node=pendingStart;
    pendingStart=null;
    if(!node||!node.isConnected) return false;
    allowNextStart=true;
    setTimeout(function(){
      try{node.click();}
      catch(_){allowNextStart=false;}
    },0);
    return true;
  }
  function finishCheck(ok,message,continueStart){
    checking=false;
    clearTimeout(checkTimer);
    if(ok){
      toast(message||'ยืนยันความคืบหน้าจาก Google Sheet แล้ว','ok');
      if(continueStart!==false) replayPendingStart();
    }else{
      pendingStart=null;
      toast(message||'ยังเชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณากด Start / Continue เพื่อลองอีกครั้ง','error');
    }
  }
  function beginCheck(startNode){
    if(checking) return;
    if(verified()){
      refreshInBackground();
      return;
    }
    checking=true;
    pendingStart=startNode||pendingStart;
    toast('กำลังตรวจสอบความคืบหน้าจาก Google Sheet…','checking');
    var started=refresh(true);
    if(started===false){
      finishCheck(false,'ยังไม่สามารถเริ่มการตรวจสอบ Google Sheet ได้ กรุณาลองอีกครั้ง',false);
      return;
    }
    clearTimeout(checkTimer);
    checkTimer=setTimeout(function(){
      if(verified()) finishCheck(true,'ยืนยันความคืบหน้าจาก Google Sheet แล้ว',true);
      else finishCheck(false,'Google Sheet ยังไม่ตอบกลับ ระบบจะไม่เดาเส้นทางให้ กรุณากด Start / Continue เพื่อลองอีกครั้ง',false);
    },CHECK_TIMEOUT);
  }

  window.addEventListener('eap:single-authority-applied',function(){
    if(checking||verified()) finishCheck(true,'ยืนยันความคืบหน้าจาก Google Sheet แล้ว',true);
  });
  window.addEventListener('eap:resume-synced',function(){
    setTimeout(function(){if(verified()&&checking) finishCheck(true,'ยืนยันความคืบหน้าจาก Google Sheet แล้ว',true);},0);
  });
  window.addEventListener('eap:resume-failed',function(event){
    var detail=event&&event.detail||{};
    if(checking&& !snapshotVerified()) finishCheck(false,detail.message||'เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณากด Start / Continue เพื่อลองอีกครั้ง',false);
  });

  document.addEventListener('click',function(event){
    var start=isStart(event.target);
    if(!start) return;

    if(allowNextStart){
      allowNextStart=false;
      return;
    }

    /* PRODUCTION RULE: an already server-verified route must never be blocked by a new network request. */
    if(verified()){
      refreshInBackground();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function') event.stopImmediatePropagation();
    beginCheck(start);
  },true);

  document.documentElement.dataset.eapStartResumeGate=VERSION;
})();
