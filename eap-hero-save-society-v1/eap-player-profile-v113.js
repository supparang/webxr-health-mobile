/* EAP Hero v116 Player Profile + Player-Scoped Resume Guard
   - Student ID + Section are the primary resume identity.
   - The name is display/confirmation data only; duplicate names never merge.
   - Switching to another student on one browser stores the current local
     state separately before loading the selected student's local snapshot.
   - Server resume then reconciles verified Sheet progress on reload.
*/
(function(){
  'use strict';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  var SNAPSHOT_PREFIX='EAP_HERO_PLAYER_STATE_V1_';

  function readJSON(key){ try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}} }
  function writeJSON(key,value){ try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false} }
  function clean(value){ return String(value==null?'':value).replace(/\s+/g,' ').trim(); }
  function escapeHtml(value){ return String(value||'').replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function normalize(raw){
    raw=raw||{};
    return {
      studentId:clean(raw.studentId||raw.id||''),
      studentName:clean(raw.studentName||raw.name||''),
      section:clean(raw.section||'122')||'122'
    };
  }
  function valid(profile){ return !!(profile&&profile.studentId&&profile.studentName&&profile.studentId.toLowerCase()!=='guest'); }
  function playerKey(profile){
    var p=normalize(profile);
    return encodeURIComponent(p.section+'__'+p.studentId);
  }
  function stateKey(profile){ return SNAPSHOT_PREFIX+playerKey(profile); }
  function aliases(profile){
    var p=normalize(profile);
    return { id:p.studentId,name:p.studentName,studentId:p.studentId,studentName:p.studentName,section:p.section };
  }
  function profileFromState(state){
    state=state||{};
    return normalize(Object.assign({},state.profile||{},state.player||{},state.user||{}, {
      id:state.id||'', name:state.name||state.playerName||'',
      studentId:state.studentId||'', studentName:state.studentName||'', section:state.section||''
    }));
  }
  function profileFromStorage(){
    var direct=normalize(readJSON(PROFILE_KEY));
    var stateProfile=profileFromState(readJSON(STATE_KEY));
    return valid(direct)?direct:stateProfile;
  }
  function blankState(profile){
    var a=aliases(profile);
    return {
      profile:a, player:a, user:a,
      id:a.id, name:a.name, playerName:a.name,
      studentId:a.studentId, studentName:a.studentName, section:a.section,
      portfolio:[], evidence:[], attempts:[],
      completedSessions:{}, sessionProgress:{}, unlockedSessions:{},
      playerScopedState:true, createdAt:new Date().toISOString()
    };
  }
  function mirrorProfileIntoState(state, profile){
    var a=aliases(profile);
    state=state&&typeof state==='object'?state:{};
    state.profile=Object.assign({},state.profile||{},a);
    state.player=Object.assign({},state.player||{},a);
    state.user=Object.assign({},state.user||{},a);
    state.id=a.id; state.name=a.name; state.playerName=a.name;
    state.studentId=a.studentId; state.studentName=a.studentName; state.section=a.section;
    state.__activePlayer={studentId:a.studentId,section:a.section,at:new Date().toISOString()};
    return state;
  }
  function mirrorToCore(profile){
    var p=normalize(profile);
    if(!valid(p)) return false;

    var oldDirect=normalize(readJSON(PROFILE_KEY));
    var active=normalize(readJSON(ACTIVE_KEY));
    var current=readJSON(STATE_KEY);
    var old=valid(active)?active:(valid(oldDirect)?oldDirect:profileFromState(current));
    var oldKey=valid(old)?playerKey(old):'';
    var nextKey=playerKey(p);

    /* Prevent a shared browser from leaking one learner's progress to another. */
    if(oldKey && oldKey!==nextKey){
      writeJSON(stateKey(old),mirrorProfileIntoState(current,old));
      current=readJSON(stateKey(p));
      if(!current || !Object.keys(current).length) current=blankState(p);
    } else if(!current || !Object.keys(current).length) {
      current=readJSON(stateKey(p));
      if(!current || !Object.keys(current).length) current=blankState(p);
    }

    current=mirrorProfileIntoState(current,p);
    var a=aliases(p);
    var ok=writeJSON(STATE_KEY,current);
    writeJSON(stateKey(p),current);
    writeJSON(PROFILE_KEY,a);
    writeJSON(ACTIVE_KEY,a);
    try{sessionStorage.setItem(PROFILE_KEY,JSON.stringify(a));}catch(_){}
    try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(current),storageArea:localStorage}));}catch(_){}
    window.dispatchEvent(new CustomEvent('eap:profile-saved',{detail:a}));
    return ok;
  }
  function paintHome(profile){
    var p=normalize(profile);
    if(!valid(p)) return;
    document.documentElement.dataset.eapStudentId=p.studentId;
    document.documentElement.dataset.eapStudentName=p.studentName;
    document.documentElement.dataset.eapSection=p.section;
    var leaves=[].slice.call(document.querySelectorAll('body *')).filter(function(el){ return el.children.length===0; });
    leaves.forEach(function(el){ if(clean(el.textContent)==='Guest') el.textContent=p.studentName; });
  }
  function flash(message){
    var old=document.getElementById('eap-profile-toast-v116'); if(old) old.remove();
    var toast=document.createElement('div');
    toast.id='eap-profile-toast-v116'; toast.textContent=message;
    toast.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100001;background:#065f46;color:#fff;padding:11px 16px;border-radius:12px;font:800 14px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';
    document.body.appendChild(toast);
    setTimeout(function(){ if(toast.parentNode) toast.remove(); },2600);
  }
  function open(){
    var old=document.getElementById('eap-profile-modal-v116')||document.getElementById('eap-profile-modal-v115')||document.getElementById('eap-profile-modal-v114')||document.getElementById('eap-profile-modal-v113');
    if(old) old.remove();
    var saved=profileFromStorage();
    var wrap=document.createElement('div');
    wrap.id='eap-profile-modal-v116';
    wrap.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(3,15,30,.76);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,sans-serif';
    wrap.innerHTML=''
      +'<div role="dialog" aria-modal="true" style="width:min(480px,100%);background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.4);color:#102033">'
      +'<div style="font-size:24px;font-weight:900">เข้าสู่เส้นทางการเรียนของฉัน</div>'
      +'<p style="margin:8px 0 18px;color:#526071;line-height:1.5">ใช้รหัสนักศึกษาและ Section เพื่อดึงความคืบหน้าที่บันทึกไว้จาก Sheet แล้วเรียนต่อจากจุดเดิม ชื่อใช้สำหรับแสดงผลเท่านั้น</p>'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">รหัสนักศึกษา</label>'
      +'<input id="eap-pid-v116" value="'+escapeHtml(saved.studentId)+'" placeholder="เช่น 65010001" autocomplete="off" inputmode="numeric" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">ชื่อผู้เรียน</label>'
      +'<input id="eap-name-v116" value="'+escapeHtml(saved.studentName)+'" placeholder="ชื่อ-นามสกุล" autocomplete="name" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">Section</label>'
      +'<input id="eap-sec-v116" value="'+escapeHtml(saved.section||'122')+'" autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<div id="eap-profile-msg-v116" aria-live="polite" style="min-height:20px;color:#b42318;font-size:13px;margin-top:10px"></div>'
      +'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">'
      +'<button type="button" id="eap-profile-cancel-v116" style="padding:11px 14px;border:0;border-radius:12px;background:#e2e8f0;font-weight:800">ยกเลิก</button>'
      +'<button type="button" id="eap-profile-save-v116" style="padding:11px 16px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-weight:900">เรียนต่อ</button>'
      +'</div></div>';
    document.body.appendChild(wrap);
    var idEl=document.getElementById('eap-pid-v116');
    var nameEl=document.getElementById('eap-name-v116');
    var secEl=document.getElementById('eap-sec-v116');
    var msg=document.getElementById('eap-profile-msg-v116');
    document.getElementById('eap-profile-cancel-v116').onclick=function(){wrap.remove();};
    document.getElementById('eap-profile-save-v116').onclick=function(event){
      event.preventDefault();
      var p=normalize({studentId:idEl.value,studentName:nameEl.value,section:secEl.value||'122'});
      if(!valid(p)){ msg.textContent='กรุณากรอกรหัสนักศึกษาและชื่อผู้เรียนให้ครบ'; (!p.studentName?nameEl:idEl).focus(); return; }
      if(!mirrorToCore(p)){ msg.textContent='ไม่สามารถบันทึกในเบราว์เซอร์นี้ได้ กรุณาอนุญาต site data แล้วลองอีกครั้ง'; return; }
      paintHome(p); wrap.remove();
      flash('กำลังเปิดความคืบหน้าของ '+p.studentName+' จากจุดที่บันทึกไว้…');
      setTimeout(function(){ location.reload(); },450);
    };
  }
  function clear(){ try{localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(ACTIVE_KEY);}catch(_){} }
  function get(){ return profileFromStorage(); }
  var boot=profileFromStorage();
  if(valid(boot)) mirrorToCore(boot);
  window.EAPPlayerProfile={open:open,get:get,save:mirrorToCore,clear:clear,playerKey:playerKey};
  document.addEventListener('click',function(e){
    var target=e.target.closest('button,a,[role="button"]'); if(!target) return;
    var label=clean(target.textContent).toLowerCase();
    if(label==='profile'||label.includes('ตั้งค่า player')||label.includes('โปรไฟล์')){ e.preventDefault(); e.stopImmediatePropagation(); open(); }
  },true);
  window.addEventListener('load',function(){
    var p=profileFromStorage();
    if(valid(p)) { mirrorToCore(p); setTimeout(function(){paintHome(p);},80); }
    else setTimeout(open,700);
  });
})();
