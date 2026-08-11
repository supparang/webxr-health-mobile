/* =========================================================
   EAP Hero • Lobby Identity Bridge v1
   VERSION: 20260811-EAP-LOBBY-IDENTITY-BRIDGE-V1

   Purpose
   - Recover learner identity when the visible Student Lobby has already
     resolved Student ID / Section but Single Sheet Authority booted earlier.
   - Publishes IDENTITY ONLY. Never publishes or advances progression route.
   - Google Sheet player_resume remains the sole progression authority.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_LOBBY_IDENTITY_BRIDGE_V1__) return;
  window.__EAP_LOBBY_IDENTITY_BRIDGE_V1__=true;

  var VERSION='20260811-EAP-LOBBY-IDENTITY-BRIDGE-V1';
  var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var lastIdentity='';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')||{};}catch(_){return {};}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v||{}));return true;}catch(_){return false;}}

  function fromStorage(){
    var s=read(STATE_KEY),p=read(PROFILE_KEY),a=read(ACTIVE_KEY);
    var merged=Object.assign({},s.profile||{},s.player||{},s.user||{},p||{},a||{});
    var id=clean(merged.studentId||merged.id||s.studentId||s.id);
    var name=clean(merged.studentName||merged.name||s.studentName||s.name||s.playerName);
    var section=clean(merged.section||s.section||(window.EAP_SHEET_CONFIG||{}).section||'122')||'122';
    return {studentId:id,studentName:name,section:section};
  }

  function fromLobbyDom(){
    var root=document.getElementById('eap-student-compact-lobby');
    if(!root) return {studentId:'',studentName:'',section:''};
    var text=clean(root.innerText||root.textContent||'');
    var m=text.match(/([^·\n]+?)\s*·\s*ID\s*([A-Za-z0-9_-]+)\s*·\s*Section\s*([A-Za-z0-9_-]+)/i);
    if(!m) return {studentId:'',studentName:'',section:''};
    var name=clean(m[1]);
    /* Keep only the final short learner label before the separator. */
    name=name.split(/\s{2,}|ตอนนี้|Keyword Scanner|Boss Gate|Week\s+\d+/i).pop();
    return {studentId:clean(m[2]),studentName:clean(name)||'Student',section:clean(m[3])||'122'};
  }

  function valid(p){return !!(p&&p.studentId&&p.section&&String(p.studentId).toLowerCase()!=='guest');}

  function publish(p,source){
    if(!valid(p)) return false;
    var identity=p.section+'|'+p.studentId;
    var active=read(ACTIVE_KEY);
    var same=clean(active.studentId||active.id)===p.studentId && clean(active.section||p.section)===p.section;
    if(!same){
      write(ACTIVE_KEY,{studentId:p.studentId,id:p.studentId,studentName:p.studentName||'Student',name:p.studentName||'Student',section:p.section,source:'lobby-identity-bridge',updatedAt:new Date().toISOString()});
      var profile=read(PROFILE_KEY);
      write(PROFILE_KEY,Object.assign({},profile||{},{studentId:p.studentId,id:p.studentId,studentName:p.studentName||profile.studentName||profile.name||'Student',name:p.studentName||profile.studentName||profile.name||'Student',section:p.section}));
      var state=read(STATE_KEY);
      state.profile=Object.assign({},state.profile||{},{studentId:p.studentId,studentName:p.studentName||'Student',section:p.section});
      state.player=Object.assign({},state.player||{},{studentId:p.studentId,studentName:p.studentName||'Student',section:p.section});
      state.studentId=p.studentId;state.id=p.studentId;state.section=p.section;
      if(p.studentName){state.studentName=p.studentName;state.name=p.studentName;state.playerName=p.studentName;}
      state.__identityBridge={version:VERSION,source:source,identity:identity,at:new Date().toISOString()};
      write(STATE_KEY,state);
    }
    if(lastIdentity!==identity || !same){
      lastIdentity=identity;
      try{window.dispatchEvent(new CustomEvent('eap:profile-changed',{detail:{studentId:p.studentId,studentName:p.studentName||'Student',section:p.section,identityKey:identity,source:source,version:VERSION}}));}catch(_){}
    }
    return true;
  }

  function sync(){
    var p=fromStorage();
    if(valid(p)) return publish(p,'storage');
    p=fromLobbyDom();
    if(valid(p)) return publish(p,'lobby-dom');
    return false;
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(sync,80);}
  window.addEventListener('load',schedule);
  window.addEventListener('storage',schedule);
  window.addEventListener('eap:resume-synced',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  setTimeout(sync,100);
  setTimeout(sync,600);
  setTimeout(sync,1500);

  window.EAPLobbyIdentityBridgeV1={version:VERSION,sync:sync,diagnostics:function(){return{version:VERSION,storage:fromStorage(),lobby:fromLobbyDom(),lastIdentity:lastIdentity};}};
})();
