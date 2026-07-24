(()=>{
'use strict';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
let scheduled=false;
function state(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'{}')}catch(_){return{}}}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function simplify(){
  scheduled=false;
  const s=state();
  if(s?.profile||s?.pendingProfile)return;
  const app=document.getElementById('app');
  if(!app)return;
  const hero=app.querySelector('.hero');
  if(!hero)return;
  const cards=hero.querySelectorAll(':scope > .card');
  if(cards.length<2)return;
  const intro=cards[0],form=cards[1];
  if(intro.dataset.hhSimplified==='1'&&form.dataset.hhSimplified==='1')return;
  intro.dataset.hhSimplified='1';
  form.dataset.hhSimplified='1';
  intro.classList.add('hh-classroom60-intro');
  setText(intro.querySelector('.badge'),'ภารกิจห้องเรียน 60 นาที');
  setText(intro.querySelector('h1'),'เป็นฮีโร่สุขภาพใน 60 นาที');
  setText(intro.querySelector('p.muted'),'ภารกิจเดียวสำหรับคาบนี้ • Mobile Only • ระบบจัดลำดับฐานให้อัตโนมัติ');
  const kpis=intro.querySelector('.kpis');
  if(kpis)kpis.remove();
  form.classList.add('hh-classroom60-login');
  setText(form.querySelector('h2'),'ใส่รหัสนักเรียนเพื่อเริ่มภารกิจ');
  setText(form.querySelector('p.muted'),'ระบบจะดึงชื่อ ห้อง กลุ่ม และความคืบหน้าจาก Google Sheet ให้อัตโนมัติ');
  setText(form.querySelector('button[type="submit"],button.btn-primary'),'ตรวจสอบและเข้าสู่ภารกิจ');
  const nav=app.querySelector('.topbar .nav');
  if(nav&&!nav.hidden)nav.hidden=true;
  const teacher=app.querySelector('.topbar > .btn');
  if(teacher&&!teacher.hidden)teacher.hidden=true;
}
function requestSimplify(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(simplify);
}
const style=document.createElement('style');
style.textContent=`
@media (max-width:760px){
  .hh-classroom60-intro{padding:24px!important;min-height:auto!important}
  .hh-classroom60-intro h1{font-size:clamp(38px,12vw,56px)!important;line-height:1.14!important;margin:16px 0 12px!important}
  .hh-classroom60-intro p{font-size:17px!important;line-height:1.55!important;margin:0!important}
  .hh-classroom60-login{padding:24px!important}
  .hh-classroom60-login h2{font-size:25px!important;line-height:1.3!important;margin-top:0!important}
  .hh-classroom60-login .field input{min-height:56px!important;font-size:20px!important}
  .hh-classroom60-login .btn{min-height:56px!important;font-size:18px!important}
  .hero:has(.hh-classroom60-login){display:grid!important;grid-template-columns:1fr!important;gap:16px!important}
}
`;
document.head.appendChild(style);
const app=document.getElementById('app');
if(app)new MutationObserver(requestSimplify).observe(app,{childList:true});
requestSimplify();
})();
