/* =========================================================
   EAP Hero • Local Result Progress Bridge v140
   - Mirrors a just-completed Skill result into local portfolio/sessionProgress.
   - Fixes result page showing 100/100 but Skill Hub returning to "ยังไม่ทำ".
   - Local record is marked pendingSheetSync and is NOT official Sheet authority.
========================================================= */
(function(){
  'use strict';
  var VERSION='20260722-EAP-LOCAL-RESULT-PROGRESS-BRIDGE-V140';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var ACTIVE_KEY='EAP_LOCAL_ACTIVE_SKILL_CONTEXT_V140';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var SNAPSHOT_PREFIX='EAP_HERO_PLAYER_STATE_V1_';
  var PASS=60;
  var SKILLS=['Reading','Writing','Listening','Speaking'];
  var timer=0,lastResultKey='';

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function normSkill(v){var t=clean(v).toLowerCase();return SKILLS.find(function(s){return t.indexOf(s.toLowerCase())>=0;})||'';}
  function normSid(v){var t=clean(v).toUpperCase(),m=t.match(/(?:SESSION\s*:?[ ]*|\bS)(1[0-5]|[1-9])\b/);return m?'S'+Number(m[1]):'';}
  function profile(){var p=read(PROFILE_KEY,{});return {studentId:clean(p.studentId||p.id||''),studentName:clean(p.studentName||p.name||''),section:clean(p.section||'122')||'122'};}
  function playerKey(p){return encodeURIComponent(p.section+'__'+p.studentId);}
  function scoreFromText(t){
    var patterns=[/(\d{1,3})\s*\/\s*100\b/,/Auto Score\s*(\d{1,3})/i,/Mission Task Score\s*(\d{1,3})/i,/Score\s*(\d{1,3})/i];
    for(var i=0;i<patterns.length;i++){var m=t.match(patterns[i]);if(m){var n=Number(m[1]);if(isFinite(n))return Math.max(0,Math.min(100,n));}}
    return 0;
  }
  function contextFromPage(){
    var app=document.getElementById('app'),text=clean(app&&app.innerText||'');
    var skill=normSkill((text.match(/(Reading|Writing|Listening|Speaking)\s+Evidence\s+Saved/i)||[])[1]||text);
    var score=scoreFromText(text);
    var active=window.EAPPhaseAActiveTask||{};
    var saved=read(ACTIVE_KEY,{});
    var sid=normSid(active.sessionId||saved.sessionId||text);
    if(!sid){
      var state=read(STATE_KEY,{});
      sid=normSid(state.currentSession||state.currentRoute||state.currentCloudRoute||state.activeSession||'');
    }
    return {isResult:/Evidence\s+Saved|Auto Score|Portfolio summaries|Mission Task Score/i.test(text),sessionId:sid,skill:skill||normSkill(active.skill||saved.skill),score:score,text:text};
  }
  function rememberLaunch(){
    var active=window.EAPPhaseAActiveTask;
    if(active&&active.sessionId&&active.skill){write(ACTIVE_KEY,{sessionId:normSid(active.sessionId),skill:normSkill(active.skill),taskId:clean(active.taskId),at:Date.now()});return;}
    var app=document.getElementById('app'),t=clean(app&&app.innerText||'');
    var title=t.match(/(Reading|Writing|Listening|Speaking)\s+Mission/i);
    var sid=normSid(t);
    if(title&&sid)write(ACTIVE_KEY,{sessionId:sid,skill:normSkill(title[1]),at:Date.now()});
  }
  function upsertPortfolio(state,record){
    var list=Array.isArray(state.portfolio)?state.portfolio.slice():[];
    var found=-1;
    for(var i=0;i<list.length;i++){
      if(normSid(list[i].sessionId||list[i].routeId||list[i].session)===record.sessionId&&normSkill(list[i].skill||list[i].skillName)===record.skill&&list[i].pendingSheetSync===true){found=i;break;}
    }
    if(found>=0){
      var old=list[found]||{};
      list[found]=Object.assign({},old,record,{bestScore:Math.max(Number(old.bestScore||old.score||0),record.score),latestScore:record.score});
    }else list.push(record);
    state.portfolio=list;
  }
  function updateProgress(state,record){
    state.sessionProgress=state.sessionProgress&&typeof state.sessionProgress==='object'?state.sessionProgress:{};
    var keys=[record.sessionId,String(Number(record.sessionId.replace(/\D/g,'')))];
    keys.forEach(function(k){
      var row=state.sessionProgress[k]&&typeof state.sessionProgress[k]==='object'?state.sessionProgress[k]:{};
      row.scores=row.scores&&typeof row.scores==='object'?row.scores:{};
      row.scores[record.skill]=Math.max(Number(row.scores[record.skill]||0),record.score);
      row.localPending=true;row.updatedAt=record.updatedAt;
      state.sessionProgress[k]=row;
    });
  }
  function saveResult(ctx){
    if(!ctx.isResult||!ctx.sessionId||!ctx.skill||ctx.score<=0)return false;
    var key=ctx.sessionId+'|'+ctx.skill+'|'+ctx.score;
    if(key===lastResultKey)return false;
    var state=read(STATE_KEY,{}),p=profile(),now=new Date().toISOString();
    var record={
      routeId:ctx.sessionId,sessionId:ctx.sessionId,session:Number(ctx.sessionId.replace(/\D/g,'')),
      skill:ctx.skill,score:ctx.score,latestScore:ctx.score,bestScore:ctx.score,
      passed:ctx.score>=PASS,updatedAt:now,latestAt:now,
      output:ctx.skill+' evidence saved locally; pending Sheet sync',
      localResult:true,pendingSheetSync:true,cloudVerified:false,serverVerified:false,
      evidenceId:'local_'+ctx.sessionId+'_'+ctx.skill.toLowerCase()+'_'+Date.now(),
      studentId:p.studentId,studentName:p.studentName,section:p.section
    };
    upsertPortfolio(state,record);updateProgress(state,record);
    state.lastLocalResult=record;state.localPendingSync=true;
    if(!write(STATE_KEY,state))return false;
    if(p.studentId)write(SNAPSHOT_PREFIX+playerKey(p),state);
    lastResultKey=key;
    try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(state),storageArea:localStorage}));}catch(_){ }
    try{window.dispatchEvent(new CustomEvent('eap:local-result-saved',{detail:record}));}catch(_){ }
    try{window.EAPRequiredSkillUIV129&&window.EAPRequiredSkillUIV129.render&&window.EAPRequiredSkillUIV129.render();}catch(_){ }
    try{window.EAPStrictSkillScoreTruth&&window.EAPStrictSkillScoreTruth.refresh&&window.EAPStrictSkillScoreTruth.refresh();}catch(_){ }
    return true;
  }
  function scan(){rememberLaunch();saveResult(contextFromPage());document.documentElement.dataset.eapLocalResultBridgeVersion=VERSION;}
  function schedule(){clearTimeout(timer);timer=setTimeout(scan,100);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('load',function(){scan();setTimeout(scan,500);setTimeout(scan,1500);});
  window.addEventListener('eap:phase-a-task-launch',function(e){var d=e&&e.detail||{};if(d.sessionId&&d.skill)write(ACTIVE_KEY,{sessionId:normSid(d.sessionId),skill:normSkill(d.skill),taskId:clean(d.taskId),at:Date.now()});});
  document.addEventListener('click',function(e){
    var n=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!n)return;
    var skill=normSkill(n.textContent),app=document.getElementById('app'),sid=normSid(clean(app&&app.innerText||''));
    if(skill&&sid)write(ACTIVE_KEY,{sessionId:sid,skill:skill,at:Date.now()});
    setTimeout(scan,120);
  },true);
  scan();
})();