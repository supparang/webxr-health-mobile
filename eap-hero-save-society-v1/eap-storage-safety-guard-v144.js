/* =========================================================
   EAP Hero • Storage Safety Guard v144
   - Prevents QuotaExceededError for EAP_HERO_PROGRESS_V3.
   - Keeps core progress, best Session+Skill scores, and latest useful evidence.
   - Drops duplicate/oversized transient payloads before retrying writes.
   - Also compacts player-scoped snapshots that contain the same state.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-STORAGE-SAFETY-GUARD-V144';
  var MAIN_KEY='EAP_HERO_PROGRESS_V3';
  var SNAP_PREFIX='EAP_HERO_PLAYER_STATE_V1_';
  var MAX_PORTFOLIO=80;
  var MAX_EVENTS=120;
  var originalSetItem=Storage.prototype.setItem;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function skill(v){var t=clean(v).toLowerCase();return ['Reading','Writing','Listening','Speaking'].find(function(s){return t.indexOf(s.toLowerCase())>=0;})||'';}
  function sid(v){var t=clean(v).toUpperCase(),m=t.match(/(?:SESSION\s*:?[ ]*|\bS)(1[0-5]|[1-9])\b/);if(m)return'S'+Number(m[1]);if(/^\d{1,2}$/.test(t)&&Number(t)>=1&&Number(t)<=15)return'S'+Number(t);return'';}
  function score(r){var vals=[r&&r.bestScore,r&&r.latestScore,r&&r.score,r&&r.autoScore,r&&r.missionTaskScore,r&&r.accuracy];for(var i=0;i<vals.length;i++){var n=Number(vals[i]);if(Number.isFinite(n)&&n>=0&&n<=100)return n;}return 0;}
  function stamp(r){var vals=[r&&r.updatedAt,r&&r.latestAt,r&&r.completedAt,r&&r.createdAt,r&&r.clientTimestamp,r&&r.timestamp];for(var i=0;i<vals.length;i++){var d=new Date(vals[i]);if(vals[i]&&!isNaN(d.getTime()))return d.toISOString();}return'';}
  function shortText(v,max){var t=clean(v);return t.length>max?t.slice(0,max):t;}
  function compactRecord(r){
    var out={};
    ['sessionId','routeId','session','skill','score','bestScore','latestScore','passed','updatedAt','latestAt','studentId','studentName','section','pendingSheetSync','cloudVerified','serverVerified','teacherReviewRequired','teacherReviewStatus','evidenceId','attemptId'].forEach(function(k){if(r&&r[k]!==undefined&&r[k]!==null&&r[k]!=='')out[k]=r[k];});
    var session=sid(out.sessionId||out.routeId||out.session||r&&r.taskId);var sk=skill(out.skill||r&&r.skillName||r&&r.evidenceType||r&&r.taskId||r&&r.type);var sc=score(r||{}),ts=stamp(r||{});
    if(session){out.sessionId=session;out.routeId=session;out.session=Number(session.slice(1));}
    if(sk)out.skill=sk;
    out.score=sc;out.bestScore=sc;out.latestScore=sc;out.passed=!!(r&&r.passed)||sc>=60;
    if(ts){out.updatedAt=ts;out.latestAt=ts;}
    var text=shortText(r&&(r.studentOutput||r.output||r.answer||r.response||r.text||r.reflection||r.summary),240);if(text)out.output=text;
    return out;
  }
  function compactPortfolio(list){
    var map={};(Array.isArray(list)?list:[]).forEach(function(r){var c=compactRecord(r),session=sid(c.sessionId||c.routeId||c.session),sk=skill(c.skill);if(!session||!sk)return;var key=session+'|'+sk,old=map[key];if(!old||score(c)>score(old)||(score(c)===score(old)&&stamp(c)>stamp(old)))map[key]=c;});
    return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return String(stamp(b)).localeCompare(String(stamp(a)));}).slice(0,MAX_PORTFOLIO);
  }
  function trimArray(arr,max){return Array.isArray(arr)?arr.slice(-max):arr;}
  function removeLargeFields(obj){
    if(!obj||typeof obj!=='object')return obj;
    ['rawJson','payloadJson','valueJson','audioBase64','audioData','blob','screenshot','debugDump','trace','html','fullText','itemBank','questionBank'].forEach(function(k){if(k in obj)delete obj[k];});
    Object.keys(obj).forEach(function(k){var v=obj[k];if(typeof v==='string'&&v.length>1200)obj[k]=v.slice(0,1200);});
    return obj;
  }
  function compactState(state){
    var s=state&&typeof state==='object'?state:{};
    s.portfolio=compactPortfolio(s.portfolio);
    ['events','sessionEvents','eventLog','attempts','history','auditLog','debugEvents','pendingQueue','unsyncedQueue'].forEach(function(k){if(Array.isArray(s[k]))s[k]=trimArray(s[k],MAX_EVENTS).map(function(x){return removeLargeFields(x&&typeof x==='object'?Object.assign({},x):x);});});
    ['lastResult','lastLocalResult','currentAttempt','activeAttempt','resumePayload','cloudResume','lastResponse'].forEach(function(k){if(s[k]&&typeof s[k]==='object')s[k]=removeLargeFields(Object.assign({},s[k]));});
    s.storageSafetyVersion=VERSION;s.storageCompactedAt=new Date().toISOString();
    return s;
  }
  function parseJson(v){try{return JSON.parse(v);}catch(_){return null;}}
  function shouldHandle(key){return key===MAIN_KEY||String(key).indexOf(SNAP_PREFIX)===0;}
  function compactString(value){var parsed=parseJson(value);if(!parsed)return value;return JSON.stringify(compactState(parsed));}
  function purgeDisposable(){
    var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&(/DEBUG|TRACE|CACHE|TEMP|TMP|QA_LOG|LOCAL_SHEET_LOG/i.test(k))&&!shouldHandle(k))keys.push(k);}
    keys.forEach(function(k){try{localStorage.removeItem(k);}catch(_){}});
  }
  function safeWrite(key,value){
    try{originalSetItem.call(localStorage,key,value);return true;}catch(err){
      if(!(err&&(/QuotaExceeded/i.test(err.name)||/quota/i.test(String(err.message)))))throw err;
      var compacted=shouldHandle(key)?compactString(value):value;
      purgeDisposable();
      try{originalSetItem.call(localStorage,key,compacted);return true;}catch(err2){
        if(shouldHandle(key)){
          var parsed=parseJson(compacted)||{};parsed=compactState(parsed);parsed.portfolio=compactPortfolio(parsed.portfolio).slice(0,40);
          ['events','sessionEvents','eventLog','attempts','history','auditLog','debugEvents','pendingQueue','unsyncedQueue'].forEach(function(k){if(Array.isArray(parsed[k]))parsed[k]=parsed[k].slice(-40);});
          originalSetItem.call(localStorage,key,JSON.stringify(parsed));return true;
        }
        throw err2;
      }
    }
  }
  Storage.prototype.setItem=function(key,value){if(this===localStorage)return safeWrite(String(key),String(value));return originalSetItem.call(this,key,value);};
  function compactExisting(){
    var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&shouldHandle(k))keys.push(k);}
    keys.forEach(function(k){var raw=localStorage.getItem(k);if(!raw)return;try{originalSetItem.call(localStorage,k,compactString(raw));}catch(_){try{purgeDisposable();originalSetItem.call(localStorage,k,compactString(raw));}catch(__){}}});
    document.documentElement.dataset.eapStorageSafetyVersion=VERSION;
  }
  compactExisting();
  window.addEventListener('load',function(){setTimeout(compactExisting,300);setTimeout(compactExisting,1600);});
  window.EAPStorageSafetyGuard={version:VERSION,compactExisting:compactExisting,compactState:compactState};
})();