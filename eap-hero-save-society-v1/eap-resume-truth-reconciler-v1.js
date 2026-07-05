/* =========================================================
   EAP Hero Resume Truth Reconciler v2

   Resume rule:
   For S1–S15, the map may show only skills confirmed by the current
   player_resume response from Sheet. Browser-only historical scores are
   quarantined and cannot appear as a second skill or unlock a session.
========================================================= */
(function(){
  'use strict';

  var STATE='EAP_HERO_PROGRESS_V3';
  var PROFILE='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE='EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAP='EAP_HERO_PLAYER_STATE_V1_';
  var REQUIRED={1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']};

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function profile(state){
    state=state||{};
    var direct=read(PROFILE,{})||{};
    var p=Object.assign({},state.profile||{},state.player||{},state.user||{},direct);
    return {studentId:clean(p.studentId||p.id||state.studentId||state.id||''),studentName:clean(p.studentName||p.name||state.studentName||state.name||state.playerName||''),section:clean(p.section||state.section||'122')||'122'};
  }
  function playerKey(p){return encodeURIComponent(p.section+'__'+p.studentId);}
  function sid(v){
    var raw=clean(v).toUpperCase();
    if(/^\d+$/.test(raw))return 'S'+raw;
    var s=raw.match(/^S(?:ESSION)?\s*(\d{1,2})$/);if(s)return 'S'+s[1];
    return raw;
  }
  function sn(v){var m=sid(v).match(/^S(\d+)$/);return m?Number(m[1]):0;}
  function skill(v){var raw=clean(v).toLowerCase();return raw?raw.charAt(0).toUpperCase()+raw.slice(1):'';}
  function score(v){var n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
  function isCore(entry){
    var session=sid(entry&&(entry.sessionId||entry.session));
    var sk=skill(entry&&entry.skill);
    return /^S(?:[1-9]|1[0-5])$/.test(session) && ['Reading','Writing','Listening','Speaking'].indexOf(sk)>=0;
  }
  function key(entry){return sid(entry&&(entry.sessionId||entry.session))+'|'+skill(entry&&entry.skill).toLowerCase();}
  function aliases(p){return {id:p.studentId,name:p.studentName,studentId:p.studentId,studentName:p.studentName,section:p.section};}
  function mirror(state,p){
    var a=aliases(p);
    state.profile=Object.assign({},state.profile||{},a);
    state.player=Object.assign({},state.player||{},a);
    state.user=Object.assign({},state.user||{},a);
    state.id=a.id;state.name=a.name;state.playerName=a.name;state.studentId=a.studentId;state.studentName=a.studentName;state.section=a.section;
    return state;
  }
  function verifiedIdentity(data,current){
    var hasRecords=Array.isArray(data&&data.records)&&data.records.length>0;
    var s=data&&data.student||{};
    var serverName=clean(s.studentName||'');
    if(!hasRecords||!serverName||/^(student|guest)$/i.test(serverName))return current;
    return {studentId:clean(s.studentId||current.studentId),studentName:serverName,section:clean(s.section||current.section)||current.section};
  }
  function patchVisibleProfile(p){
    var title=String((document.getElementById('app')||document.body).innerText||'');
    if(!/Academic Hero Profile/i.test(title))return;
    var inputs=[].slice.call(document.querySelectorAll('input[type="text"],input:not([type])'));
    if(inputs[0])inputs[0].value=p.studentName;
    if(inputs[1])inputs[1].value=p.studentId;
  }
  function rebuildDerived(state){
    var scores={};
    (Array.isArray(state.portfolio)?state.portfolio:[]).forEach(function(item){
      if(!isCore(item))return;
      var id=sid(item.sessionId||item.session),sk=skill(item.skill);
      scores[id]=scores[id]||{};
      scores[id][sk]=Math.max(Number(scores[id][sk]||0),score(item.latestScore!==undefined?item.latestScore:item.score));
    });
    state.sessionProgress={};state.completedSessions={};state.unlockedSessions={1:true};
    for(var n=1;n<=15;n++){
      var id='S'+n,needed=REQUIRED[n]||[],bySkill=scores[id]||{};
      var passed=needed.length>0&&needed.every(function(sk){return Number(bySkill[sk]||0)>=60;});
      state.sessionProgress[id]={scores:bySkill,completed:passed,restoredFromSheet:true,updatedAt:new Date().toISOString()};
      state.sessionProgress[n]=state.sessionProgress[id];
      if(passed){state.completedSessions[id]=true;state.completedSessions[n]=true;}
      if(passed&&n<15&&state.unlockedSessions[n])state.unlockedSessions[n+1]=true;
    }
    return state;
  }
  function refreshOpenMap(){
    var app=document.getElementById('app');
    var text=String(app&&app.innerText||'');
    if(!/SESSION\s*1/i.test(text))return;
    var api=window.EAPHero;
    var render=api&&(api.map||api.forceHome);
    if(typeof render==='function')setTimeout(function(){try{render.call(api);}catch(_){}} , 0);
  }
  function toast(message){
    var old=document.getElementById('eap-resume-truth-toast');if(old)old.remove();
    var el=document.createElement('div');el.id='eap-resume-truth-toast';el.textContent=message;
    el.style.cssText='position:fixed;z-index:100180;right:18px;bottom:70px;max-width:min(460px,calc(100vw - 36px));padding:10px 13px;border-radius:12px;background:#17375e;color:#fff;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';
    document.body.appendChild(el);setTimeout(function(){if(el.parentNode)el.remove();},4800);
  }
  function reconcile(data){
    if(!data||data.ok!==true||!Array.isArray(data.records))return false;
    var state=read(STATE,{});if(!state||typeof state!=='object')return false;
    var before=profile(state),p=verifiedIdentity(data,before);
    if(!p.studentId)return false;

    var server={};
    data.records.forEach(function(row){if(isCore(row))server[key(row)]=true;});

    var removed=[];
    var portfolio=Array.isArray(state.portfolio)?state.portfolio:[];
    portfolio=portfolio.filter(function(item){
      if(!isCore(item))return true;
      if(server[key(item)])return true;
      removed.push({sessionId:sid(item.sessionId||item.session),skill:skill(item.skill),score:score(item.latestScore!==undefined?item.latestScore:item.score)});
      return false;
    });

    state.portfolio=portfolio;
    state.unverifiedLocalSkills=removed;
    state.resumeTruth={
      source:'Sheet summary',
      verifiedAt:new Date().toISOString(),
      serverRecordCount:data.records.length,
      staleLocalSkillsRemoved:removed,
      strict:true,
      note:'Only Sheet-confirmed S1–S15 skills appear on Map and affect unlocks.'
    };
    rebuildDerived(state);
    mirror(state,p);
    write(STATE,state);write(PROFILE,aliases(p));write(ACTIVE,aliases(p));write(SNAP+playerKey(p),state);
    patchVisibleProfile(p);

    if(before.studentName&&before.studentName!==p.studentName&&data.records.length){
      toast('ชื่อผู้เรียนยืนยันจากข้อมูลที่มีใน Sheet: '+p.studentName);
    }
    if(removed.length){
      toast('ล้างข้อมูลในเครื่องที่ไม่มีใน Sheet: '+removed.map(function(x){return x.sessionId+' '+x.skill;}).join(', ')+' แล้ว');
      refreshOpenMap();
    }
    return removed.length>0;
  }

  window.addEventListener('eap:resume-synced',function(event){reconcile(event&&event.detail&&event.detail.data);});
  setTimeout(function(){
    var api=window.EAPPlayerResume;
    if(api&&typeof api.cache==='function')reconcile(api.cache());
  },900);
  window.EAPResumeTruthReconcilerV2={reconcile:reconcile};
})();
