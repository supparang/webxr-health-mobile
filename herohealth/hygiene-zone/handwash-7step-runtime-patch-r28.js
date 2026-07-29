(()=>{
'use strict';
const RELEASE='20260729-HANDWASH-STABLE-BOOT-R41';
const NativeBlob=window.Blob;

function patchRuntime(source){
 if(!source.includes('20260716-HANDWASH-WHO-V4-R1'))return source;
 let out=source;
 const replace=(before,after,label)=>{
  if(!out.includes(before)){console.warn('[Handwash R41] hook missing:',label);return;}
  out=out.replace(before,after);
 };

 replace("const VERSION = '20260716-HANDWASH-WHO-V4-R1';","const VERSION = '20260729-HANDWASH-STABLE-BOOT-R41';",'version');

 replace(
`{ id:'fingertips', who:'7', icon:'💅', label:'ปลายนิ้วและเล็บ', tip:'หมุนถูปลายนิ้วบนฝ่ามืออีกข้างไป–กลับ แล้วสลับ', kind:'rub', targetSec:3.0, strict:.60, grace:.47, side:true },
{ id:'rinse', who:'8', icon:'🚿', label:'ล้างน้ำ', tip:'ล้างสบู่ออกจากมือทั้งสองข้างให้หมด', kind:'process', targetSec:4.0 },
{ id:'dry', who:'9', icon:'🧻', label:'เช็ดให้แห้ง', tip:'เช็ดมือให้แห้งทั่วด้วยกระดาษหรือผ้าใช้ครั้งเดียว', kind:'process', targetSec:4.0 },
{ id:'towelFaucet', who:'10', icon:'🚰', label:'ใช้กระดาษปิดก๊อก', tip:'ถือกระดาษที่ใช้เช็ดมือ แล้วใช้กระดาษนั้นปิดก๊อก', kind:'process', targetSec:1.8 }`,
`{ id:'fingertips', who:'7', icon:'💅', label:'ปลายนิ้วและเล็บ', tip:'หมุนถูปลายนิ้วบนฝ่ามืออีกข้างไป–กลับ แล้วสลับ', kind:'rub', targetSec:3.0, strict:.60, grace:.47, side:true },
{ id:'wrists', who:'8', icon:'⌚', label:'รอบข้อมือ', tip:'กำรอบข้อมือแล้วหมุนถูให้ทั่ว จากนั้นสลับอีกข้าง', kind:'rub', targetSec:3.0, strict:.58, grace:.45, side:true },
{ id:'rinse', who:'9', icon:'🚿', label:'ล้างน้ำ', tip:'ล้างสบู่ออกจากมือทั้งสองข้างให้หมด', kind:'process', targetSec:4.0 },
{ id:'dry', who:'10', icon:'🧻', label:'เช็ดให้แห้ง', tip:'เช็ดมือให้แห้งทั่วด้วยกระดาษหรือผ้าใช้ครั้งเดียว', kind:'process', targetSec:4.0 },
{ id:'towelFaucet', who:'11', icon:'🚰', label:'ใช้กระดาษปิดก๊อก', tip:'ถือกระดาษที่ใช้เช็ดมือ แล้วใช้กระดาษนั้นปิดก๊อก', kind:'process', targetSec:1.8 }`,
 'phase-list');

 const fingerBoundary=`score=weighted([contact,.46,pose,.14,trajectory,.40]);
}
const finalStep=phase.id==='fingertips';`;
 const wristBoundary=`score=weighted([contact,.46,pose,.14,trajectory,.40]);
} else if (phase.id==='wrists') {
const dAB=dist(a.palm,b.wrist)/pair.scale,dBA=dist(b.palm,a.wrist)/pair.scale;
slot=dAB<dBA?b.key:a.key;const near=Math.min(dAB,dBA);
contact=clamp((1.06-near)/.82,0,1);
pose=Math.max(.30,avgNumber([a.openScore,b.openScore]));
trajectory=Math.max(pair.circularity*.78,motion*.88,pair.oscillation*.58);
score=weighted([contact,.42,pose,.18,trajectory,.40]);
}
const finalStep=phase.id==='fingertips'||phase.id==='wrists';`;
 replace(fingerBoundary,wristBoundary,'wrist-detector');

 out=out.replaceAll("phase.id==='fingertips'&&elapsed>4","(phase.id==='fingertips'||phase.id==='wrists')&&elapsed>4");
 out=out.replaceAll("phase.id==='fingertips'&&elapsed>5","(phase.id==='fingertips'||phase.id==='wrists')&&elapsed>5");
 out=out.replace("const finalBoost=phase.id==='fingertips'?1.65:phase.id==='thumbs'?1.28:1;","const finalBoost=phase.id==='fingertips'?1.65:phase.id==='wrists'?1.38:phase.id==='thumbs'?1.28:1;");
 out=out.replace("fingertips:'1) จีบปลายนิ้ว  2) แตะกลางฝ่ามือ  3) หมุนวงเล็ก ๆ แล้วสลับข้าง'","fingertips:'1) จีบปลายนิ้ว  2) แตะกลางฝ่ามือ  3) หมุนวงเล็ก ๆ แล้วสลับข้าง',wrists:'1) กำรอบข้อมือ  2) หมุนถูเป็นวง  3) สลับอีกข้าง'");
 out=out.replaceAll("id==='thumbs'||id==='fingertips'","id==='thumbs'||id==='fingertips'||id==='wrists'");
 out=out.replaceAll("phase.id==='thumbs'||phase.id==='fingertips'","phase.id==='thumbs'||phase.id==='fingertips'||phase.id==='wrists'");

 out=out.replaceAll("trackingFrames:0, twoHandFrames:0, trackingLostCount:0, previousHadHands:false,","trackingFrames:0, handsSeenFrames:0, twoHandFrames:0, trackingLostCount:0, trackingRecoveryCount:0, previousHadHands:false, hadTracking:false, frameDtSum:0, frameCount:0, handednessConfidenceSum:0, handednessConfidenceCount:0, calibrationStartedAt:0, calibrationTimeSec:0, assistTapCount:0,");

 replace(
`state.trackingFrames += 1;
if (hands.length >= 2) state.twoHandFrames += 1;
if (!hands.length && state.previousHadHands) state.trackingLostCount += 1;
state.previousHadHands = hands.length > 0;`,
`state.trackingFrames += 1;
state.frameDtSum += dt;state.frameCount += 1;
if (hands.length > 0) state.handsSeenFrames += 1;
if (hands.length >= 2) state.twoHandFrames += 1;
if (!hands.length && state.previousHadHands) state.trackingLostCount += 1;
if (hands.length > 0 && !state.previousHadHands && state.hadTracking) state.trackingRecoveryCount += 1;
if (hands.length > 0) state.hadTracking = true;
const confidenceValues=handedness.map(x=>Number(x?.score||0)).filter(Number.isFinite);
state.handednessConfidenceSum += confidenceValues.reduce((a,b)=>a+b,0);
state.handednessConfidenceCount += confidenceValues.length;
state.previousHadHands = hands.length > 0;`,
 'tracking-telemetry');

 replace("state.startedAt = new Date().toISOString();","state.startedAt = new Date().toISOString();state.calibrationStartedAt=performance.now();",'calibration-start');
 replace("state.phase=id;document.documentElement.dataset.handwashPhase=id;","const previousPhase=state.phase;state.phase=id;document.documentElement.dataset.handwashPhase=id;if(previousPhase==='calibrate'&&id==='wet'&&state.calibrationStartedAt){state.calibrationTimeSec=Math.max(0,(performance.now()-state.calibrationStartedAt)/1000);}",'calibration-end');
 replace("state.fallbackUsed=true;","state.fallbackUsed=true;state.assistTapCount+=1;",'assist-counter');

 out=out.replace("showToast('WHO 1 ผ่านแล้ว • เริ่ม 6 ท่าถูมือ');","showToast('WHO 1 ผ่านแล้ว • เริ่ม 7 ท่าถูมือ รวมรอบข้อมือ');");
 out=out.replace("(rubCompleted/6)*60","(rubCompleted/7)*60");
 out=out.replace("rubCompleted===6&&processCompleted===5","rubCompleted===7&&processCompleted===5");
 out=out.replace("completedRubSteps:rubCompleted,totalRubSteps:6,","completedRubSteps:rubCompleted,totalRubSteps:7,");
 out=out.replace("WHO ${result.completedRubSteps}/6 ท่าถู","WHO ${result.completedRubSteps}/7 ท่าถู");
 out=out.replace("el.stepText.textContent=`${done}/11`;","el.stepText.textContent=`${done}/12`;");
 out=out.replace("el.rubText.textContent=`${rubDoneCount}/6`;","el.rubText.textContent=`${rubDoneCount}/7`;");

 replace(
`fallbackUsed:state.fallbackUsed,processErrors:state.processErrors,steps:rows,events:state.eventLog.slice(-100),
sourceUrl:location.href,userAgent:navigator.userAgent,timestamp:new Date().toISOString()`,
`fallbackUsed:state.fallbackUsed,assistUsed:state.fallbackUsed,assistTapCount:state.assistTapCount,
handSeenRate:state.trackingFrames?round(state.handsSeenFrames/state.trackingFrames*100,1):0,
trackingRecoveryCount:state.trackingRecoveryCount,calibrationTimeSec:round(state.calibrationTimeSec,2),
avgFps:state.frameDtSum?round(state.frameCount/state.frameDtSum,2):0,motionSmoothness:gestureAccuracy,
landmarkConfidence:state.handednessConfidenceCount?round(state.handednessConfidenceSum/state.handednessConfidenceCount*100,1):0,
wrongStepCount:state.processErrors.length,retryCount:state.trackingLostCount+state.assistTapCount,
soapDurationSec:round(state.stepTime.soap||0,2),completedSteps:rubCompleted+processCompleted,totalSteps:12,
whoStepsCompleted:rubCompleted,whoStepsTotal:7,totalWhoRubSteps:7,completedProcessSteps:processCompleted,totalProcessSteps:5,
processCompliancePct:Math.round((rubCompleted+processCompleted)/12*100),skillCriteriaMet:passed,completed:techniquePassed,
completionPolicy:'stable-7-rub-12-phase',analyticsSchemaVersion:'HH-UNIFIED-GAME-ANALYTICS-V2',
processErrors:state.processErrors,steps:rows,stepResults:rows,events:state.eventLog.slice(-100),
sourceUrl:location.href,userAgent:navigator.userAgent,timestamp:new Date().toISOString()`,
 'result-telemetry');

 replace("saveResult(result);\nrenderSummary(result);\nsendResult(result);","saveResult(result);\nrenderSummary(result);\nif(qs.get('classroom')!=='1')sendResult(result);",'single-authority-delivery');

 out=out.replace("const RELEASE='20260717-HANDWASH-FINAL-R7';","const RELEASE='20260729-HANDWASH-STABLE-BOOT-R41';");
 out=out.replace("})();","document.documentElement.dataset.handwashStrictRuntime='20260729-HANDWASH-STABLE-BOOT-R41';\n})();");
 console.info('[Handwash R41] stable runtime interceptor installed');
 return out;
}

function PatchedBlob(parts,options){
 try{
  if(options&&String(options.type||'').includes('javascript')&&Array.isArray(parts)&&parts.length===1&&typeof parts[0]==='string'){
   const patched=patchRuntime(parts[0]);
   try{new Function(patched)}catch(error){console.error('[Handwash R41] runtime syntax validation failed',error);return new NativeBlob(parts,options);}
   return new NativeBlob([patched],options);
  }
 }catch(error){console.error('[Handwash R41] runtime patch failed',error);}
 return new NativeBlob(parts,options);
}
PatchedBlob.prototype=NativeBlob.prototype;
Object.setPrototypeOf(PatchedBlob,NativeBlob);
window.Blob=PatchedBlob;
document.documentElement.dataset.handwashStrictPatch=RELEASE;
console.info('[Handwash R41] stable interceptor installed');
})();