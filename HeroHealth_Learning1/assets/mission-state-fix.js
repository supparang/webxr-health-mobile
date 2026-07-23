(()=>{
'use strict';
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
function patch(){
 const s=load();if(!s||!s.profile)return;
 const st=R.status(s),width=st.progressPct+'%';
 document.querySelectorAll('.progress span').forEach(el=>{if(el.style.width!==width)el.style.width=width});
 document.querySelectorAll('p').forEach(el=>{if(/% ของภารกิจ/.test(el.textContent||'')){const text=st.progressPct+'% ของภารกิจ';if(el.textContent!==text)el.textContent=text}});
 const timeline=document.querySelector('.timeline');
 if(timeline){
  const current=st.route.findIndex(step=>!R.done(s,step));
  const html=st.route.map((step,i)=>{const ok=R.done(s,step),now=!ok&&i===current;return `<div class="step ${ok?'done':''}"><div class="num">${ok?'✓':i+1}</div><div><b>${esc(step.label)}</b><div class="small muted">${ok?'เสร็จแล้ว':now?'ภารกิจถัดไป':'รอดำเนินการ'}</div></div><span class="badge ${ok?'ok':now?'warn':''}">${ok?'ผ่าน':now?'ถัดไป':'รอ'}</span></div>`}).join('');
  const signature=R.groupOf(s)+'|'+html;
  if(timeline.dataset.rotationRoute!==signature){timeline.innerHTML=html;timeline.dataset.rotationRoute=signature}
 }
}
const result=normalize(load());if(result.state&&result.changed)save(result.state);
let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})};
const observer=new MutationObserver(schedule);
addEventListener('DOMContentLoaded',()=>{patch();const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true})});
addEventListener('storage',e=>{if(e.key===KEY)schedule()});
})();
