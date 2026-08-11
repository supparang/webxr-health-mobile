/* =========================================================
   EAP Hero • Start / Resume Gate v180
   PURPOSE
   - Never leave Start / Continue in an indefinite checking state.
   - Google Sheet remains the only progression authority.
   - ID-first resume is allowed: studentId + section are sufficient.
   - Gate timeout is longer than the transport timeout.
   - IMPORTANT: never intercept the Identity/Profile modal "เรียนต่อ" button.
   - ONE CLICK: after Sheet verification, continue the original Start action once.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_START_RESUME_GATE_V180__) return;
  window.__EAP_START_RESUME_GATE_V180__=true;

  var VERSION='20260811-EAP-START-RESUME-GATE-V180-ONE-CLICK-CONTINUE';
  var CHECK_TIMEOUT=50000;
  var checking=false;
  var checkTimer=0;
  var toastTimer=0;
  var pendingStart=null;
  var allowNextStart=false;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function authority(){return window.EAPAuthorityRuntime||null;}
  function verified(){
    var a=authority();
    try{return !!(a&&typeof a.isVerified==='function'&&a.isVerified());}catch(_){return false;}
  }
  function refresh(){
    var t=window.EAPPlayerResumeStableJSONP;
    try{if(t&&typeof t.request==='function') return t.request(true);}catch(_){}
    var a=authority();
    try{if(a&&typeof a.refresh==='function') return a.refresh();}catch(_){}
    return false;
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
    checking=true;
    pendingStart=startNode||pendingStart;
    toast('กำลังตรวจสอบความคืบหน้าจาก Google Sheet…','checking');
    var started=refresh();
    if(started===false){
      var diag=window.EAPPlayerResumeStableJSONP&&window.EAPPlayerResumeStableJSONP.diagnostics;
      var extra='';
      try{if(typeof diag==='function'){var d=diag();if(d&&d.profile)extra=' · '+(d.profile.studentId||'?')+' / '+(d.profile.section||'?');}}catch(_){}
      finishCheck(false,'ยังไม่สามารถเริ่มการตรวจสอบ Google Sheet ได้'+extra+' กรุณาลองอีกครั้ง',false);
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
    if(checking) finishCheck(false,detail.message||'เชื่อมต่อ Google Sheet ไม่สำเร็จ กรุณากด Start / Continue เพื่อลองอีกครั้ง',false);
  });

  document.addEventListener('click',function(event){
    var start=isStart(event.target);
    if(!start) return;

    if(allowNextStart){
      allowNextStart=false;
      return;
    }

    if(verified()) return;

    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function') event.stopImmediatePropagation();
    beginCheck(start);
  },true);

  document.documentElement.dataset.eapStartResumeGate=VERSION;
})();
