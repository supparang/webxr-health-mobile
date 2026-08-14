(()=>{
'use strict';
const VERSION='20260814-ROTATION-RESEARCH-FLOW-R17-THAI-LABELS';
const ZONE_ORDER=['hygiene','nutrition','fitness'];
const ASSESSMENT_START={id:'pretest',label:'แบบทดสอบก่อนเริ่มภารกิจ',type:'assessment'};
const ASSESSMENT_END=[
 {id:'posttest',label:'แบบทดสอบหลังจบภารกิจ',type:'assessment'},
 {id:'postExperience',label:'แบบประเมินประสบการณ์หลังเล่น',type:'assessment'},
 {id:'reflection',label:'สะท้อนการเรียนรู้',type:'assessment'}
];
const LABELS={'hygiene:handwash':'ภารกิจล้างมือ 7 ขั้นตอน','hygiene:toothbrush':'ภารกิจแปรงฟันให้สะอาด','nutrition:groups':'ภารกิจจัดอาหารให้ครบ 5 หมู่','nutrition:goodjunk':'ภารกิจเลือกอาหารสุขภาพ','fitness:jumpduck':'ภารกิจกระโดดและหลบ','fitness:balance-hold':'ภารกิจฝึกการทรงตัว'};
function cfg(){return window.HH_CONFIG||{}}
function groupOf(s){return String(s?.group||s?.profile?.group||'A').trim().toUpperCase()||'A'}
function profileIdOf(s){const C=cfg();return s?.activeMissionProfile||C.activeMissionProfile||'CLASS_60'}
function zonesFor(s){const C=cfg(),g=groupOf(s),raw=C.rotation?.[g];const list=Array.isArray(raw)?raw.filter(z=>ZONE_ORDER.includes(z)):[];return list.length===3&&new Set(list).size===3?list:ZONE_ORDER.slice()}
function gameIdsFor(s,zoneId){const C=cfg();return (C.missionProfiles?.[profileIdOf(s)]?.games?.[zoneId]||[]).slice()}
function gameLabel(zoneId,gameId){return LABELS[`${zoneId}:${gameId}`]||cfg().zones?.find(z=>z.id===zoneId)?.games?.find(x=>x.id===gameId)?.thai||gameId}
function routeFor(s){const games=zonesFor(s).flatMap(zoneId=>gameIdsFor(s,zoneId).map(gameId=>({id:`${zoneId}:${gameId}`,label:gameLabel(zoneId,gameId),type:'game',zoneId,gameId})));return [ASSESSMENT_START,...games,...ASSESSMENT_END]}
function done(s,step){return step.type==='game'?s?.gameCompleted?.[step.zoneId]?.[step.gameId]===true:s?.completed?.[step.id]===true}
function status(s){const route=routeFor(s),completedCount=route.filter(x=>done(s,x)).length,nextStep=route.find(x=>!done(s,x));return{route,completedCount,totalSteps:route.length,progressPct:Math.round(completedCount/route.length*100),nextStep:nextStep?.id||'certificate',missionComplete:completedCount===route.length}}
function expectedGame(s){return routeFor(s).find(x=>x.type==='game'&&!done(s,x))||null}
function syncZoneCompletion(s){s.completed=s.completed||{};s.gameCompleted=s.gameCompleted||{};ZONE_ORDER.forEach(z=>{s.gameCompleted[z]=s.gameCompleted[z]||{};const ids=gameIdsFor(s,z);s.completed[z]=ids.length>0&&ids.every(id=>s.gameCompleted[z][id]===true)});return s}
window.HHRotation={VERSION,ZONE_ORDER,groupOf,profileIdOf,zonesFor,gameIdsFor,routeFor,done,status,expectedGame,syncZoneCompletion};
})();