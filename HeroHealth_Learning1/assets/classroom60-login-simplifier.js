(()=>{
'use strict';
const RELEASE='20260804-CLASSROOM60-LOGIN-R56-FIREBASE-AUTO-RESUME';
const query=new URLSearchParams(location.search);
if(!query.has('authority')){
  const url=new URL(location.href);
  url.searchParams.set('authority','firebase');
  url.searchParams.set('firebaseEntry','1');
  location.replace(url.href);
  return;
}
const FIREBASE_MODE=String(query.get('authority')||'firebase').toLowerCase()==='firebase';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
const LAST_ID_KEY='herohealth_last_student_id';
let scheduled=false;
let autoResumeAttempted=false;
function state(){try{return JSON.parse(localStorage.getItem(ACTIVE_KEY)||'{}')}catch(_){return{}}}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function cleanId(value){const id=String(value||'').trim();return /^\d{5,20}$/.test(id)?id:''}
function rememberStudentId(value){const id=cleanId(value);if(!id)return;try{localStorage.setItem(LAST_ID_KEY,id);localStorage.setItem('studentId',id);localStorage.setItem('pid',id)}catch(_){}}
function candidateStudentId(){
  const s=state();
  const candidates=[
    query.get('studentId'),query.get('sid'),query.get('pid'),
    s?.profile?.studentId,s?.pendingProfile?.studentId,
    localStorage.getItem(LAST_ID_KEY),localStorage.getItem('studentId'),localStorage.getItem('pid')
  ];
  return candidates.map(cleanId).find(Boolean)||'';
}
function compactStudent(app){
  const s=state();
  if(!s?.profile)return;
  rememberStudentId(s.profile.studentId);
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
function installResume(form){
  if(!FIREBASE_MODE||!form||form.dataset.hhFirebaseResume==='1')return;
  form.dataset.hhFirebaseResume='1';
  const input=form.querySelector('input[name="studentId"],input[id*="student" i],input[type="text"]');
  const submit=form.querySelector('button[type="submit"],button.btn-primary');
  form.addEventListener('submit',()=>rememberStudentId(input?.value),true);
  input?.addEventListener('change',()=>rememberStudentId(input.value),true);
  const id=candidateStudentId();
  if(!id||!input||!submit||autoResumeAttempted)return;
  autoResumeAttempted=true;
  input.value=id;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  input.dispatchEvent(new Event('change',{bubbles:true}));
  rememberStudentId(id);
  submit.disabled=false;
  submit.textContent='กำลังกู้ข้อมูลจาก Firebase…';
  setTimeout(()=>{
    if(state()?.profile)return;
    try{
      if(typeof form.requestSubmit==='function')form.requestSubmit(submit);
      else submit.click();
      console.info('[HeroHealth Firebase Login R56] auto resume',id);
    }catch(error){
      console.warn('[HeroHealth Firebase Login R56] auto resume failed',error);
      submit.textContent='ตรวจสอบและเข้าสู่ภารกิจ';
    }
  },180);
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
  const intro=cards[0],formCard=cards[1];
  intro.dataset.hhSimplified='1';
  formCard.dataset.hhSimplified='1';
  intro.classList.add('hh-classroom60-intro');
  setText(intro.querySelector('.badge'),'ภารกิจห้องเรียน 60 นาที');
  setText(intro.querySelector('h1'),'เป็นฮีโร่สุขภาพใน 60 นาที');
  setText(intro.querySelector('p.muted'),'ภารกิจเดียวสำหรับคาบนี้ • Mobile Only • ระบบจัดลำดับฐานให้อัตโนมัติ');
  const kpis=intro.querySelector('.kpis');
  if(kpis)kpis.remove();
  formCard.classList.add('hh-classroom60-login');
  setText(formCard.querySelector('h2'),'ใส่รหัสนักเรียนเพื่อเริ่มภารกิจ');
  setText(formCard.querySelector('p.muted'),FIREBASE_MODE
    ?'ระบบจะตรวจรหัส ชื่อ ห้อง กลุ่ม และความคืบหน้าจาก Firebase โดยอัตโนมัติ'
    :'ระบบจะดึงชื่อ ห้อง กลุ่ม และความคืบหน้าจาก Google Sheet ให้อัตโนมัติ');
  setText(formCard.querySelector('button[type="submit"],button.btn-primary'),'ตรวจสอบและเข้าสู่ภารกิจ');
  installResume(formCard.querySelector('form')||formCard);
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
console.info('[HeroHealth Classroom Login R56]',{authority:FIREBASE_MODE?'firebase':'sheet',release:RELEASE});
})();