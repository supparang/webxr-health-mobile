(()=>{
'use strict';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
let scheduled=false;
function state(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'{}')}catch(_){return{}}}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function compactStudent(app){
  const s=state();
  if(!s?.profile)return;
  const main=app.querySelector('main.container');
  if(!main)return;
  main.classList.add('hh-student-mobile-compact');
  const headings=[...main.querySelectorAll(':scope > h2')];
  const learningHeading=headings.find(h=>/ฐานเรียนรู้/.test(String(h.textContent||'')));
  if(learningHeading){
    learningHeading.classList.add('hh-learning-details-heading');
    const grid=learningHeading.nextElementSibling;
    if(grid?.classList.contains('grid'))grid.classList.add('hh-learning-details-grid');
  }
  const hero=main.querySelector(':scope > .hero');
  if(hero){
    const cards=hero.querySelectorAll(':scope > .card');
    cards[0]?.classList.add('hh-passport-compact');
    cards[1]?.classList.add('hh-next-action-compact');
  }
  const timeline=main.querySelector(':scope > .timeline');
  timeline?.classList.add('hh-timeline-compact');
}
function simplify(){
  scheduled=false;
  const s=state();
  const app=document.getElementById('app');
  if(!app)return;
  if(s?.profile){compactStudent(app);return;}
  if(s?.pendingProfile)return;
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

  .hh-student-mobile-compact{padding-top:14px!important;padding-bottom:28px!important}
  .hh-student-mobile-compact>.hero{gap:12px!important}
  .hh-passport-compact{padding:18px!important}
  .hh-passport-compact .passport{grid-template-columns:74px 1fr!important;gap:14px!important}
  .hh-passport-compact .avatar{width:74px!important;height:74px!important;font-size:40px!important}
  .hh-passport-compact h1{font-size:clamp(29px,8vw,40px)!important;line-height:1.1!important;margin:7px 0!important}
  .hh-passport-compact p{font-size:16px!important}
  .hh-next-action-compact{padding:20px!important}
  .hh-next-action-compact h2{font-size:27px!important;margin:0 0 8px!important}
  .hh-next-action-compact .muted{font-size:18px!important;margin:8px 0 14px!important}
  .hh-next-action-compact .btn{min-height:52px!important;font-size:18px!important}
  .hh-student-mobile-compact>:scope>h2{font-size:28px!important;margin:20px 0 12px!important}
  .hh-timeline-compact{gap:8px!important}
  .hh-timeline-compact .step{padding:13px 14px!important;min-height:72px!important}
  .hh-timeline-compact .step .num{width:44px!important;height:44px!important;font-size:20px!important}
  .hh-timeline-compact .step b{font-size:18px!important}
  .hh-timeline-compact .step .small{font-size:14px!important}
  .hh-learning-details-heading,.hh-learning-details-grid{display:none!important}
}
`;
document.head.appendChild(style);
const app=document.getElementById('app');
if(app)new MutationObserver(requestSimplify).observe(app,{childList:true,subtree:true});
requestSimplify();
})();