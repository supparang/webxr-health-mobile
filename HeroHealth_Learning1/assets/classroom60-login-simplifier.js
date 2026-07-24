(()=>{
'use strict';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
function state(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'{}')}catch(_){return{}}}
function simplify(){
  const s=state();
  if(s?.profile||s?.pendingProfile)return;
  const app=document.getElementById('app');
  if(!app)return;
  const hero=app.querySelector('.hero');
  if(!hero)return;
  const cards=hero.querySelectorAll(':scope > .card');
  if(cards.length<2)return;
  const intro=cards[0],form=cards[1];
  intro.classList.add('hh-classroom60-intro');
  const badge=intro.querySelector('.badge');
  if(badge)badge.textContent='ภารกิจห้องเรียน 60 นาที';
  const heading=intro.querySelector('h1');
  if(heading)heading.textContent='เป็นฮีโร่สุขภาพใน 60 นาที';
  const profileText=intro.querySelector('p.muted');
  if(profileText)profileText.textContent='ภารกิจเดียวสำหรับคาบนี้ • Mobile Only • ระบบจัดลำดับฐานให้อัตโนมัติ';
  const kpis=intro.querySelector('.kpis');
  if(kpis)kpis.remove();
  form.classList.add('hh-classroom60-login');
  const formTitle=form.querySelector('h2');
  if(formTitle)formTitle.textContent='ใส่รหัสนักเรียนเพื่อเริ่มภารกิจ';
  const formHelp=form.querySelector('p.muted');
  if(formHelp)formHelp.textContent='ระบบจะดึงชื่อ ห้อง กลุ่ม และความคืบหน้าจาก Google Sheet ให้อัตโนมัติ';
  const submit=form.querySelector('button[type="submit"],button.btn-primary');
  if(submit)submit.textContent='ตรวจสอบและเข้าสู่ภารกิจ';
  const nav=app.querySelector('.topbar .nav');
  if(nav)nav.hidden=true;
  const teacher=app.querySelector('.topbar > .btn');
  if(teacher)teacher.hidden=true;
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
  .topbar:has(+ main .hh-classroom60-login){padding:12px 16px!important}
}
`;
document.head.appendChild(style);
new MutationObserver(simplify).observe(document.documentElement,{subtree:true,childList:true});
simplify();
})();
