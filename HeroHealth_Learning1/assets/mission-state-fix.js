(()=>{
'use strict';
const VERSION='20260814-MISSION-TIMELINE-R17-CHILD-COPY';
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
 route.filter(x=>x.type==='game').forEach(step=>{const ok=R.done(s,step);if(gap&&ok)delete s.gameCompleted[step.zoneId][step.gameId];if(!ok)gap=true});
 R.syncZoneCompletion(s);
 const allGamesDone=R.ZONE_ORDER.every(z=>s.completed[z]===true);
 if(!allGamesDone){s.completed.posttest=false;s.completed.postExperience=false;s.completed.reflection=false;s.completed.researchImmediate=false}
 if(!s.completed.posttest){s.completed.postExperience=false;s.completed.reflection=false;s.completed.researchImmediate=false}
 if(!s.completed.postExperience){s.completed.reflection=false;s.completed.researchImmediate=false}
 if(!s.completed.reflection)s.completed.researchImmediate=false;
 if(s.completed.posttest&&s.completed.postExperience&&s.completed.reflection)s.completed.researchImmediate=true;
 s.rotationGroup=R.groupOf(s);s.rotationZones=R.zonesFor(s);
 return{state:s,changed:before!==JSON.stringify(s)};
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function displayLabel(step){const labels={pretest:'แบบทดสอบก่อนเริ่มภารกิจ','nutrition:groups':'ภารกิจจัดอาหารให้ครบ 5 หมู่','nutrition:goodjunk':'ภารกิจเลือกอาหารสุขภาพ','fitness:jumpduck':'ภารกิจกระโดดและหลบ','fitness:balance-hold':'ภารกิจฝึกการทรงตัว','hygiene:handwash':'ภารกิจล้างมือ 7 ขั้นตอน','hygiene:toothbrush':'ภารกิจแปรงฟันให้สะอาด',posttest:'แบบทดสอบหลังจบภารกิจ',postExperience:'แบบประเมินประสบการณ์หลังเล่น',reflection:'สะท้อนการเรียนรู้'};return labels[step.id]||step.label}
function detailFor(step,ok,now){if(ok)return'เสร็จเรียบร้อยแล้ว';if(!now)return'ยังไม่ถึงขั้นนี้';if(step.id==='postExperience')return'การใช้งาน • การมีส่วนร่วม • ความพึงพอใจ';if(step.id==='reflection')return'สิ่งที่ได้เรียนรู้และสิ่งที่จะนำไปใช้';if(step.type==='assessment')return'ขั้นตอนปัจจุบัน — เริ่มทำแบบประเมิน';return matchMedia('(max-width:700px)').matches?'ภารกิจปัจจุบัน — แตะเพื่อเริ่ม':'ภารกิจปัจจุบัน — กดปุ่มเริ่มด้านบน'}
function patch(){const s=load();if(!s||!s.profile)return;const st=R.status(s),width=st.progressPct+'%';document.querySelectorAll('.progress span').forEach(el=>{if(el.style.width!==width)el.style.width=width});document.querySelectorAll('p').forEach(el=>{if(/% ของภารกิจ/.test(el.textContent||'')){const text=st.progressPct+'% ของภารกิจ';if(el.textContent!==text)el.textContent=text}});const timeline=document.querySelector('.timeline');if(timeline){const current=st.route.findIndex(step=>!R.done(s,step));const html=st.route.map((step,i)=>{const ok=R.done(s,step),now=!ok&&i===current,rowClass=ok?'done':now?'current':'locked',detail=detailFor(step,ok,now),badge=ok?'✓ ผ่านแล้ว':now?'พร้อมเริ่ม':'🔒 ยังไม่เปิด';return `<div class="step ${rowClass}" data-step-id="${esc(step.id)}" aria-current="${now?'step':'false'}"><div class="num">${ok?'✓':i+1}</div><div><b>${esc(displayLabel(step))}</b><div class="small muted">${detail}</div></div><span class="badge ${ok?'ok':now?'warn':'locked'}">${badge}</span></div>`}).join('');const signature=VERSION+'|'+R.VERSION+'|'+R.groupOf(s)+'|'+(matchMedia('(max-width:700px)').matches?'mobile':'desktop')+'|'+html;if(timeline.dataset.rotationRoute!==signature){timeline.innerHTML=html;timeline.dataset.rotationRoute=signature}}}
const result=normalize(load());if(result.state&&result.changed)save(result.state);let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})};const observer=new MutationObserver(schedule);addEventListener('DOMContentLoaded',()=>{patch();const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true})});addEventListener('storage',e=>{if(e.key===KEY)schedule()});const media=matchMedia('(max-width:700px)');if(media.addEventListener)media.addEventListener('change',schedule);else media.addListener(schedule);
})();