(()=>{
'use strict';
const RELEASE='20260727-HANDWASH-UNIFIED-ANALYTICS-R27';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';
const PROCESS_STEPS=[
 {id:0,label:'เปียกมือ',group:'process'},
 {id:1,label:'ใช้สบู่',group:'process'},
 {id:2,label:'ฝ่ามือ',group:'who_rub'},
 {id:3,label:'หลังมือและซอกนิ้ว',group:'who_rub'},
 {id:4,label:'ฝ่ามือประสานนิ้ว',group:'who_rub'},
 {id:5,label:'หลังนิ้ว',group:'who_rub'},
 {id:6,label:'หัวแม่มือ',group:'who_rub'},
 {id:7,label:'ปลายนิ้วและเล็บ',group:'who_rub'},
 {id:8,label:'ล้างน้ำ',group:'process'},
 {id:9,label:'เช็ดมือ',group:'process'},
 {id:10,label:'ปิดก๊อกด้วยกระดาษ',group:'process'}
];
let coachCount=0, hintCount=0, pauseCount=0, resumeCount=0, exitCount=0;
let startedAt=Date.now(), hiddenAt=0, hiddenMs=0;

function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function bool(v){return v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1'||String(v||'').toLowerCase()==='yes'}
function safeJson(value){try{return JSON.stringify(value)}catch(_){return '{}'}}
function readStored(){try{return JSON.parse(localStorage.getItem(RESULT_KEY)||'null')}catch(_){return null}}
function save(result){
 try{localStorage.setItem(RESULT_KEY,JSON.stringify(result))}catch(_){}
 try{window.__HANDWASH_LAST_RESULT__=result}catch(_){}
 try{window.parent?.postMessage({type:'HEROHEALTH_HANDWASH_ANALYTICS',payload:result},location.origin)}catch(_){}
}
function normalizeSteps(raw){
 const source=Array.isArray(raw.steps)?raw.steps:[];
 const byId=new Map(source.map((row,index)=>[Number(row.whoStep??row.who_step??row.step??row.id??index),row]));
 return PROCESS_STEPS.map(def=>{
  const row=byId.get(def.id)||{};
  const quality=num(row.quality??row.accuracy??row.evidencePct);
  const durationSec=num(row.timeSec??row.durationSec??row.elapsedSec);
  const completed=row.completed!=null?bool(row.completed):(quality>0||String(row.passMode||'').toLowerCase().includes('pass'));
  return {stepId:def.id,label:String(row.label||def.label),group:def.group,completed,passMode:String(row.passMode||row.mode||''),quality,durationSec,evidence:row.evidence||{},retryCount:num(row.retryCount??row.retries),errorCount:num(row.errorCount??row.errors)};
 });
}
function enrich(input){
 const raw={...(input||{})};
 const steps=normalizeSteps(raw);
 const rubSteps=steps.filter(x=>x.group==='who_rub');
 const completedRubSteps=rubSteps.filter(x=>x.completed).length;
 const completedProcessSteps=steps.filter(x=>x.completed).length;
 const stepAccuracy=rubSteps.length?Math.round(rubSteps.reduce((s,x)=>s+x.quality,0)/rubSteps.length):num(raw.gestureAccuracy??raw.accuracy);
 const durationSec=num(raw.procedureDurationSec??raw.durationSec??((Date.now()-startedAt-hiddenMs)/1000));
 const twoHandsVisibleRate=num(raw.twoHandsVisibleRate??raw.twoHandVisibilityPct??raw.twoHandRate);
 const handSeenRate=num(raw.handSeenRate??raw.trackingRate??(twoHandsVisibleRate?Math.min(100,twoHandsVisibleRate+10):0));
 const trackingLostCount=num(raw.trackingLostCount??raw.lostTrackingCount);
 const waterUseSec=num(raw.waterUseSec);
 const waterWasteSec=num(raw.waterWasteSec);
 const waterSaveScore=num(raw.waterSaveScore??Math.max(0,100-Math.max(0,waterUseSec-15)*3.2-waterWasteSec*6));
 const germRemoval=num(raw.germRemoval??(100-num(raw.finalGermLoad)));
 const assistUsed=bool(raw.assistUsed)||bool(raw.fallbackUsed)||String(raw.mode||'').includes('assist')||String(raw.mode||'').includes('fallback');
 const passed=raw.passed!=null?bool(raw.passed):(completedRubSteps===6&&germRemoval>=80);
 const accuracy=num(raw.accuracy)||Math.round(stepAccuracy*.68+Math.min(100,completedProcessSteps/11*100)*.32);
 const events=Array.isArray(raw.events)?raw.events.slice(-500):[];
 const processErrors=Array.isArray(raw.processErrors)?raw.processErrors:[];
 return {
  ...raw,
  analyticsSchemaVersion:'HH-UNIFIED-GAME-ANALYTICS-V1',
  analyticsRelease:RELEASE,
  gameId:'handwash',zone:'hygiene',gameVersion:String(raw.version||RELEASE),
  completed:true,passed,finishedAt:raw.timestamp||raw.endedAt||new Date().toISOString(),
  durationSec,accuracy,score:num(raw.score),scoreAvailable:raw.score!=null,
  assistUsed,inputMode:String(raw.inputMode||raw.mode||(assistUsed?'camera-ar-with-assist':'camera-ar')),
  totalProcessSteps:11,completedProcessSteps,totalWhoRubSteps:6,completedRubSteps,
  whoStepsTotal:6,whoStepsCompleted:completedRubSteps,processCompliancePct:Math.round(completedProcessSteps/11*100),
  gestureAccuracy:stepAccuracy,twoHandsVisibleRate,twoHandVisibilityPct:twoHandsVisibleRate,handSeenRate,
  trackingLostCount,trackingRecoveryCount:num(raw.trackingRecoveryCount),calibrationTimeSec:num(raw.calibrationTimeSec),
  avgFps:num(raw.avgFps??raw.fpsAverage),motionSmoothness:num(raw.motionSmoothness),landmarkConfidence:num(raw.landmarkConfidence),
  waterUseSec,waterWasteSec,waterSaveScore,soapDurationSec:num(raw.soapDurationSec),foamPeak:num(raw.foamPeak),
  finalGermLoad:num(raw.finalGermLoad),germRemoval,strictPassCount:num(raw.strictPassCount),gracePassCount:num(raw.gracePassCount),
  retryCount:num(raw.retryCount),wrongStepCount:num(raw.wrongStepCount)||processErrors.length,hintUsed:hintCount>0,hintCount,
  coachCount,coachType:assistUsed?'adaptive_assist':'standard',pauseCount,resumeCount,exitCount,
  skillCriteriaMet:passed,masteryPct:accuracy,completionPolicy:'complete-11-process-steps-single-round',
  steps,stepResults:steps,events,processErrors,
  research:{hygieneMasteryPct:accuracy,proceduralCompliancePct:Math.round(completedProcessSteps/11*100),waterConservationPct:Math.round(waterSaveScore),trackingQualityPct:Math.round((twoHandsVisibleRate+handSeenRate)/2),assistDependency:assistUsed?1:0}
 };
}

document.addEventListener('click',event=>{
 const id=String(event.target?.id||'');
 const text=String(event.target?.textContent||'');
 if(id==='coachBtn'||/คำแนะนำ|coach/i.test(text)){coachCount++;hintCount++;}
 if(/ออก|กลับ|home|back/i.test(text)&&!document.getElementById('summaryOverlay')?.classList.contains('show'))exitCount++;
},{capture:true});

document.addEventListener('visibilitychange',()=>{
 if(document.hidden){hiddenAt=Date.now();pauseCount++;}
 else if(hiddenAt){hiddenMs+=Date.now()-hiddenAt;hiddenAt=0;resumeCount++;}
});

window.addEventListener('herohealth:game-result',event=>{
 const result=enrich(event.detail||readStored()||{});
 save(result);
 console.info('[Handwash Analytics R27] unified result saved',result);
},{capture:true});

window.addEventListener('beforeunload',()=>{exitCount++;});
window.HH_HANDWASH_ANALYTICS={version:RELEASE,enrich,read:readStored};
document.documentElement.dataset.handwashUnifiedAnalytics=RELEASE;
console.info('[Handwash Analytics R27] installed');
})();