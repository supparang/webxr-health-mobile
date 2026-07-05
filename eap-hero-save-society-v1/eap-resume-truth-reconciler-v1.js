/* =========================================================
   EAP Hero Resume Truth Reconciler v1

   Purpose
   - Sheet summary is authoritative for an existing learner's historical
     S1–S15 skill record after a successful resume.
   - Removes stale browser-only historical skills that are not returned by
     the learner's Sheet summary. This prevents a past test from appearing
     as a second skill in the wrong session.
   - Keeps only very recent local work (five minutes) when it may still be
     waiting for the normal submit transport.
   - Replaces a manually typed display name with the canonical name returned
     for that Student ID by the Sheet profile record.

   It never edits Sheets and never invents a score.
========================================================= */
(function(){
  'use strict';

  var STATE='EAP_HERO_PROGRESS_V3';
  var PROFILE='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE='EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAP='EAP_HERO_PLAYER_STATE_V1_';
  var RECENT_LOCAL_MS=5*60*1000;

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
  function skill(v){var raw=clean(v).toLowerCase();return raw?raw.charAt(0).toUpperCase()+raw.slice(1):'';}
  function isCore(entry){
    var session=sid(entry&&(entry.sessionId||entry.session));
    var sk=skill(entry&&entry.skill);
    return /^S(?:[1-9]|1[0-5])$/.test(session) && ['Reading','Writing','Listening','Speaking'].indexOf(sk)>=0;
  }
  function key(entry){return sid(entry&&(entry.sessionId||entry.session))+'|'+skill(entry&&entry.skill).toLowerCase();}
  function isRecent(entry,at){
    if(!entry||entry.restoredFromSheet===true)return false;
    var when=new Date(entry.latestAt||entry.at||entry.createdAt||0).getTime();
    return Number.isFinite(when)&&when>=at-RECENT_LOCAL_MS;
  }
  function canonicalStudent(data,current){
    var s=data&&data.student||{};
    var serverName=clean(s.studentName||'');
    if(!serverName||/^(student|guest)$/i.test(serverName))return current;
    return {studentId:clean(s.studentId||current.studentId),studentName:serverName,section:clean(s.section||current.section)||current.section};
  }
  function aliases(p){return {id:p.studentId,name:p.studentName,studentId:p.studentId,studentName:p.studentName,section:p.section};}
  function mirror(state,p){
    var a=aliases(p);
    state.profile=Object.assign({},state.profile||{},a);
    state.player=Object.assign({},state.player||{},a);
    state.user=Object.assign({},state.user||{},a);
    state.id=a.id;state.name=a.name;state.playerName=a.name;state.studentId=a.studentId;state.studentName=a.studentName;state.section=a.section;
    return state;
  }
  function patchVisibleProfile(p){
    var title=String((document.getElementById('app')||document.body).innerText||'');
    if(!/Academic Hero Profile/i.test(title))return;
    var inputs=[].slice.call(document.querySelectorAll('input[type="text"],input:not([type])'));
    if(inputs[0])inputs[0].value=p.studentName;
    if(inputs[1])inputs[1].value=p.studentId;
  }
  function toast(message){
    var old=document.getElementById('eap-resume-truth-toast');if(old)old.remove();
    var el=document.createElement('div');el.id='eap-resume-truth-toast';el.textContent=message;
    el.style.cssText='position:fixed;z-index:100180;right:18px;bottom:70px;max-width:min(440px,calc(100vw - 36px));padding:10px 13px;border-radius:12px;background:#17375e;color:#fff;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';
    document.body.appendChild(el);setTimeout(function(){if(el.parentNode)el.remove();},4600);
  }
  function reconcile(data){
    if(!data||data.ok!==true||!Array.isArray(data.records))return false;
    var state=read(STATE,{});if(!state||typeof state!=='object')return false;
    var before=profile(state),p=canonicalStudent(data,before);
    if(!p.studentId)return false;

    var server={};
    data.records.forEach(function(row){
      if(!isCore(row))return;
      server[key(row)]=true;
    });

    var now=Date.now(),removed=[];
    var portfolio=Array.isArray(state.portfolio)?state.portfolio:[];
    portfolio=portfolio.filter(function(item){
      if(!isCore(item))return true;
      var k=key(item);
      if(server[k])return true;
      if(isRecent(item,now))return true;
      removed.push({sessionId:sid(item.sessionId||item.session),skill:skill(item.skill),score:Number(item.latestScore!==undefined?item.latestScore:item.score||0)});
      return false;
    });

    state.portfolio=portfolio;
    state.resumeTruth={
      source:'Sheet summary',
      verifiedAt:new Date().toISOString(),
      serverRecordCount:data.records.length,
      staleLocalSkillsRemoved:removed,
      note:'Historical S1–S15 skills not returned by Sheet were removed from the map; only very recent local work is temporarily retained.'
    };
    mirror(state,p);
    write(STATE,state);write(PROFILE,aliases(p));write(ACTIVE,aliases(p));write(SNAP+playerKey(p),state);
    patchVisibleProfile(p);

    if(before.studentName&&before.studentName!==p.studentName){
      toast('ยืนยันตัวตนจาก Sheet: รหัส '+p.studentId+' คือ '+p.studentName+' · ระบบจะแยกข้อมูลตามรหัสและ Section');
    }
    if(removed.length){
      toast('ล้างคะแนนเก่าที่ไม่มีใน Sheet '+removed.map(function(x){return x.sessionId+' '+x.skill;}).join(', ')+' แล้ว');
    }
    return removed.length>0;
  }

  window.addEventListener('eap:resume-synced',function(event){reconcile(event&&event.detail&&event.detail.data);});
  setTimeout(function(){
    var api=window.EAPPlayerResume;
    if(api&&typeof api.cache==='function')reconcile(api.cache());
  },900);
  window.EAPResumeTruthReconcilerV1={reconcile:reconcile};
})();
