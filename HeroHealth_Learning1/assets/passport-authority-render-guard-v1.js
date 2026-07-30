(()=>{
'use strict';
const KEY='herohealth_learning_platform_rc2';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}}
function waiting(s){return !!s?.profile?.studentId&&(s.sheetAuthority!==true||!String(s.mobileAuthorityVersion||'').includes('V8.1'))}
function apply(){
  const s=read();
  if(!waiting(s)){document.documentElement.dataset.hhAuthorityRender='ready';return}
  document.documentElement.dataset.hhAuthorityRender='waiting';
  const app=document.getElementById('app');
  if(!app)return;
  const actionCard=app.querySelector('main.container > .hero > .card:not(.hero-card)');
  if(actionCard){
    actionCard.innerHTML='<h2>กำลังตรวจสอบ Google Sheet</h2><p class="muted">กรุณารอสักครู่ ระบบยังไม่อนุญาตให้เริ่ม Pre-test หรือเกมจนกว่าจะโหลดความคืบหน้าจริงสำเร็จ</p><button class="btn btn-primary" style="width:100%" disabled>กำลังโหลดสถานะนักเรียน…</button>';
  }
  app.querySelectorAll('button[onclick*="openRoute"],button[onclick*="openNextGame"]').forEach(b=>b.disabled=true);
}
const app=document.getElementById('app');
if(app)new MutationObserver(apply).observe(app,{childList:true,subtree:true});
addEventListener('storage',e=>{if(e.key===KEY)apply()});
setInterval(apply,500);
apply();
})();