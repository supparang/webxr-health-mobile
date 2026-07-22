(()=>{
'use strict';
const KEY='herohealth_learning_platform_rc2';
const ROUTE=[
 {id:'pretest',label:'Pre-test',type:'assessment'},
 {id:'hygiene:handwash',label:'Handwash AR',type:'game',zoneId:'hygiene',gameId:'handwash'},
 {id:'hygiene:toothbrush',label:'Toothbrush AR',type:'game',zoneId:'hygiene',gameId:'toothbrush'},
 {id:'nutrition:groups',label:'Groups AR',type:'game',zoneId:'nutrition',gameId:'groups'},
 {id:'nutrition:goodjunk',label:'GoodJunk AR',type:'game',zoneId:'nutrition',gameId:'goodjunk'},
 {id:'fitness:jumpduck',label:'JumpDuck AR',type:'game',zoneId:'fitness',gameId:'jumpduck'},
 {id:'fitness:balance-hold',label:'Balance Hold AR',type:'game',zoneId:'fitness',gameId:'balance-hold'},
 {id:'posttest',label:'Post-test',type:'assessment'},
 {id:'reflection',label:'Reflection',type:'assessment'}
];
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function done(s,step){return step.type==='game'?s?.gameCompleted?.[step.zoneId]?.[step.gameId]===true:s?.completed?.[step.id]===true}
function normalize(s){
 if(!s||!s.profile)return {state:s,changed:false};
 const before=JSON.stringify(s);
 s.completed=s.completed||{};s.gameCompleted=s.gameCompleted||{};
 ['hygiene','nutrition','fitness'].forEach(z=>{s.gameCompleted[z]=s.gameCompleted[z]||{}});
 let gap=!s.completed.pretest;
 ROUTE.filter(x=>x.type==='game').forEach(step=>{const ok=done(s,step);if(gap&&ok)delete s.gameCompleted[step.zoneId][step.gameId];if(!ok)gap=true});
 s.completed.hygiene=['handwash','toothbrush'].every(id=>s.gameCompleted.hygiene[id]===true);
 s.completed.nutrition=['groups','goodjunk'].every(id=>s.gameCompleted.nutrition[id]===true);
 s.completed.fitness=['jumpduck','balance-hold'].every(id=>s.gameCompleted.fitness[id]===true);
 const allGamesDone=s.completed.hygiene&&s.completed.nutrition&&s.completed.fitness;
 if(!allGamesDone){s.completed.posttest=false;s.completed.reflection=false}
 if(!s.completed.posttest)s.completed.reflection=false;
 return {state:s,changed:before!==JSON.stringify(s)};
}
function pct(s){return Math.round(ROUTE.filter(step=>done(s,step)).length/ROUTE.length*100)}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function patch(){
 const s=load();if(!s||!s.profile)return;
 const value=pct(s),width=value+'%';
 document.querySelectorAll('.progress span').forEach(el=>{if(el.style.width!==width)el.style.width=width});
 document.querySelectorAll('p').forEach(el=>{if(/% ของภารกิจ/.test(el.textContent||'')){const text=value+'% ของภารกิจ';if(el.textContent!==text)el.textContent=text}});
 const timeline=document.querySelector('.timeline');
 if(timeline){
  const current=ROUTE.findIndex(step=>!done(s,step));
  const html=ROUTE.map((step,i)=>{const ok=done(s,step),now=!ok&&i===current;return `<div class="step ${ok?'done':''}"><div class="num">${ok?'✓':i+1}</div><div><b>${esc(step.label)}</b><div class="small muted">${ok?'เสร็จแล้ว':now?'ภารกิจถัดไป':'รอดำเนินการ'}</div></div><span class="badge ${ok?'ok':now?'warn':''}">${ok?'ผ่าน':now?'ถัดไป':'รอ'}</span></div>`}).join('');
  if(timeline.dataset.routeV5!==html){timeline.innerHTML=html;timeline.dataset.routeV5=html}
 }
}
const result=normalize(load());
if(result.state&&result.changed)save(result.state);
let scheduled=false;
const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;patch()})};
const observer=new MutationObserver(schedule);
addEventListener('DOMContentLoaded',()=>{patch();const app=document.getElementById('app');if(app)observer.observe(app,{childList:true,subtree:true})});
addEventListener('storage',e=>{if(e.key===KEY)schedule()});
})();