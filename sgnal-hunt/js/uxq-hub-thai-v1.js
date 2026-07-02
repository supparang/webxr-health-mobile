(() => {
  'use strict';
  const text = {
    pathW1:'W1 • นักสืบปัญหา UX', pathW2:'W2 • คิดเชิงออกแบบ', pathW3:'W3 • ลดภาระความคิด', pathB1:'B1 • บอสพายุความสับสน', pathW4:'W4 • ห้องแล็บถอดรหัสผู้ใช้',
    nodeW2:['ภารกิจคิดเชิงออกแบบ','เข้าใจผู้ใช้ → ตั้งโจทย์ → สร้างแนวคิด → ทำต้นแบบ → ทดสอบ'],
    nodeW3:['ด่านลดภาระความคิด','จัดข้อมูลให้ผู้ใช้เห็นสิ่งสำคัญและไม่ต้องเดา'],
    nodeB1:['บอสพายุความสับสน','กู้ระบบที่ผู้ใช้หาไม่เจอ เข้าใจสถานะผิด และไปต่อไม่ถูก'],
    nodeW4:['ห้องแล็บถอดรหัสผู้ใช้','สแกนเสียงผู้ใช้ แยกสิ่งที่เห็นจริง สกัดความเข้าใจเชิงลึก และตั้งโจทย์']
  };
  const thaiState = {LOCKED:'ล็อกอยู่',READY:'พร้อมเริ่ม',CLEARED:'ผ่านแล้ว','BOSS READY':'บอสพร้อม','BOSS GATE':'ด่านบอส','ACT II READY':'พร้อมเข้าสู่ภารกิจถัดไป','ACT II LOCKED':'ภารกิจถัดไปยังล็อกอยู่','INSIGHT SECURED':'ยืนยันความเข้าใจผู้ใช้แล้ว','MISSION READY':'พร้อมเริ่มภารกิจ','REPLAY OR ADVANCE':'เล่นซ้ำหรือไปต่อ','ACT II SECURED':'ผ่านภารกิจแล้ว'};
  function set(id, value){ const el=document.getElementById(id); if(el) el.textContent=value; }
  function apply(){
    Object.entries(text).forEach(([id,value])=>{ const el=document.getElementById(id); if(!el)return; if(Array.isArray(value)){ const h=el.querySelector('h3'), p=el.querySelector('p'); if(h)h.textContent=value[0]; if(p)p.textContent=value[1]; } else { const b=el.querySelector('b'); if(b)b.textContent=value; }});
    document.querySelectorAll('.stage-state,#nowStatus').forEach(el=>{ const v=el.textContent.trim(); if(thaiState[v])el.textContent=thaiState[v]; });
    set('menuScoreText', document.getElementById('menuScoreText')?.textContent.replace('Best score','คะแนนสูงสุด'));
    const hint=document.getElementById('pathHint'); if(hint){ hint.textContent=hint.textContent.replaceAll('Readiness','ระดับความพร้อม').replaceAll('Cognitive Storm','บอสพายุความสับสน').replaceAll('User Insight Lab','ห้องแล็บถอดรหัสผู้ใช้').replaceAll('Casefile','คดี'); }
    document.querySelectorAll('button,a').forEach(el=>{ el.textContent=el.textContent.replaceAll('Friction Core Locked','ด่านบอสยังล็อกอยู่').replaceAll('Insight Lab Locked','ห้องแล็บยังล็อกอยู่').replaceAll('เข้าสู่ Cognitive Storm','เข้าสู่บอสพายุความสับสน').replaceAll('เข้าสู่ User Insight Lab','เข้าสู่ห้องแล็บถอดรหัสผู้ใช้').replaceAll('เล่น Insight Lab อีกครั้ง','เล่นห้องแล็บอีกครั้ง').replaceAll('เล่น Boss อีกครั้ง','เล่นบอสอีกครั้ง'); });
  }
  addEventListener('DOMContentLoaded',()=>{ apply(); new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true}); },{once:true});
})();