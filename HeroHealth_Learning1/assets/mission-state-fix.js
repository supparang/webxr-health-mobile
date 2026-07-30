(()=>{
'use strict';
const VERSION='20260730-MISSION-TIMELINE-UI-V3';
const KEY='herohealth_learning_platform_rc2';
const R=window.HHRotation;
if(!R)return;
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function normalize(s){
 if(!s||!s.profile)return{state:s,changed:false};
 const before=JSON.stringify(s),route=R.routeFor(s);
 s.completed=s.completed||{};s.gameCompleted=s.gameCompleted||{};
 R.syncZoneCompletion(s);
 let gap=!s.completed.pretest;
 route.filter(x=>x.type==='game').forEach(step=>{
  const ok=R.done(s,step);
  if(gap&&ok)delete s.gameCompleted[step.zoneId][step.gameId];
  if(!ok)gap=true;
 });
 R.syncZoneCompletion(s);
 const allGamesDone=R.ZONE_ORDER.every(z=>s.completed[z]===true);
 if(!allGamesDone){s.completed.posttest=false;s.completed.reflection=false}
 if(!s.completed.posttest)s.completed.reflection=false;
 s.rotationGroup=R.groupOf(s);
 s.rotationZones=R.zonesFor(s);
 return{state:s,changed:before!==JSON.stringify(s)};
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function displayLabel(step){
 const labels={
  pretest:'Pre-test',
  'nutrition:groups':'Food Groups AR — จัดอาหารให้ถูก 5 หมู่',
  'nutrition:goodjunk':'GoodJunk AR — เลือกอาหารสุขภาพ',
  'fitness:jumpduck':'JumpDuck AR — กระโดดและหลบ',
  'fitness:balance-hold':'Balance Hold AR — ฝึกการทรงตัว',
  'hygiene:handwash':'Handwash AR — ล้างมือ 7 ขั้นตอน',
  'hygiene:toothbrush':'Toothbrush AR — แปรงฟันให้สะอาด',
  posttest:'Post-test',
  reflection:'Reflection — สะท้อนการเรียนรู้'
 };
 return labels[step.id]||step.label;
}
function patch(){
 const s=load();if(!s||!s.profile)return;
 const st=R.status(s),width=st.progressPct+'%';
 document.querySelectorAll('.progress span').forEach(el=>{if(el.style.width!==width)el.style.width=width});
 document.querySelectorAll('p').forEach(el=>{if(/% ของภารกิจ/.test(el.textContent||'')){const text=st.progressPct+'% ของภารกิจ';if(el.textContent!==text)el.textContent=text}});
 const timeline=document.querySelector('.timeline');
 if(timeline){
  const current=st.route.findIndex(step=>!R.done(s,step));
  const html=st.route.map((step,i)=>{
   const ok=R.done(s,step),now=!ok&&i===current;
   const rowClass=ok?'done':now?'current':'locked';
   const detail=ok?'เสร็จเรียบร้อยแล้ว':now?'ภารกิจปัจจุบัน — แตะ “เริ่มภารกิจ” ด้านขวา':'ยังไม่ถึงขั้นนี้';
   const badge=ok?'✓ ผ่านแล้ว':now?'เริ่มภารกิจ ›':'🔒 ยังไม่เปิด';
   return `<div class="step ${rowClass}" data-step-id="${esc(step.id)}" aria-current="${now?'step':'false'}"><div class="num">${ok?'✓':i+1}</div><div><b>${esc(displayLabel(step))}</b><div class="small muted">${detail}</div></div><span class="badge ${ok?'ok':now?'warn':'locked'}">${badge}</span></div>`;
  }).join('');
  const signature=VERSION+'|'+R.groupOf(s)+'|'+html;
  if(timeline.dataset.rotationRoute!==signature){timeline.innerHTML=html;timeline.dataset.rotationRoute=signature}
 }
}
const result=normalize(load());if(result.state&&result.changed)save(result.state);
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})};
const observer=new MutationObserver(schedule);
addEventListener('DOMContentLoaded',()=>{patch();const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true})});
addEventListener('storage',e=>{if(e.key===KEY)schedule()});
})();