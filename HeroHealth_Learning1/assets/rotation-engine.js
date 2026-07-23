(()=>{
'use strict';
const ZONE_ORDER=['hygiene','nutrition','fitness'];
const ASSESSMENT_START={id:'pretest',label:'Pre-test',type:'assessment'};
const ASSESSMENT_END=[{id:'posttest',label:'Post-test',type:'assessment'},{id:'reflection',label:'Reflection',type:'assessment'}];
const LABELS={
 'hygiene:handwash':'Handwash AR','hygiene:toothbrush':'Toothbrush AR',
 'nutrition:groups':'Groups AR','nutrition:goodjunk':'GoodJunk AR',
 'fitness:jumpduck':'JumpDuck AR','fitness:balance-hold':'Balance Hold AR'
};
function cfg(){return window.HH_CONFIG||{}}
function groupOf(s){return String(s?.group||s?.profile?.group||'A').trim().toUpperCase()||'A'}
function profileIdOf(s){const C=cfg();return s?.activeMissionProfile||C.activeMissionProfile||'CLASS_60'}
function zonesFor(s){const C=cfg(),g=groupOf(s),raw=C.rotation?.[g];const list=Array.isArray(raw)?raw.filter(z=>ZONE_ORDER.includes(z)):[];return list.length===3&&new Set(list).size===3?list:ZONE_ORDER.slice()}
function gameIdsFor(s,zoneId){const C=cfg();return (C.missionProfiles?.[profileIdOf(s)]?.games?.[zoneId]||[]).slice()}
function gameLabel(zoneId,gameId){const C=cfg(),g=C.zones?.find(z=>z.id===zoneId)?.games?.find(x=>x.id===gameId);return g?.thai||g?.title||LABELS[`${zoneId}:${gameId}`]||gameId}
function routeFor(s){const games=zonesFor(s).flatMap(zoneId=>gameIdsFor(s,zoneId).map(gameId=>({id:`${zoneId}:${gameId}`,label:gameLabel(zoneId,gameId),type:'game',zoneId,gameId})));return [ASSESSMENT_START,...games,...ASSESSMENT_END]}
function done(s,step){return step.type==='game'?s?.gameCompleted?.[step.zoneId]?.[step.gameId]===true:s?.completed?.[step.id]===true}
function status(s){const route=routeFor(s),completedCount=route.filter(x=>done(s,x)).length,nextStep=route.find(x=>!done(s,x));return{route,completedCount,totalSteps:route.length,progressPct:Math.round(completedCount/route.length*100),nextStep:nextStep?.id||'certificate',missionComplete:completedCount===route.length}}
function expectedGame(s){return routeFor(s).find(x=>x.type==='game'&&!done(s,x))||null}
function syncZoneCompletion(s){s.completed=s.completed||{};s.gameCompleted=s.gameCompleted||{};ZONE_ORDER.forEach(z=>{s.gameCompleted[z]=s.gameCompleted[z]||{};const ids=gameIdsFor(s,z);s.completed[z]=ids.length>0&&ids.every(id=>s.gameCompleted[z][id]===true)});return s}
window.HHRotation={ZONE_ORDER,groupOf,profileIdOf,zonesFor,gameIdsFor,routeFor,done,status,expectedGame,syncZoneCompletion};
})();
