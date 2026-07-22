(()=>{
'use strict';
const KEY='herohealth_learning_platform_rc2';
const C=window.HH_CONFIG||{};
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return null}}
function save(s){localStorage.setItem(KEY,JSON.stringify(s))}
function requiredGamesFor(s,zoneId){const profileId=s.activeMissionProfile||C.activeMissionProfile||'CLASS_60';return C.missionProfiles?.[profileId]?.games?.[zoneId]||[]}
function routeFor(s){const seq=C.rotation?.[s.group]||[];const out=[];seq.forEach(zoneId=>requiredGamesFor(s,zoneId).forEach(gameId=>out.push({zoneId,gameId})));return out}
function sanitize(){
 const s=load();if(!s||!s.profile)return null;
 s.completed=s.completed||{};
 s.gameCompleted=s.gameCompleted||{hygiene:{},nutrition:{},fitness:{}};
 ['hygiene','nutrition','fitness'].forEach(z=>{s.gameCompleted[z]=s.gameCompleted[z]||{}});
 const route=routeFor(s);let gap=false;
 route.forEach(step=>{
   const done=s.gameCompleted?.[step.zoneId]?.[step.gameId]===true;
   if(gap&&done)delete s.gameCompleted[step.zoneId][step.gameId];
   if(!done)gap=true;
 });
 ['hygiene','nutrition','fitness'].forEach(z=>{
   const ids=requiredGamesFor(s,z);
   s.completed[z]=ids.length>0&&ids.every(id=>s.gameCompleted[z][id]===true);
 });
 if(!s.completed.pretest){
   route.forEach(step=>delete s.gameCompleted[step.zoneId][step.gameId]);
   ['hygiene','nutrition','fitness','posttest','reflection'].forEach(k=>s.completed[k]=false);
 }
 if(!(s.completed.hygiene&&s.completed.nutrition&&s.completed.fitness)){
   s.completed.posttest=false;s.completed.reflection=false;
 }
 if(!s.completed.posttest)s.completed.reflection=false;
 save(s);return s;
}
function granularProgress(s){
 const route=routeFor(s);const total=1+route.length+1+1;
 let done=s.completed?.pretest?1:0;
 route.forEach(step=>{if(s.gameCompleted?.[step.zoneId]?.[step.gameId]===true)done++});
 if(s.completed?.posttest)done++;
 if(s.completed?.reflection)done++;
 return Math.round(done/total*100);
}
function patchProgress(){
 const s=load();if(!s||!s.profile)return;
 const pct=granularProgress(s);
 document.querySelectorAll('.progress span').forEach(el=>el.style.width=pct+'%');
 document.querySelectorAll('p').forEach(el=>{if(/% ของภารกิจ/.test(el.textContent||''))el.textContent=pct+'% ของภารกิจ'});
}
sanitize();
const obs=new MutationObserver(()=>patchProgress());
obs.observe(document.documentElement,{childList:true,subtree:true});
addEventListener('DOMContentLoaded',patchProgress);
})();