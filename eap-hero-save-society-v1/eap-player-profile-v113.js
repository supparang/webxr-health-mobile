/* EAP Hero v113 Player Profile Guard
   Requires student ID, name, and section before new gameplay data is sent to Sheets.
*/
(function(){
  'use strict';
  var KEY='EAP_HERO_PROGRESS_V3';
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return {}}}
  function save(state){localStorage.setItem(KEY,JSON.stringify(state))}
  function getProfile(){var s=load(),p=s.profile||s.player||{};return {studentId:String(p.studentId||p.id||s.studentId||''),studentName:String(p.studentName||p.name||s.studentName||''),section:String(p.section||s.section||'122')}}
  function open(){
    var old=document.getElementById('eap-profile-modal-v113'); if(old) old.remove();
    var p=getProfile();
    var wrap=document.createElement('div'); wrap.id='eap-profile-modal-v113';
    wrap.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(3,15,30,.76);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,sans-serif';
    wrap.innerHTML='<div style="width:min(460px,100%);background:#fff;border-radius:20px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.4);color:#102033"><div style="font-size:24px;font-weight:900">ตั้งค่าผู้เล่นก่อนเริ่ม</div><p style="margin:8px 0 18px;color:#526071;line-height:1.5">ข้อมูลนี้จะแสดงใน Sheet ของอาจารย์ เพื่อให้ผลการเล่นไม่ถูกบันทึกเป็น Guest</p><label style="display:block;font-weight:800;margin:12px 0 6px">รหัสนักศึกษา</label><input id="eap-pid-v113" value="'+escapeHtml(p.studentId)+'" placeholder="เช่น 65010001" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px"><label style="display:block;font-weight:800;margin:12px 0 6px">ชื่อผู้เรียน</label><input id="eap-name-v113" value="'+escapeHtml(p.studentName)+'" placeholder="ชื่อ-นามสกุล" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px"><label style="display:block;font-weight:800;margin:12px 0 6px">Section</label><input id="eap-sec-v113" value="'+escapeHtml(p.section||'122')+'" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px"><div id="eap-profile-msg-v113" style="min-height:20px;color:#b42318;font-size:13px;margin-top:10px"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px"><button id="eap-profile-cancel-v113" style="padding:11px 14px;border:0;border-radius:12px;background:#e2e8f0;font-weight:800">ยกเลิก</button><button id="eap-profile-save-v113" style="padding:11px 16px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-weight:900">บันทึกข้อมูล</button></div></div>';
    document.body.appendChild(wrap);
    document.getElementById('eap-profile-cancel-v113').onclick=function(){wrap.remove()};
    document.getElementById('eap-profile-save-v113').onclick=function(){
      var id=document.getElementById('eap-pid-v113').value.trim(),name=document.getElementById('eap-name-v113').value.trim(),sec=document.getElementById('eap-sec-v113').value.trim()||'122';
      if(!id||!name){document.getElementById('eap-profile-msg-v113').textContent='กรุณากรอกรหัสนักศึกษาและชื่อผู้เรียน';return}
      var s=load(); s.profile=Object.assign({},s.profile||{}, {studentId:id,studentName:name,section:sec}); s.player=Object.assign({},s.player||{}, {studentId:id,studentName:name,section:sec}); s.studentId=id; s.studentName=name; s.section=sec; save(s); wrap.remove(); location.reload();
    };
  }
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]})}
  window.EAPPlayerProfile={open:open,get:getProfile};
  document.addEventListener('click',function(e){var t=e.target.closest('button,a,[role="button"]');if(!t)return;var label=(t.textContent||'').trim().toLowerCase();if(label==='profile'||label.includes('ตั้งค่า player')||label.includes('โปรไฟล์')){e.preventDefault();e.stopImmediatePropagation();open()}},true);
  window.addEventListener('load',function(){var p=getProfile();if(!p.studentId||!p.studentName||p.studentId==='guest')setTimeout(open,700)});
})();
