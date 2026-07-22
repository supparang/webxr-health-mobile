/* =========================================================
   EAP Hero Player Resume v7 — Server Official Progress
   - Google Sheet player_resume response is the only progress authority.
   - Frontend never derives official route/unlocks from local portfolio.
   - localStorage is only a scoped cache of the latest server response.
========================================================= */
(function(){
'use strict';

var VERSION='v20260722-EAP-PLAYER-RESUME-V7-SERVER-OFFICIAL-PROGRESS';
var STATE_KEY='EAP_HERO_PROGRESS_V3';
var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
var SNAPSHOT_PREFIX='EAP_HERO_PLAYER_STATE_V1_';
var CACHE_PREFIX='EAP_HERO_SERVER_RESUME_CACHE_V5_';
var PACK_NAME='EAP_HERO_SESSION_CONTENT_PACK';
var ENDPOINT=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||'');
var SECTION=String((window.EAP_SHEET_CONFIG||{}).section||'122');
var PASS=60;
var RESUME_TIMEOUT_MS=35000;
var SILENT_RETRY_MS=60000;
var lastSyncAt=0;
var syncing=false;

function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
function lower(v){return clean(v).toLowerCase();}
function read(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch(_){return f;}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}}
function valid(p){return !!(p&&p.studentId&&p.studentName&&String(p.studentId).toLowerCase()!=='guest');}
function normalize(r){r=r||{};return {studentId:clean(r.studentId||r.id||''),studentName:clean(r.studentName||r.name||''),section:clean(r.section||SECTION)||SECTION};}
function playerKey(p){p=normalize(p);return encodeURIComponent(p.section+'__'+p.studentId);}
function scopedKey(p){return SNAPSHOT_PREFIX+playerKey(p);}
function cacheKey(p){return CACHE_PREFIX+playerKey(p);}
function aliases(p){p=normalize(p);return {id:p.studentId,name:p.studentName,studentId:p.studentId,studentName:p.studentName,section:p.section};}
function stateProfile(s){s=s||{};return normalize(Object.assign({},s.profile||{},s.player||{},s.user||{},{id:s.id||'',name:s.name||s.playerName||'',studentId:s.studentId||'',studentName:s.studentName||'',section:s.section||''}));}
function profile(){var direct=normalize(read(PROFILE_KEY,{}));return valid(direct)?direct:stateProfile(read(STATE_KEY,{}));}
function sid(v){var r=clean(v).toUpperCase();if(/^\d+$/.test(r))return'S'+Number(r);if(/^S(?:ESSION)?\s*\d+$/i.test(r))return'S'+(r.match(/\d+/)||[''])[0];if(/^B(?:OSS)?\s*\d+$/i.test(r))return'B'+(r.match(/\d+/)||[''])[0];return r;}
function sn(v){var m=sid(v).match(/^S(\d+)$/);return m?Number(m[1]):0;}
function skill(v){var s=lower(v);return s?s.charAt(0).toUpperCase()+s.slice(1):'';}
function score(v){var n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
function bool(v){return v===true||String(v).toUpperCase()==='TRUE'||String(v)==='1'||String(v).toLowerCase()==='yes';}
function pack(){var d=window[PACK_NAME];return d&&Array.isArray(d.routes)?d:null;}
function routeList(){var d=pack();if(!d)return[];var order=Array.isArray(d.routeOrder)&&d.routeOrder.length?d.routeOrder:d.routes.map(function(r){return r.routeId;});return order.map(function(id){return d.routes.find(function(r){return sid(r.routeId)===sid(id);});}).filter(Boolean);}
function routeById(routeId){var id=sid(routeId);return routeList().find(function(r){return sid(r.routeId)===id;})||null;}
function blank(p){var a=aliases(p);return {profile:a,player:a,user:a,id:a.id,name:a.name,playerName:a.name,studentId:a.studentId,studentName:a.studentName,section:a.section,portfolio:[],evidence:[],attempts:[],completedSessions:{},sessionProgress:{},unlockedSessions:{},unlockedRoutes:{},playerScopedState:true,cloudFirst:true,cloudResumeStatus:'pending'};}
function mirror(s,p){var a=aliases(p);s=s&&typeof s==='object'?s:{};s.profile=Object.assign({},s.profile||{},a);s.player=Object.assign({},s.player||{},a);s.user=Object.assign({},s.user||{},a);s.id=a.id;s.name=a.name;s.playerName=a.name;s.studentId=a.studentId;s.studentName=a.studentName;s.section=a.section;s.__activePlayer={studentId:a.studentId,section:a.section,at:new Date().toISOString()};return s;}
function ensureScope(p){p=normalize(p);if(!valid(p))return read(STATE_KEY,{});var active=normalize(read(ACTIVE_KEY,{})),state=read(STATE_KEY,{}),previous=valid(active)?active:stateProfile(state);if(valid(previous)&&playerKey(previous)!==playerKey(p)){write(scopedKey(previous),mirror(state,previous));state=read(scopedKey(p),null)||blank(p);}else if(!state||!Object.keys(state).length){state=read(scopedKey(p),null)||blank(p);}state=mirror(state,p);state.cloudFirst=true;write(STATE_KEY,state);write(scopedKey(p),state);write(ACTIVE_KEY,aliases(p));return state;}
function recKey(r){return sid(r.routeId||r.sessionId||r.session)+'|'+lower(r.skill);}
function show(message,kind){var old=document.getElementById('eap-resume-status-v3');if(old)old.remove();var n=document.createElement('div');n.id='eap-resume-status-v3';n.textContent=message;n.style.cssText='position:fixed;z-index:100120;right:18px;bottom:18px;max-width:min(460px,calc(100vw - 36px));padding:11px 14px;border-radius:12px;background:'+(kind==='warn'?'#9a3412':(kind==='ok'?'#065f46':'#17375e'))+';color:#fff;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';document.body.appendChild(n);setTimeout(function(){if(n.parentNode)n.remove();},kind==='loading'?5200:3800);}
function restored(row){var id=sid(row.routeId||row.sessionId||row.session||row.missionId);var sc=score(row.bestScore!==undefined?row.bestScore:(row.score!==undefined?row.score:row.latestScore));var acc=score(row.bestAccuracy!==undefined?row.bestAccuracy:(row.accuracy!==undefined?row.accuracy:row.accuracyPct));return {routeId:id,sessionId:id,session:sn(id)||id,sessionTitle:clean(row.routeTitle||row.sessionTitle||row.missionTitle||''),skill:skill(row.skill),score:sc,latestScore:sc,bestScore:sc,accuracy:acc,bestAccuracy:acc,passed:bool(row.passed),at:clean(row.updatedAt||row.latestAt||row.receivedAt||row.completedAt||new Date().toISOString()),latestAt:clean(row.updatedAt||row.latestAt||row.receivedAt||row.completedAt||new Date().toISOString()),output:clean(row.output||row.teacherReviewStatus||'ความคืบหน้าที่ยืนยันแล้วจาก Cloud/Sheet'),restoredFromSheet:true,cloudVerified:true,serverVerified:true,resumeSource:clean(row.resumeSource||row.sourceSheet||'cloud_resume'),legacyCompletion:false,replay:bool(row.replay),teacherReviewRequired:bool(row.teacherReviewRequired),teacherReviewStatus:clean(row.teacherReviewStatus||'')};}

function applyOfficialProgress(state,response){
  var routeProgress=response&&response.routeProgress&&typeof response.routeProgress==='object'?response.routeProgress:{};
  var completedSessions={},sessionProgress={},unlockedRoutes={},unlockedSessions={};
  Object.keys(routeProgress).forEach(function(key){
    var id=sid(key),row=routeProgress[key]||{},copy=Object.assign({},row,{routeId:id,restoredFromSheet:true,cloudVerified:true,serverVerified:true});
    sessionProgress[id]=copy;
    var n=sn(id);if(n)sessionProgress[n]=copy;
    if(row.completed===true||row.passed===true){completedSessions[id]=true;if(n)completedSessions[n]=true;}
  });
  var serverUnlocked=response&&response.unlockedRoutes&&typeof response.unlockedRoutes==='object'?response.unlockedRoutes:{};
  Object.keys(serverUnlocked).forEach(function(key){if(serverUnlocked[key]===true||(serverUnlocked[key]&&serverUnlocked[key].unlocked===true))unlockedRoutes[sid(key)]=true;});
  var serverSessions=response&&response.unlockedSessions&&typeof response.unlockedSessions==='object'?response.unlockedSessions:{};
  Object.keys(serverSessions).forEach(function(key){if(serverSessions[key]===true)unlockedSessions[String(Number(key))]=true;});
  state.completedSessions=completedSessions;
  state.sessionProgress=sessionProgress;
  state.unlockedRoutes=unlockedRoutes;
  state.unlockedSessions=unlockedSessions;
  state.currentCloudRoute=sid(response.currentRoute||response.currentCloudRoute||response.nextRoute||'S1');
  state.currentRoute=state.currentCloudRoute;
  state.activeRoute=state.currentCloudRoute;
  state.officialPassedRoutes=Array.isArray(response.passedRoutes)?response.passedRoutes.map(sid):[];
  state.officialProgressVersion=clean(response.version||'');
  state.dataQualityStatus=clean(response.dataQualityStatus||'OK');
  state.identityStatus=clean(response.identityStatus||'');
  state.identityConflict=response.identityConflict===true;
}

function fallbackProgress(state,portfolio){
  var order=routeList().map(function(r){return sid(r.routeId);});
  var required=['Listening','Speaking','Reading','Writing'],progress={},passed=[],current='';
  order.forEach(function(id){
    var scores={},skills={};required.forEach(function(sk){scores[sk]=0;skills[sk]={passed:false,score:0};});
    portfolio.forEach(function(item){if(sid(item.sessionId)!==id)return;var sk=skill(item.skill);if(scores[sk]===undefined)return;scores[sk]=Math.max(scores[sk],score(item.bestScore));skills[sk]={passed:item.passed===true,score:score(item.bestScore)};});
    var complete=required.every(function(sk){return skills[sk].passed===true;});
    progress[id]={routeId:id,skills:skills,completed:complete,passed:complete,restoredFromSheet:true};
    if(complete&&!current)passed.push(id);else if(!current)current=id;
  });
  if(!current)current=order[order.length-1]||'S1';
  var unlocked={};passed.concat([current]).forEach(function(id){unlocked[id]=true;});
  state.sessionProgress=progress;state.unlockedRoutes=unlocked;state.unlockedSessions={};Object.keys(unlocked).forEach(function(id){var n=sn(id);if(n)state.unlockedSessions[String(n)]=true;});state.currentCloudRoute=current;state.currentRoute=current;state.activeRoute=current;
}

function apply(state,rows,response,p){
  var byKey={},portfolio=[];
  (Array.isArray(rows)?rows:[]).forEach(function(row){if(!row||String(row.legacyCompletion).toUpperCase()==='TRUE')return;var incoming=restored(row),k=recKey(incoming);if(!incoming.sessionId||!incoming.skill||!routeById(incoming.sessionId))return;if(!byKey[k]||incoming.passed&&!byKey[k].passed||incoming.bestScore>byKey[k].bestScore||incoming.latestAt>byKey[k].latestAt)byKey[k]=incoming;});
  Object.keys(byKey).forEach(function(k){portfolio.push(byKey[k]);});
  portfolio.sort(function(a,b){return String(a.sessionId).localeCompare(String(b.sessionId),undefined,{numeric:true})||String(a.skill).localeCompare(String(b.skill));});
  state.portfolio=portfolio;state.evidence=Array.isArray(state.evidence)?state.evidence:[];state.attempts=Array.isArray(state.attempts)?state.attempts:[];
  if(response&&response.currentRoute&&response.routeProgress)applyOfficialProgress(state,response);else fallbackProgress(state,portfolio);
  state.serverResume=Object.assign({},state.serverResume||{},{resumeKey:playerKey(p),serverRevision:clean(response.serverRevision||response.generatedAt||''),syncedAt:new Date().toISOString(),recordCount:portfolio.length,rawRecordCount:Array.isArray(rows)?rows.length:0,latestActivity:response.latestActivity||null,currentRoute:state.currentCloudRoute,dataQualityStatus:response.dataQualityStatus||'OK',cloudFirst:true});
  state.cloudResumeStatus='ok';state.cloudResumeRequired=true;state.cloudFirst=true;delete state.cloudResumeMessage;mirror(state,p);write(STATE_KEY,state);write(scopedKey(p),state);
  try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(state),storageArea:localStorage}));}catch(_){}
  return portfolio.length;
}
function cached(p){return read(cacheKey(p),null);}
function cache(p,d){write(cacheKey(p),d);}
function notifyCore(data,changed){window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:{data:data,changed:changed,cloudFirst:true}}));}
function hasUsableResume(p){var c=valid(p)?cached(p):null;if(c&&c.ok&&clean(c.currentRoute))return true;var s=read(STATE_KEY,{});return !!(s&&s.serverResume&&clean(s.serverResume.resumeKey)&&s.cloudResumeStatus==='ok');}
function useCacheIfAny(p){var c=valid(p)?cached(p):null;if(c&&c.ok){var count=apply(ensureScope(p),c.records||[],c,p);notifyCore(c,count>0);return true;}return false;}
function markUnavailable(p,message){var state=ensureScope(p);if(hasUsableResume(p)){state.cloudResumeStatus='ok';state.cloudResumeMessage='latest_cloud_retry_slow';}else{state.cloudResumeStatus='unavailable';state.cloudResumeMessage=message||'Cloud/Sheet resume unavailable';}state.cloudResumeRequired=true;state.cloudFirst=true;write(STATE_KEY,state);write(scopedKey(p),state);try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(state),storageArea:localStorage}));}catch(_){} }
function jsonp(p,opts){opts=opts||{};if(!ENDPOINT||!valid(p)){return false;}var cb='__eapCloudResume_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),done=false,timer=null,script=document.createElement('script');function cleanup(){if(done)return;done=true;clearTimeout(timer);try{delete window[cb];}catch(_){window[cb]=undefined;}if(script.parentNode)script.parentNode.removeChild(script);syncing=false;}function softFail(message,visibleMessage){var already=hasUsableResume(p)||useCacheIfAny(p);cleanup();markUnavailable(p,message);if(!opts.silent&&!already)show(visibleMessage,'warn');}
window[cb]=function(data){cleanup();if(!data||data.ok!==true){markUnavailable(p,'server_not_ok');if(!opts.silent&&!hasUsableResume(p))show('ยังดึง Cloud/Sheet ไม่สำเร็จ: ตรวจ Apps Script player_resume ก่อน','warn');return;}cache(p,data);var count=apply(ensureScope(p),data.records||[],data,p);notifyCore(data,true);if(!opts.silent)show('ยืนยันความคืบหน้าจาก Google Sheet แล้ว · '+sid(data.currentRoute||'S1'),'ok');};script.onerror=function(){softFail('script_error','เชื่อม Cloud/Sheet ไม่สำเร็จ · ยังไม่เปลี่ยนสถานะการเรียน');};timer=setTimeout(function(){softFail('timeout','Cloud/Sheet ตอบช้า · ยังไม่เปลี่ยนสถานะการเรียน');},RESUME_TIMEOUT_MS);var u=new URL(ENDPOINT,location.href);u.searchParams.set('action','player_resume');u.searchParams.set('studentId',p.studentId);u.searchParams.set('studentName',p.studentName);u.searchParams.set('section',p.section);u.searchParams.set('callback',cb);u.searchParams.set('_',String(Date.now()));script.async=true;script.referrerPolicy='no-referrer';script.src=u.toString();document.head.appendChild(script);return true;}
function sync(opts){opts=opts||{};var p=profile();if(!valid(p))return false;ensureScope(p);if(syncing)return true;var now=Date.now();if(opts.silent&&now-lastSyncAt<15000)return true;lastSyncAt=now;syncing=true;if(!opts.silent&&!hasUsableResume(p))show('กำลังตรวจสอบความคืบหน้าจาก Google Sheet…','loading');return jsonp(p,opts);}
function boot(){var p=profile();if(valid(p)){ensureScope(p);var c=cached(p),used=false;if(c&&c.ok&&clean(c.currentRoute)){used=true;apply(ensureScope(p),c.records||[],c,p);}setTimeout(function(){sync({silent:used});},160);setInterval(function(){sync({silent:true});},SILENT_RETRY_MS);}}
window.EAPPlayerResume={version:VERSION,sync:sync,profile:profile,cache:function(){var p=profile();return valid(p)?cached(p):null;},hasUsableResume:function(){return hasUsableResume(profile());},applyCloudResponse:function(response){var p=profile();if(!valid(p)||!response||response.ok!==true)return false;cache(p,response);apply(ensureScope(p),response.records||[],response,p);notifyCore(response,true);return true;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
