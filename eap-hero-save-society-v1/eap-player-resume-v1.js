/* =========================================================
   EAP Hero Player Resume v2 — no automatic page reload
   Restores verified Sheet progress per studentId + section.
   Fresh server data is applied in place; the learner controls navigation.
========================================================= */
(function(){
  'use strict';
  var STATE_KEY='EAP_HERO_PROGRESS_V3', PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1', ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAPSHOT_PREFIX='EAP_HERO_PLAYER_STATE_V1_', CACHE_PREFIX='EAP_HERO_SERVER_RESUME_CACHE_V1_';
  var ENDPOINT=String((window.EAP_SHEET_CONFIG||{}).webAppUrl||''), SECTION=String((window.EAP_SHEET_CONFIG||{}).section||'122');
  var REQUIRED={1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']};

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(_){return false;}}
  function valid(p){return !!(p&&p.studentId&&p.studentName&&String(p.studentId).toLowerCase()!=='guest');}
  function normalize(r){r=r||{};return {studentId:clean(r.studentId||r.id||''),studentName:clean(r.studentName||r.name||''),section:clean(r.section||SECTION)||SECTION};}
  function playerKey(p){p=normalize(p);return encodeURIComponent(p.section+'__'+p.studentId);}
  function scopedKey(p){return SNAPSHOT_PREFIX+playerKey(p);}
  function cacheKey(p){return CACHE_PREFIX+playerKey(p);}
  function aliases(p){p=normalize(p);return {id:p.studentId,name:p.studentName,studentId:p.studentId,studentName:p.studentName,section:p.section};}
  function stateProfile(s){s=s||{};return normalize(Object.assign({},s.profile||{},s.player||{},s.user||{},{id:s.id||'',name:s.name||s.playerName||'',studentId:s.studentId||'',studentName:s.studentName||'',section:s.section||''}));}
  function blank(p){var a=aliases(p);return {profile:a,player:a,user:a,id:a.id,name:a.name,playerName:a.name,studentId:a.studentId,studentName:a.studentName,section:a.section,portfolio:[],evidence:[],attempts:[],completedSessions:{},sessionProgress:{},unlockedSessions:{},playerScopedState:true};}
  function mirror(s,p){var a=aliases(p);s=s&&typeof s==='object'?s:{};s.profile=Object.assign({},s.profile||{},a);s.player=Object.assign({},s.player||{},a);s.user=Object.assign({},s.user||{},a);s.id=a.id;s.name=a.name;s.playerName=a.name;s.studentId=a.studentId;s.studentName=a.studentName;s.section=a.section;s.__activePlayer={studentId:a.studentId,section:a.section,at:new Date().toISOString()};return s;}
  function profile(){var direct=normalize(read(PROFILE_KEY,{}));return valid(direct)?direct:stateProfile(read(STATE_KEY,{}));}
  function ensureScope(p){p=normalize(p);if(!valid(p))return read(STATE_KEY,{});var active=normalize(read(ACTIVE_KEY,{})),state=read(STATE_KEY,{}),previous=valid(active)?active:stateProfile(state);if(valid(previous)&&playerKey(previous)!==playerKey(p)){write(scopedKey(previous),mirror(state,previous));state=read(scopedKey(p),null)||blank(p);}else if(!state||!Object.keys(state).length){state=read(scopedKey(p),null)||blank(p);}state=mirror(state,p);write(STATE_KEY,state);write(scopedKey(p),state);write(ACTIVE_KEY,aliases(p));return state;}
  function sid(v){var r=clean(v).toUpperCase();if(/^\d+$/.test(r))return 'S'+r;if(/^S(?:ESSION)?\s*\d+$/.test(r))return 'S'+(r.match(/\d+/)||[''])[0];if(/^B(?:OSS)?\s*\d+$/.test(r))return 'B'+(r.match(/\d+/)||[''])[0];return r;}
  function sn(v){var m=sid(v).match(/^S(\d+)$/);return m?Number(m[1]):0;}
  function skill(v){var s=clean(v).toLowerCase();return s?s.charAt(0).toUpperCase()+s.slice(1):'';}
  function score(v){var n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
  function recKey(r){return sid(r.sessionId)+'|'+skill(r.skill).toLowerCase();}
  function show(message,kind){var old=document.getElementById('eap-resume-status-v2');if(old)old.remove();var n=document.createElement('div');n.id='eap-resume-status-v2';n.textContent=message;n.style.cssText='position:fixed;z-index:100120;right:18px;bottom:18px;max-width:min(420px,calc(100vw - 36px));padding:11px 14px;border-radius:12px;background:'+(kind==='warn'?'#9a3412':'#17375e')+';color:#fff;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';document.body.appendChild(n);setTimeout(function(){if(n.parentNode)n.remove();},kind==='loading'?5500:3600);}
  function restored(row){var id=sid(row.sessionId),sc=score(row.bestScore!==undefined?row.bestScore:row.score);return {session:sn(id)||id,sessionId:id,sessionTitle:clean(row.sessionTitle||''),skill:skill(row.skill),score:sc,latestScore:sc,bestScore:sc,accuracy:score(row.bestAccuracy!==undefined?row.bestAccuracy:row.accuracy),bestAccuracy:score(row.bestAccuracy!==undefined?row.bestAccuracy:row.accuracy),passed:row.passed===true||String(row.passed).toUpperCase()==='TRUE'||sc>=60,at:clean(row.updatedAt||row.latestAt||new Date().toISOString()),latestAt:clean(row.updatedAt||row.latestAt||new Date().toISOString()),output:'ความคืบหน้าที่ยืนยันแล้วจาก Sheet',restoredFromSheet:true,resumeSource:'server_summary',legacyCompletion:false,replay:false};}
  function apply(state,rows,response,p){
    var changed=false,portfolio=Array.isArray(state.portfolio)?state.portfolio.slice():[],lookup={};
    portfolio.forEach(function(item,i){var k=recKey(item||{});if(k&&lookup[k]===undefined)lookup[k]=i;});
    (Array.isArray(rows)?rows:[]).forEach(function(row){if(!row||String(row.legacyCompletion).toUpperCase()==='TRUE')return;var incoming=restored(row),k=recKey(incoming),idx=lookup[k],local=idx===undefined?null:portfolio[idx];if(!local){portfolio.push(incoming);lookup[k]=portfolio.length-1;changed=true;return;}if(incoming.latestScore>score(local.latestScore!==undefined?local.latestScore:local.score)){var merged=Object.assign({},local,incoming);if(local.output&&!local.restoredFromSheet)merged.output=local.output;portfolio[idx]=merged;changed=true;}});
    state.portfolio=portfolio;state.evidence=Array.isArray(state.evidence)?state.evidence:[];state.attempts=Array.isArray(state.attempts)?state.attempts:[];state.sessionProgress=state.sessionProgress&&typeof state.sessionProgress==='object'?state.sessionProgress:{};state.completedSessions=state.completedSessions&&typeof state.completedSessions==='object'?state.completedSessions:{};state.unlockedSessions=state.unlockedSessions&&typeof state.unlockedSessions==='object'?state.unlockedSessions:{};
    var scores={};portfolio.forEach(function(item){var id=sid(item&&(item.sessionId||item.session)),sk=skill(item&&item.skill);if(!/^S\d+$/.test(id)||!sk)return;scores[id]=scores[id]||{};scores[id][sk]=Math.max(Number(scores[id][sk]||0),score(item.latestScore!==undefined?item.latestScore:item.score));});
    Object.keys(scores).forEach(function(id){var n=sn(id),needed=REQUIRED[n]||[],complete=needed.length>0&&needed.every(function(sk){return Number(scores[id][sk]||0)>=60;});state.sessionProgress[id]=Object.assign({},state.sessionProgress[id]||{},{scores:scores[id],completed:complete,restoredFromSheet:true,updatedAt:response.serverRevision||new Date().toISOString()});state.sessionProgress[n]=state.sessionProgress[id];if(complete){state.completedSessions[id]=true;state.completedSessions[n]=true;state.unlockedSessions[n]=true;if(n<15)state.unlockedSessions[n+1]=true;}});
    state.serverResume=Object.assign({},state.serverResume||{},{resumeKey:playerKey(p),serverRevision:clean(response.serverRevision||response.generatedAt||''),syncedAt:new Date().toISOString(),recordCount:(Array.isArray(rows)?rows.length:0),latestActivity:response.latestActivity||null});mirror(state,p);write(STATE_KEY,state);write(scopedKey(p),state);return changed;
  }
  function cached(p){return read(cacheKey(p),null);}
  function cache(p,d){write(cacheKey(p),d);}
  function notifyCore(data,changed){window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:{data:data,changed:changed}}));}
  function jsonp(p){
    if(!ENDPOINT||!valid(p))return;var cb='__eapResume_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),done=false,timer=null,script=document.createElement('script');
    function cleanup(){if(done)return;done=true;clearTimeout(timer);try{delete window[cb];}catch(_){window[cb]=undefined;}if(script.parentNode)script.parentNode.removeChild(script);}
    window[cb]=function(data){cleanup();if(!data||data.ok!==true){show('ยังเชื่อม Sheet ไม่สำเร็จ จึงใช้ความคืบหน้าในเครื่องนี้ก่อน','warn');return;}cache(p,data);var changed=apply(ensureScope(p),data.records||[],data,p);notifyCore(data,changed);if((data.records||[]).length){show(changed?'ซิงก์ความคืบหน้าจาก Sheet แล้ว · กด Map หรือ Continue เพื่อเรียนต่อ':'ความคืบหน้าพร้อมแล้ว · กด Map หรือ Continue เพื่อเรียนต่อ');}};
    script.onerror=function(){cleanup();show('เชื่อม Sheet ไม่สำเร็จ จึงใช้ความคืบหน้าในเครื่องนี้ก่อน','warn');};timer=setTimeout(function(){cleanup();show('กำลังใช้ความคืบหน้าในเครื่องนี้ก่อน','warn');},5000);
    var u=new URL(ENDPOINT,location.href);u.searchParams.set('action','player_resume');u.searchParams.set('studentId',p.studentId);u.searchParams.set('studentName',p.studentName);u.searchParams.set('section',p.section);u.searchParams.set('callback',cb);u.searchParams.set('_',String(Date.now()));script.src=u.toString();document.head.appendChild(script);
  }
  function sync(){var p=profile();if(!valid(p))return false;ensureScope(p);var c=cached(p);if(c&&c.ok)apply(ensureScope(p),c.records||[],c,p);show('กำลังตรวจสอบความคืบหน้าที่บันทึกไว้…','loading');jsonp(p);return true;}
  var p=profile();if(valid(p)){ensureScope(p);var c=cached(p);if(c&&c.ok)apply(ensureScope(p),c.records||[],c,p);setTimeout(sync,30);}window.EAPPlayerResume={sync:sync,profile:profile,cache:function(){var p=profile();return valid(p)?cached(p):null;}};
})();
