/* =========================================================
   EAP Hero • Start / Resume Gate v183
   VERSION: 20260812-EAP-START-RESUME-GATE-V183-PROGRESS-V150

   PURPOSE
   - EAP_Progress v150 is the progression authority.
   - Start / Continue must never wait on legacy v144/v146 verification flags.
   - A successful player_resume response with a valid currentRoute is authoritative.
   - Persist a verified server snapshot for legacy UI compatibility.
   - Direct JSONP fallback bypasses stale authority runtimes.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_START_RESUME_GATE_V183__) return;
  window.__EAP_START_RESUME_GATE_V183__=true;

  var VERSION='20260812-EAP-START-RESUME-GATE-V183-PROGRESS-V150';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE_KEYS=['EAP_HERO_ACTIVE_PLAYER_V1','EAP_ACTIVE_PLAYER','EAP_HERO_ACTIVE_PLAYER'];
  var VALID_ROUTE=/^(?:S(?:1[0-5]|[1-9])|B[1-5])$/;
  var CHECK_TIMEOUT=12000;
  var checking=false;
  var pendingStart=null;
  var allowNextStart=false;
  var toastTimer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return {};}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v||{}));return true;}catch(_){return false;}}

  function identity(){
    var a={};
    for(var i=0;i<ACTIVE_KEYS.length;i++){
      a=read(ACTIVE_KEYS[i]);
      if(clean(a.studentId||a.id))break;
    }
    var p=read(PROFILE_KEY),s=read(STATE_KEY),cfg=window.EAP_SHEET_CONFIG||{};
    return {
      studentId:clean(a.studentId||a.id||p.studentId||p.id||s.studentId||s.id),
      section:clean(a.section||p.section||s.section||cfg.section||'122')||'122'
    };
  }

  function validResume(r,id){
    r=r||{}; id=id||identity();
    var route=clean(r.currentRoute||r.currentCloudRoute).toUpperCase();
    var resumeId=clean(r.studentId||id.studentId);
    var resumeSection=clean(r.section||id.section||'122')||'122';
    if(r.ok===false||!VALID_ROUTE.test(route)||!id.studentId)return false;
    if(resumeId&&resumeId!==id.studentId)return false;
    if(resumeSection&&resumeSection!==id.section)return false;
    return !!(
      r.ok===true ||
      r.authorityMode==='EAP_Progress-single-source-of-truth' ||
      r.service==='eap-progress-authority' ||
      r.serverVerified===true || r.cloudVerified===true || r.compact===true
    );
  }

  function snapshotVerified(){
    var s=read(STATE_KEY),r=s.serverResume||{};
    return validResume(r,identity());
  }

  function endpoint(){return clean(window.EAP_SHEET_CONFIG&&window.EAP_SHEET_CONFIG.webAppUrl);}

  function saveResume(r){
    var id=identity();
    if(!validResume(r,id))return false;
    var route=clean(r.currentRoute||r.currentCloudRoute).toUpperCase();
    var normalized=Object.assign({},r,{
      ok:true,
      studentId:id.studentId,
      section:id.section,
      currentRoute:route,
      currentCloudRoute:route,
      serverVerified:true,
      cloudVerified:true,
      identityKey:id.section+'|'+id.studentId,
      authorityMode:r.authorityMode||'EAP_Progress-single-source-of-truth'
    });
    var state=read(STATE_KEY);
    state.serverResume=normalized;
    state.cloudResumeStatus='verified';
    state.currentRoute=route;
    state.currentCloudRoute=route;
    state.studentId=id.studentId;
    state.section=id.section;
    write(STATE_KEY,state);
    try{window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:normalized}));}catch(_){}
    try{window.dispatchEvent(new CustomEvent('eap:single-authority-applied',{detail:normalized}));}catch(_){}
    return true;
  }

  function requestProgress(){
    return new Promise(function(resolve,reject){
      var id=identity(),url=endpoint();
      if(!id.studentId){reject(new Error('Student ID is missing'));return;}
      if(!url){reject(new Error('EAP Web App URL is missing'));return;}
      var cb='__eapProgressGate_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      var script=document.createElement('script');
      var done=false;
      var timer=setTimeout(function(){finish(new Error('player_resume timeout'));},CHECK_TIMEOUT);
      function finish(err,data){
        if(done)return; done=true; clearTimeout(timer);
        try{delete window[cb];}catch(_){window[cb]=undefined;}
        try{script.remove();}catch(_){}
        if(err)reject(err); else resolve(data||{});
      }
      window[cb]=function(data){finish(null,data);};
      script.onerror=function(){finish(new Error('player_resume network error'));};
      script.src=url+'?action=player_resume&studentId='+encodeURIComponent(id.studentId)+'&section='+encodeURIComponent(id.section)+'&callback='+encodeURIComponent(cb)+'&_gate='+Date.now();
      document.head.appendChild(script);
    });
  }

  function isIdentityModalNode(node){
    return !!(node&&node.closest&&node.closest('#eap-profile-modal-v116,#eap-profile-modal-v115,#eap-profile-modal-v114,#eap-profile-modal-v113'));
  }
  function isStart(el){
    if(!el)return false;
    var node=el.closest?el.closest('button,a,[role="button"]'):el;
    if(!node||isIdentityModalNode(node))return false;
    return /^\s*[▶▷►]?\s*start\s*\/\s*continue\s*$/i.test(clean(node.textContent))?node:false;
  }

  function toast(message,kind){
    var old=document.getElementById('eap-start-resume-gate-v177-toast');
    if(old)old.remove();
    var el=document.createElement('div');
    el.id='eap-start-resume-gate-v177-toast';
    el.setAttribute('role','status');
    el.textContent=message;
    el.style.cssText='position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483646;max-width:min(92vw,680px);padding:13px 18px;border-radius:14px;color:#fff;font:800 14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;box-shadow:0 12px 34px rgba(0,0,0,.28);background:'+(kind==='error'?'#b42318':kind==='ok'?'#047857':'#9a3412');
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){try{el.remove();}catch(_){}},kind==='error'?8000:3500);
  }

  function replay(){
    var node=pendingStart; pendingStart=null;
    if(!node||!node.isConnected)return;
    allowNextStart=true;
    setTimeout(function(){try{node.click();}catch(_){allowNextStart=false;}},0);
  }

  async function beginCheck(node){
    if(checking)return;
    pendingStart=node;
    if(snapshotVerified()){replay();return;}
    checking=true;
    toast('กำลังตรวจสอบความคืบหน้าจาก Google Sheet…','checking');
    try{
      var resume=await requestProgress();
      if(!saveResume(resume))throw new Error('Invalid EAP_Progress resume response');
      checking=false;
      toast('ยืนยันความคืบหน้าจาก Google Sheet แล้ว','ok');
      replay();
    }catch(err){
      checking=false; pendingStart=null;
      console.error('[EAP Start Gate v183]',err);
      toast('ยังเชื่อมต่อ EAP_Progress ไม่สำเร็จ กรุณากด Start / Continue เพื่อลองอีกครั้ง','error');
    }
  }

  document.addEventListener('click',function(event){
    var start=isStart(event.target);
    if(!start)return;
    if(allowNextStart){allowNextStart=false;return;}
    if(snapshotVerified())return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    beginCheck(start);
  },true);

  document.documentElement.dataset.eapStartResumeGate=VERSION;
  window.EAPStartResumeGateV183={version:VERSION,identity:identity,snapshotVerified:snapshotVerified,request:requestProgress};
})();
