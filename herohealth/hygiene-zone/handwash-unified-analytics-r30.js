(()=>{
'use strict';
const RELEASE='20260727-HANDWASH-UNIFIED-ANALYTICS-R30';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';
const STEPS=[
 {stepId:0,id:'wet',label:'เปียกมือ',group:'process'},
 {stepId:1,id:'soap',label:'ใช้สบู่',group:'process'},
 {stepId:2,id:'palm',label:'ฝ่ามือ',group:'who_rub'},
 {stepId:3,id:'dorsum',label:'หลังมือและซอกนิ้ว',group:'who_rub'},
 {stepId:4,id:'interlaced',label:'ฝ่ามือประสานนิ้ว',group:'who_rub'},
 {stepId:5,id:'backsFingers',label:'หลังนิ้ว',group:'who_rub'},
 {stepId:6,id:'thumbs',label:'หัวแม่มือ',group:'who_rub'},
 {stepId:7,id:'fingertips',label:'ปลายนิ้วและเล็บ',group:'who_rub'},
 {stepId:8,id:'wrists',label:'รอบข้อมือ',group:'who_rub'},
 {stepId:9,id:'rinse',label:'ล้างน้ำ',group:'process'},
 {stepId:10,id:'dry',label:'เช็ดมือ',group:'process'},
 {stepId:11,id:'towelFaucet',label:'ปิดก๊อกด้วยกระดาษ',group:'process'}
];
let coachCount=0,hintCount=0,pauseCount=0,resumeCount=0,exitCount=0,hiddenAt=0,hiddenMs=0,openedAt=Date.now();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const bool=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1'||String(v||'').toLowerCase()==='yes';
function readStored(){try{return JSON.parse(localStorage.getItem(RESULT_KEY)||'null')}catch(_){return null}}
function byStep(source){const map=new Map();(Array.isArray(source)?source:[]).forEach((row,index)=>{const rawKey=row?.whoStep??row?.who_step??row?.stepId??row?.step??row?.id??index;map.set(String(rawKey),row||{});if(row?.id!=null)map.set(String(row.id),row||{});});return map;}
function normalizeSteps(raw){
 const map=byStep(raw.steps||raw.stepResults||[]);
 return STEPS.map(def=>{
  const row=map.get(String(def.stepId))||map.get(def.id)||{};
  const quality=num(row.quality??row.accuracy??row.evidencePct);
  const durationSec=num(row.timeSec??row.durationSec??row.elapsedSec);
  const completed=row.completed!=null?bool(row.completed):String(row.passMode||'').toLowerCase()!=='not-complete'&&String(row.passMode||'')!=='';
  return {stepId:def.stepId,id:def.id,label:String(row.label||def.label),group:def.group,completed,passMode:String(row.passMode||row.mode||''),quality,durationSec,evidence:row.evidence||{},retryCount:num(row.retryCount??row.retries),errorCount:num(row.errorCount??row.errors)};
 });
}
function completeness(result){const required=['score','accuracy','durationSec','steps','events','waterUseSec','waterWasteSec','waterSaveScore','twoHandsVisibleRate','handSeenRate','trackingLostCount','trackingRecoveryCount','calibrationTimeSec','avgFps','motionSmoothness','landmarkConfidence','germRemoval','foamPeak','completedRubSteps','completedProcessSteps'];const missing=required.filter(key=>result[key]===undefined||result[key]===null||result[key]==='');return{required,missing,pct:Math.round((required.length-missing.length)/required.length*100)};}
function enrich(input){
 const raw={...(input||{})},steps=normalizeSteps(raw),rubRows=steps.filter(x=>x.group==='who_rub'),processRows=steps.filter(x=>x.group==='process');
 const completedRubSteps=rubRows.filter(x=>x.completed).length,completedProcessSteps=processRows.filter(x=>x.completed).length;
 const wristsPassed=steps.find(x=>x.id==='wrists')?.completed===true;
 const gestureAccuracy=Math.round(rubRows.reduce((sum,row)=>sum+num(row.quality),0)/Math.max(1,rubRows.length));
 const durationSec=num(raw.procedureDurationSec??raw.durationSec??((Date.now()-openedAt-hiddenMs)/1000));
 const twoHandsVisibleRate=num(raw.twoHandsVisibleRate??raw.twoHandVisibilityPct??raw.twoHandRate),handSeenRate=num(raw.handSeenRate??raw.trackingRate);
 const waterUseSec=num(raw.waterUseSec),waterWasteSec=num(raw.waterWasteSec),waterSaveScore=num(raw.waterSaveScore??Math.max(0,100-Math.max(0,waterUseSec-22)*2.5-waterWasteSec*5));
 const germRemoval=num(raw.germRemoval??(100-num(raw.finalGermLoad)));
 const assistUsed=bool(raw.assistUsed)||bool(raw.fallbackUsed)||num(raw.assistTapCount)>0||String(raw.mode||'').includes('assist')||String(raw.mode||'').includes('fallback');
 const procedureCompleted=completedRubSteps===7&&completedProcessSteps===5&&wristsPassed;
 const skillPassed=bool(raw.passed)&&procedureCompleted;
 const accuracy=num(raw.accuracy)||Math.round(gestureAccuracy*.68+((completedRubSteps+completedProcessSteps)/12*100)*.32);
 const events=Array.isArray(raw.events)?raw.events.slice(-500):Array.isArray(raw.eventLog)?raw.eventLog.slice(-500):[];
 const result={...raw,analyticsSchemaVersion:'HH-UNIFIED-GAME-ANALYTICS-V2',analyticsRelease:RELEASE,gameId:'handwash',zone:'hygiene',gameVersion:String(raw.version||raw.gameVersion||RELEASE),eventId:raw.eventId||raw.attemptId||`HH-handwash-${Date.now()}`,finishedAt:raw.finishedAt||raw.timestamp||raw.endedAt||new Date().toISOString(),durationSec,score:num(raw.score),scoreAvailable:raw.score!=null,accuracy,masteryPct:accuracy,passed:skillPassed,completed:procedureCompleted,skillCriteriaMet:skillPassed,procedureCompleted,completionPolicy:'complete-7-rub-12-phase-single-round',singleAttemptPolicy:true,totalSteps:12,completedSteps:completedRubSteps+completedProcessSteps,totalWhoRubSteps:7,whoStepsTotal:7,whoStepsCompleted:completedRubSteps,completedRubSteps,totalProcessSteps:5,completedProcessSteps,wristsPassed,processCompliancePct:Math.round((completedRubSteps+completedProcessSteps)/12*100),gestureAccuracy,twoHandsVisibleRate,twoHandVisibilityPct:twoHandsVisibleRate,handSeenRate,trackingLostCount:num(raw.trackingLostCount),trackingRecoveryCount:num(raw.trackingRecoveryCount),calibrationTimeSec:num(raw.calibrationTimeSec),avgFps:num(raw.avgFps??raw.fpsAverage),motionSmoothness:num(raw.motionSmoothness??gestureAccuracy),landmarkConfidence:num(raw.landmarkConfidence),waterUseSec,waterWasteSec,waterSaveScore,soapDurationSec:num(raw.soapDurationSec),foamPeak:num(raw.foamPeak),finalGermLoad:num(raw.finalGermLoad),germRemoval,strictPassCount:num(raw.strictPassCount),gracePassCount:num(raw.gracePassCount),assistUsed,assistTapCount:num(raw.assistTapCount),inputMode:String(raw.inputMode||raw.mode||(assistUsed?'camera-ar-with-assist':'camera-ar')),retryCount:num(raw.retryCount),wrongStepCount:num(raw.wrongStepCount)||num(raw.processErrors?.length),hintUsed:hintCount>0,hintCount,coachCount,coachType:assistUsed?'adaptive_assist':'standard',pauseCount,resumeCount,exitCount,steps,stepResults:steps,events,processErrors:Array.isArray(raw.processErrors)?raw.processErrors:[],research:{hygieneMasteryPct:accuracy,proceduralCompliancePct:Math.round((completedRubSteps+completedProcessSteps)/12*100),waterConservationPct:Math.round(waterSaveScore),trackingQualityPct:Math.round((twoHandsVisibleRate+handSeenRate)/2),assistDependency:assistUsed?1:0,sevenRubCompletion:completedRubSteps===7?1:0,wristsCompletion:wristsPassed?1:0,skillPass:skillPassed?1:0,procedureCompletion:procedureCompleted?1:0}};
 const audit=completeness(result);result.metricCompletenessPct=audit.pct;result.progressionEligible=procedureCompleted&&audit.pct>=90;result.analyticsAudit={release:RELEASE,procedureCompleted,skillPassed,progressionEligible:result.progressionEligible,requiredRubSteps:7,completedRubSteps,requiredProcessSteps:5,completedProcessSteps,wristsPassed,missingMetrics:audit.missing,metricCompletenessPct:audit.pct};return result;
}
function save(result){try{localStorage.setItem(RESULT_KEY,JSON.stringify(result))}catch(_){}try{window.__HANDWASH_LAST_RESULT__=result}catch(_){}try{window.parent?.postMessage({type:'HEROHEALTH_HANDWASH_ANALYTICS',payload:result},location.origin)}catch(_){}}
document.addEventListener('click',event=>{const id=String(event.target?.id||''),text=String(event.target?.textContent||'');if(id==='coachBtn'||/คำแนะนำ|coach/i.test(text)){coachCount++;hintCount++;}if(/ออก|กลับ|home|back/i.test(text)&&!document.getElementById('summaryOverlay')?.classList.contains('show'))exitCount++;},{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();pauseCount++;}else if(hiddenAt){hiddenMs+=Date.now()-hiddenAt;hiddenAt=0;resumeCount++;}});
window.addEventListener('herohealth:game-result',event=>{const result=enrich(event.detail||readStored()||{});if(event.detail&&typeof event.detail==='object')Object.assign(event.detail,result);save(result);console.info('[Handwash Analytics R30] unified result saved',result.analyticsAudit);},{capture:true});
window.addEventListener('beforeunload',()=>{exitCount++;});window.HH_HANDWASH_ANALYTICS={version:RELEASE,enrich,read:readStored};document.documentElement.dataset.handwashUnifiedAnalytics=RELEASE;console.info('[Handwash Analytics R30] installed');
})();