/* EAP Hero v115 Player Profile Guard
   Persists aliases used by the core game and refreshes the home status after saving.
*/
(function(){
  'use strict';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';

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
  function aliases(profile){
    var p=normalize(profile);
    return {
      id:p.studentId,
      name:p.studentName,
      studentId:p.studentId,
      studentName:p.studentName,
      section:p.section
    };
  }
  function profileFromStorage(){
    var direct=normalize(readJSON(PROFILE_KEY));
    var state=readJSON(STATE_KEY);
    var stateProfile=normalize(Object.assign({},state.profile||{},state.player||{},state.user||{}, {
      id:state.id||'', name:state.name||state.playerName||'',
      studentId:state.studentId||'', studentName:state.studentName||'', section:state.section||''
    }));
    return valid(direct)?direct:stateProfile;
  }
  function mirrorToCore(profile){
    var p=normalize(profile);
    if(!valid(p)) return false;
    var a=aliases(p);
    writeJSON(PROFILE_KEY,a);
    var state=readJSON(STATE_KEY);
    state.profile=Object.assign({},state.profile||{},a);
    state.player=Object.assign({},state.player||{},a);
    state.user=Object.assign({},state.user||{},a);
    state.id=a.id;
    state.name=a.name;
    state.playerName=a.name;
    state.studentId=a.studentId;
    state.studentName=a.studentName;
    state.section=a.section;
    var ok=writeJSON(STATE_KEY,state);
    try{sessionStorage.setItem(PROFILE_KEY,JSON.stringify(a));}catch(_){}
    try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(state),storageArea:localStorage}));}catch(_){}
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
    leaves.forEach(function(el){
      var text=clean(el.textContent);
      if(text==='Guest') el.textContent=p.studentName;
    });
  }
  function flash(message){
    var old=document.getElementById('eap-profile-toast-v115'); if(old) old.remove();
    var toast=document.createElement('div');
    toast.id='eap-profile-toast-v115'; toast.textContent=message;
    toast.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100001;background:#065f46;color:#fff;padding:11px 16px;border-radius:12px;font:800 14px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';
    document.body.appendChild(toast);
    setTimeout(function(){ if(toast.parentNode) toast.remove(); },2200);
  }
  function open(){
    var old=document.getElementById('eap-profile-modal-v115')||document.getElementById('eap-profile-modal-v114')||document.getElementById('eap-profile-modal-v113');
    if(old) old.remove();
    var saved=profileFromStorage();
    var wrap=document.createElement('div');
    wrap.id='eap-profile-modal-v115';
    wrap.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(3,15,30,.76);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,sans-serif';
    wrap.innerHTML=''
      +'<div role="dialog" aria-modal="true" style="width:min(460px,100%);background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.4);color:#102033">'
      +'<div style="font-size:24px;font-weight:900">ตั้งค่าผู้เล่นก่อนเริ่ม</div>'
      +'<p style="margin:8px 0 18px;color:#526071;line-height:1.5">บันทึกชื่อและรหัสไว้ในเครื่องนี้ แล้วสถานะ Player จะอัปเดตอัตโนมัติ</p>'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">รหัสนักศึกษา</label>'
      +'<input id="eap-pid-v115" value="'+escapeHtml(saved.studentId)+'" placeholder="เช่น 65010001" autocomplete="off" inputmode="numeric" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">ชื่อผู้เรียน</label>'
      +'<input id="eap-name-v115" value="'+escapeHtml(saved.studentName)+'" placeholder="ชื่อ-นามสกุล" autocomplete="name" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">Section</label>'
      +'<input id="eap-sec-v115" value="'+escapeHtml(saved.section||'122')+'" autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<div id="eap-profile-msg-v115" aria-live="polite" style="min-height:20px;color:#b42318;font-size:13px;margin-top:10px"></div>'
      +'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">'
      +'<button type="button" id="eap-profile-cancel-v115" style="padding:11px 14px;border:0;border-radius:12px;background:#e2e8f0;font-weight:800">ยกเลิก</button>'
      +'<button type="button" id="eap-profile-save-v115" style="padding:11px 16px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-weight:900">บันทึกข้อมูล</button>'
      +'</div></div>';
    document.body.appendChild(wrap);
    var idEl=document.getElementById('eap-pid-v115');
    var nameEl=document.getElementById('eap-name-v115');
    var secEl=document.getElementById('eap-sec-v115');
    var msg=document.getElementById('eap-profile-msg-v115');
    document.getElementById('eap-profile-cancel-v115').onclick=function(){wrap.remove();};
    document.getElementById('eap-profile-save-v115').onclick=function(event){
      event.preventDefault();
      var p=normalize({studentId:idEl.value,studentName:nameEl.value,section:secEl.value||'122'});
      if(!valid(p)){
        msg.textContent='กรุณากรอกรหัสนักศึกษาและชื่อผู้เรียนให้ครบ';
        (!p.studentName?nameEl:idEl).focus();
        return;
      }
      if(!mirrorToCore(p)){
        msg.textContent='ไม่สามารถบันทึกในเบราว์เซอร์นี้ได้ กรุณาอนุญาต site data แล้วลองอีกครั้ง';
        return;
      }
      paintHome(p);
      wrap.remove();
      flash('บันทึก '+p.studentName+' แล้ว กำลังอัปเดตสถานะผู้เล่น…');
      /* The core app reads the progress object only at start-up. Reload only
         after the profile is safely mirrored to every legacy field. */
      setTimeout(function(){ location.reload(); },450);
    };
  }
  function clear(){ try{localStorage.removeItem(PROFILE_KEY);}catch(_){} }
  function get(){ return profileFromStorage(); }
  /* Restore dedicated profile into the older main state whenever the page starts. */
  var boot=profileFromStorage();
  if(valid(boot)) mirrorToCore(boot);
  window.EAPPlayerProfile={open:open,get:get,save:mirrorToCore,clear:clear};
  document.addEventListener('click',function(e){
    var target=e.target.closest('button,a,[role="button"]'); if(!target) return;
    var label=clean(target.textContent).toLowerCase();
    if(label==='profile'||label.includes('ตั้งค่า player')||label.includes('โปรไฟล์')){
      e.preventDefault(); e.stopImmediatePropagation(); open();
    }
  },true);
  window.addEventListener('load',function(){
    var p=profileFromStorage();
    if(valid(p)) { mirrorToCore(p); setTimeout(function(){paintHome(p);},80); }
    else setTimeout(open,700);
  });
})();
