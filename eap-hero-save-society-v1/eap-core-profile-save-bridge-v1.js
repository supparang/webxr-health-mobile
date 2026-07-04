/* =========================================================
   EAP Hero Core Profile Save Bridge v1
   Fixes the legacy in-page "Academic Hero Profile" form so Save Profile
   writes the SAME player identity used by Player Resume:
     studentId + section (primary) | name (display only)

   The legacy page previously saved only its own transient state, so a hard
   reload could resurrect an older ID. This bridge captures Save Profile in
   the capture phase, writes all canonical stores, preserves the goal, and
   then reloads into the correct student-scoped resume state.
========================================================= */
(function(){
  'use strict';

  var STATE='EAP_HERO_PROGRESS_V3';
  var PROFILE='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE='EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAP='EAP_HERO_PLAYER_STATE_V1_';
  var SECTION='122';

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function read(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
  function key(p){return encodeURIComponent(p.section+'__'+p.studentId);}
  function aliases(p){return {id:p.studentId,name:p.studentName,studentId:p.studentId,studentName:p.studentName,section:p.section};}
  function valid(p){return !!(p.studentId&&p.studentName&&p.studentId.toLowerCase()!=='guest');}
  function textNodes(){return Array.prototype.slice.call(document.querySelectorAll('body *')).filter(function(el){return el.children.length===0;});}
  function profilePage(){return /Academic Hero Profile/i.test(String((document.getElementById('app')||document.body).innerText||''));}
  function findField(labelPattern){
    var labels=Array.prototype.slice.call(document.querySelectorAll('label'));
    for(var i=0;i<labels.length;i++){
      if(labelPattern.test(clean(labels[i].textContent))){
        var forId=labels[i].getAttribute('for');
        if(forId){var linked=document.getElementById(forId);if(linked)return linked;}
        var nested=labels[i].querySelector('input,textarea');if(nested)return nested;
        var next=labels[i].nextElementSibling;if(next&&/^(INPUT|TEXTAREA)$/.test(next.tagName))return next;
      }
    }
    return null;
  }
  function fields(){
    var inputs=Array.prototype.slice.call(document.querySelectorAll('input[type="text"],input:not([type]),textarea'));
    var name=findField(/player\s*name|ชื่อผู้เรียน/i)||inputs[0]||null;
    var id=findField(/student\s*id|รหัสนักศึกษา/i)||inputs[1]||null;
    var goal=findField(/academic\s*goal|เป้าหมาย/i)||Array.prototype.slice.call(document.querySelectorAll('textarea'))[0]||null;
    return {name:name,id:id,goal:goal};
  }
  function currentProfile(){
    var state=read(STATE,{})||{};var raw=read(PROFILE,{})||{};var p=Object.assign({},state.profile||{},state.player||{},raw);
    return {studentId:clean(p.studentId||p.id||''),studentName:clean(p.studentName||p.name||''),section:clean(p.section||state.section||SECTION)||SECTION};
  }
  function toast(message,bad){
    var old=document.getElementById('eap-core-profile-save-toast');if(old)old.remove();
    var n=document.createElement('div');n.id='eap-core-profile-save-toast';n.textContent=message;
    n.style.cssText='position:fixed;z-index:100200;left:50%;bottom:22px;transform:translateX(-50%);padding:11px 15px;border-radius:12px;background:'+(bad?'#9a3412':'#065f46')+';color:#fff;font:800 14px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';
    document.body.appendChild(n);setTimeout(function(){if(n.parentNode)n.remove();},3000);
  }
  function saveCoreProfile(){
    var f=fields();
    var p={studentId:clean(f.id&&f.id.value),studentName:clean(f.name&&f.name.value),section:SECTION};
    if(!valid(p)){toast('กรุณากรอกรหัสนักศึกษาและชื่อผู้เรียนให้ครบ',true);if(!p.studentId&&f.id)f.id.focus();else if(f.name)f.name.focus();return false;}

    var old=currentProfile();
    var current=read(STATE,{})||{};
    if(old.studentId&&old.studentId!==p.studentId){
      /* Archive the browser snapshot of the previous learner before switch. */
      write(SNAP+key(old),current);
      current=read(SNAP+key(p),null)||{};
    }
    if(!current||typeof current!=='object'||!Object.keys(current).length){
      current={portfolio:[],evidence:[],attempts:[],completedSessions:{},sessionProgress:{},unlockedSessions:{}};
    }
    var a=aliases(p);
    current.profile=Object.assign({},current.profile||{},a);
    current.player=Object.assign({},current.player||{},a);
    current.user=Object.assign({},current.user||{},a);
    current.id=a.id;current.name=a.name;current.playerName=a.name;current.studentId=a.studentId;current.studentName=a.studentName;current.section=a.section;
    current.academicGoal=clean(f.goal&&f.goal.value);
    current.profileSavedAt=new Date().toISOString();
    current.__activePlayer={studentId:a.studentId,section:a.section,at:new Date().toISOString(),source:'core_profile_save_bridge'};

    write(STATE,current);write(PROFILE,a);write(ACTIVE,a);write(SNAP+key(p),current);
    try{sessionStorage.setItem(PROFILE,JSON.stringify(a));}catch(_){}
    window.dispatchEvent(new CustomEvent('eap:profile-saved',{detail:a}));
    toast('บันทึกโปรไฟล์แล้ว · กำลังโหลดความคืบหน้าของ '+p.studentName+'…');
    setTimeout(function(){location.href='./index.html?resume=1&student='+encodeURIComponent(p.studentId);},500);
    return true;
  }
  document.addEventListener('click',function(event){
    if(!profilePage())return;
    var button=event.target&&event.target.closest&&event.target.closest('button,input[type="button"],input[type="submit"]');
    if(!button)return;
    if(!/^save\s*profile$/i.test(clean(button.value||button.textContent)))return;
    event.preventDefault();event.stopImmediatePropagation();saveCoreProfile();
  },true);
  window.EAPCoreProfileSaveBridgeV1={save:saveCoreProfile,fields:fields};
})();
