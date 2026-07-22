(()=>{
'use strict';
const KEY='herohealth_learning_platform_rc2';
const C=window.HH_CONFIG||{};
const ROUTE=[
 {zoneId:'hygiene',gameId:'handwash'},
 {zoneId:'hygiene',gameId:'toothbrush'},
 {zoneId:'nutrition',gameId:'groups'},
 {zoneId:'nutrition',gameId:'goodjunk'},
 {zoneId:'fitness',gameId:'jumpduck'},
 {zoneId:'fitness',gameId:'balance-hold'}
];
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function normalize(s){
 if(!s||!s.profile)return {state:s,changed:false};
 const before=JSON.stringify(s);
 s.completed=s.completed||{};
 s.gameCompleted=s.gameCompleted||{};
 ['hygiene','nutrition','fitness'].forEach(z=>{s.gameCompleted[z]=s.gameCompleted[z]||{}});
 let gap=!s.completed.pretest;
 ROUTE.forEach(step=>{
   const done=s.gameCompleted[step.zoneId][step.gameId]===true;
   if(gap&&done)delete s.gameCompleted[step.zoneId][step.gameId];
   if(!done)gap=true;
 });
 s.completed.hygiene=['handwash','toothbrush'].every(id=>s.gameCompleted.hygiene[id]===true);
 s.completed.nutrition=['groups','goodjunk'].every(id=>s.gameCompleted.nutrition[id]===true);
 s.completed.fitness=['jumpduck','balance-hold'].every(id=>s.gameCompleted.fitness[id]===true);
 const allGamesDone=s.completed.hygiene&&s.completed.nutrition&&s.completed.fitness;
 if(!allGamesDone){s.completed.posttest=false;s.completed.reflection=false;}
 if(!s.completed.posttest)s.completed.reflection=false;
 const changed=before!==JSON.stringify(s);
 return {state:s,changed};
}
function pct(s){
 let done=s?.completed?.pretest?1:0;
 ROUTE.forEach(x=>{if(s?.gameCompleted?.[x.zoneId]?.[x.gameId]===true)done++});
 if(s?.completed?.posttest)done++;
 if(s?.completed?.reflection)done++;
 return Math.round(done/9*100);
}
function patch(){
 const s=load();if(!s||!s.profile)return;
 const value=pct(s), width=value+'%';
 document.querySelectorAll('.progress span').forEach(el=>{if(el.style.width!==width)el.style.width=width});
 document.querySelectorAll('p').forEach(el=>{if(/% ของภารกิจ/.test(el.textContent||''))el.textContent=value+'% ของภารกิจ'});
}
const result=normalize(load());
if(result.state&&result.changed){
 save(result.state);
 const flag='hh_mission_repair_v4';
 if(sessionStorage.getItem(flag)!=='1'){
   sessionStorage.setItem(flag,'1');
   location.reload();
   return;
 }
}
let scheduled=false;
const observer=new MutationObserver(()=>{
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;patch()});
});
addEventListener('DOMContentLoaded',()=>{
 patch();
 const app=document.getElementById('app');
 if(app)observer.observe(app,{childList:true,subtree:true});
});
})();