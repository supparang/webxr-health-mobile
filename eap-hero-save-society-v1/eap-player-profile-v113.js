/* EAP Hero v114 Player Profile Guard
   Fixes profile persistence so a saved Thai/English learner name is never lost on reload.
   Canonical profile store: EAP_HERO_PLAYER_PROFILE_V1
*/
(function(){
  'use strict';

  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY='EAP_HERO_PLAYER_PROFILE_V1';

  function readJSON(key){
    try{return JSON.parse(localStorage.getItem(key)||'{}')}catch(_){return {}}
  }
  function writeJSON(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
  function escapeHtml(v){
    return String(v||'').replace(/[&<>"']/g,function(x){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];
    });
  }
  function normalize(raw){
    raw=raw||{};
    return {
      studentId:clean(raw.studentId||raw.id||''),
      studentName:clean(raw.studentName||raw.name||''),
      section:clean(raw.section||'122')||'122'
    };
  }
  function getProfile(){
    /* The dedicated store has priority. Older game scripts may rewrite the
       progress state, but must not erase a completed player profile. */
    var direct=normalize(readJSON(PROFILE_KEY));
    var state=readJSON(STATE_KEY);
    var legacy=normalize(Object.assign({},state.profile||{},state.player||{}, {
      studentId:state.studentId||'', studentName:state.studentName||'', section:state.section||''
    }));
    return {
      studentId:direct.studentId||legacy.studentId,
      studentName:direct.studentName||legacy.studentName,
      section:direct.section||legacy.section||'122'
    };
  }
  function persist(profile){
    var p=normalize(profile);
    if(!p.studentId||!p.studentName) return false;

    /* Stable, independent store */
    writeJSON(PROFILE_KEY,p);

    /* Backward-compatible mirror for existing mission, evidence, and Sheet scripts */
    var state=readJSON(STATE_KEY);
    state.profile=Object.assign({},state.profile||{},p);
    state.player=Object.assign({},state.player||{},p);
    state.studentId=p.studentId;
    state.studentName=p.studentName;
    state.section=p.section;
    writeJSON(STATE_KEY,state);

    try{
      sessionStorage.setItem(PROFILE_KEY,JSON.stringify(p));
    }catch(_){}
    document.documentElement.dataset.eapStudentId=p.studentId;
    document.documentElement.dataset.eapStudentName=p.studentName;
    document.documentElement.dataset.eapSection=p.section;
    window.dispatchEvent(new CustomEvent('eap:profile-saved',{detail:p}));
    return true;
  }
  function flash(message){
    var old=document.getElementById('eap-profile-toast-v114'); if(old) old.remove();
    var t=document.createElement('div');
    t.id='eap-profile-toast-v114';
    t.textContent=message;
    t.style.cssText='position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100001;background:#065f46;color:#fff;padding:11px 16px;border-radius:12px;font:800 14px system-ui,-apple-system,sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.25)';
    document.body.appendChild(t);
    setTimeout(function(){if(t&&t.parentNode)t.remove()},2600);
  }
  function open(){
    var old=document.getElementById('eap-profile-modal-v114')||document.getElementById('eap-profile-modal-v113');
    if(old) old.remove();
    var p=getProfile();
    var draft={studentId:p.studentId,studentName:p.studentName,section:p.section||'122'};
    var wrap=document.createElement('div');
    wrap.id='eap-profile-modal-v114';
    wrap.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(3,15,30,.76);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,sans-serif';
    wrap.innerHTML=''
      +'<div role="dialog" aria-modal="true" style="width:min(460px,100%);background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.4);color:#102033">'
      +'<div style="font-size:24px;font-weight:900">ตั้งค่าผู้เล่นก่อนเริ่ม</div>'
      +'<p style="margin:8px 0 18px;color:#526071;line-height:1.5">บันทึกชื่อและรหัสไว้ในเครื่องนี้ก่อนเริ่มเล่น เพื่อส่งผลการเรียนให้ตรงคนใน Sheet ของอาจารย์</p>'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">รหัสนักศึกษา</label>'
      +'<input id="eap-pid-v114" value="'+escapeHtml(draft.studentId)+'" placeholder="เช่น 65010001" autocomplete="off" inputmode="numeric" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">ชื่อผู้เรียน</label>'
      +'<input id="eap-name-v114" value="'+escapeHtml(draft.studentName)+'" placeholder="ชื่อ-นามสกุล" autocomplete="name" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<label style="display:block;font-weight:800;margin:12px 0 6px">Section</label>'
      +'<input id="eap-sec-v114" value="'+escapeHtml(draft.section)+'" autocomplete="off" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px">'
      +'<div id="eap-profile-msg-v114" aria-live="polite" style="min-height:20px;color:#b42318;font-size:13px;margin-top:10px"></div>'
      +'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">'
      +'<button type="button" id="eap-profile-cancel-v114" style="padding:11px 14px;border:0;border-radius:12px;background:#e2e8f0;font-weight:800">ยกเลิก</button>'
      +'<button type="button" id="eap-profile-save-v114" style="padding:11px 16px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-weight:900">บันทึกข้อมูล</button>'
      +'</div></div>';
    document.body.appendChild(wrap);

    var idEl=document.getElementById('eap-pid-v114');
    var nameEl=document.getElementById('eap-name-v114');
    var secEl=document.getElementById('eap-sec-v114');
    var msg=document.getElementById('eap-profile-msg-v114');
    function capture(){
      draft.studentId=clean(idEl.value)||draft.studentId;
      draft.studentName=clean(nameEl.value)||draft.studentName;
      draft.section=clean(secEl.value)||draft.section||'122';
    }
    [idEl,nameEl,secEl].forEach(function(el){
      el.addEventListener('input',capture);
      el.addEventListener('change',capture);
      el.addEventListener('compositionend',capture);
      el.addEventListener('blur',capture);
    });
    document.getElementById('eap-profile-cancel-v114').onclick=function(){wrap.remove()};
    var saveBtn=document.getElementById('eap-profile-save-v114');
    saveBtn.addEventListener('pointerdown',function(e){e.preventDefault();capture()});
    saveBtn.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      capture();
      var payload={
        studentId:clean(idEl.value)||draft.studentId,
        studentName:clean(nameEl.value)||draft.studentName,
        section:clean(secEl.value)||draft.section||'122'
      };
      if(!payload.studentId||!payload.studentName){
        msg.textContent='กรุณากรอกรหัสนักศึกษาและชื่อผู้เรียนให้ครบ';
        if(!payload.studentName) nameEl.focus(); else idEl.focus();
        return;
      }
      if(!persist(payload)){
        msg.textContent='ไม่สามารถบันทึกในเบราว์เซอร์นี้ได้ กรุณาอนุญาตการใช้งาน site data แล้วลองอีกครั้ง';
        return;
      }
      wrap.remove();
      flash('บันทึกผู้เรียน '+payload.studentName+' เรียบร้อยแล้ว');
    };
  }
  function clear(){
    try{localStorage.removeItem(PROFILE_KEY)}catch(_){}
  }
  window.EAPPlayerProfile={open:open,get:getProfile,save:persist,clear:clear};
  document.addEventListener('click',function(e){
    var t=e.target.closest('button,a,[role="button"]'); if(!t)return;
    var label=(t.textContent||'').trim().toLowerCase();
    if(label==='profile'||label.includes('ตั้งค่า player')||label.includes('โปรไฟล์')){
      e.preventDefault();e.stopImmediatePropagation();open();
    }
  },true);
  window.addEventListener('load',function(){
    var p=getProfile();
    if(!p.studentId||!p.studentName||p.studentId.toLowerCase()==='guest') setTimeout(open,700);
  });
})();
