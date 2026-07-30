(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;

const RELEASE='20260730-BALANCE-CLASSROOM-CLOSE-RANGE-LEAN-V41';
const s=BH.state;
const e=BH.el;
const C=BH.clamp||((value,min,max)=>Math.max(min,Math.min(max,value)));
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const vis=point=>Number(point?.v||0);
const midpoint=(a,b)=>({x:(Number(a?.x)||0+Number(b?.x)||0)/2,y:(Number(a?.y)||0+Number(b?.y)||0)/2});
const mid=(a,b)=>({x:(Number(a?.x||0)+Number(b?.x||0))/2,y:(Number(a?.y||0)+Number(b?.y||0))/2});
const dist=(a,b)=>Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));
const avg=(landmarks,indices)=>indices.reduce((sum,index)=>sum+vis(landmarks?.[index]),0)/Math.max(1,indices.length);

function inferredAnkle(landmarks,kneeIndex,ankleIndex,xOffset){
  const knee=landmarks[kneeIndex];
  const ankle=landmarks[ankleIndex];
  if(ankle&&vis(ankle)>=.20)return{...ankle};
  const hip=landmarks[kneeIndex===25?23:24];
  const lower=C(dist(hip,knee)*.96,.10,.25);
  return{
    x:C(Number(knee?.x||.5)+xOffset,.015,.985),
    y:C(Number(knee?.y||.72)+lower,.05,.992),
    z:Number(knee?.z||0),
    v:C(vis(knee)*.90,.42,.76),
    classroomEstimated:true
  };
}

function armEvidence(landmarks,side,shoulderWidth){
  const left=side==='left';
  const shoulder=landmarks[left?11:12];
  const elbow=landmarks[left?13:14];
  const wrist=landmarks[left?15:16];
  const direction=left?-1:1;
  const wristReach=vis(wrist)>=.14?direction*(Number(wrist.x)-Number(shoulder.x))/shoulderWidth:0;
  const elbowReach=vis(elbow)>=.20?direction*(Number(elbow.x)-Number(shoulder.x))/shoulderWidth*1.62:0;
  const reach=Math.max(wristReach,elbowReach);
  const wristLevel=vis(wrist)>=.14?Math.abs(Number(wrist.y)-Number(shoulder.y)):1;
  const elbowLevel=vis(elbow)>=.20?Math.abs(Number(elbow.y)-Number(shoulder.y))*1.45:1;
  return{reach,level:Math.min(wristLevel,elbowLevel),visible:vis(wrist)>=.14||vis(elbow)>=.20};
}

function calibrationMetrics(landmarks){
  if(!Array.isArray(landmarks))return null;
  const shoulders=mid(landmarks[11],landmarks[12]);
  const hips=mid(landmarks[23],landmarks[24]);
  const knees=mid(landmarks[25],landmarks[26]);
  const shoulderWidth=Math.max(.04,dist(landmarks[11],landmarks[12]));
  const headConfidence=vis(landmarks[0]);
  const shoulderConfidence=avg(landmarks,[11,12]);
  const hipConfidence=avg(landmarks,[23,24]);
  const kneeLeft=vis(landmarks[25]);
  const kneeRight=vis(landmarks[26]);
  const bodyConfidence=avg(landmarks,[0,11,12,23,24,25,26]);
  const leftArm=armEvidence(landmarks,'left',shoulderWidth);
  const rightArm=armEvidence(landmarks,'right',shoulderWidth);
  const points=[0,11,12,13,14,15,16,23,24,25,26]
    .map(index=>landmarks[index])
    .filter(Boolean);
  const bounds={
    left:Math.min(...points.map(point=>Number(point.x))),
    right:Math.max(...points.map(point=>Number(point.x))),
    top:Number(landmarks[0]?.y||0),
    bottom:Math.max(Number(landmarks[25]?.y||0),Number(landmarks[26]?.y||0))
  };
  const mainBodyVisible=headConfidence>=.24&&shoulderConfidence>=.28&&hipConfidence>=.22;
  const kneesVisible=kneeLeft>=.14&&kneeRight>=.14;
  const bodySpan=Number(knees.y)-Number(landmarks[0]?.y||0);
  const inFrame=bounds.left>-.07&&bounds.right<1.07&&bounds.top>-.08&&bounds.bottom<1.10;
  const bodyOk=mainBodyVisible&&kneesVisible&&bodyConfidence>=.23&&shoulderWidth>=.052&&bodySpan>=.30&&inFrame;
  const armsOk=leftArm.visible&&rightArm.visible&&leftArm.reach>=.48&&rightArm.reach>=.48&&leftArm.level<=.34&&rightArm.level<=.34;

  s.calHistory.push({x:hips.x,y:hips.y,t:BH.now()});
  if(s.calHistory.length>18)s.calHistory.shift();
  let jitter=1;
  if(s.calHistory.length>=6){
    const mean=s.calHistory.reduce((total,point)=>({x:total.x+point.x,y:total.y+point.y}),{x:0,y:0});
    mean.x/=s.calHistory.length;
    mean.y/=s.calHistory.length;
    jitter=Math.sqrt(s.calHistory.reduce((total,point)=>total+(point.x-mean.x)**2+(point.y-mean.y)**2,0)/s.calHistory.length);
  }

  return{
    bodyOk,
    armsOk,
    stable:jitter<.018,
    center:hips,
    shoulderCenter:shoulders,
    kneeCenter:knees,
    shoulderWidth,
    bodyConfidence,
    jitter,
    bounds,
    leftArm,
    rightArm,
    kneeLeft,
    kneeRight
  };
}

BH.calibrationQuality=calibrationMetrics;
BH.updateCalibration=landmarks=>{
  const metrics=calibrationMetrics(landmarks);
  if(!metrics)return;
  const now=BH.now();
  const delta=Math.min(110,Math.max(0,now-(s.calLast||now)));
  s.calLast=now;

  e.calBody.className='calStep '+(metrics.bodyOk?'ok':'warn');
  e.calBody.textContent=metrics.bodyOk?'✅ 1. เห็นศีรษะ–เข่า':'⚠️ 1. จัดศีรษะ–เข่าให้อยู่ในจอ';
  e.calArms.className='calStep '+(metrics.armsOk?'ok':'warn');
  e.calArms.textContent=metrics.armsOk?'✅ 2. กางแขนแล้ว':'⚠️ 2. กางแขนพอสบาย';
  e.calStable.className='calStep '+(metrics.stable?'ok':'warn');

  if(metrics.bodyOk&&metrics.armsOk&&metrics.stable&&metrics.bodyConfidence>=.23){
    s.calValidMs+=delta;
  }else{
    s.calValidMs=Math.max(0,s.calValidMs-delta*.38);
  }

  const requiredMs=850;
  const percent=C(s.calValidMs/requiredMs*100,0,100);
  e.calibrationBar.style.width=percent+'%';
  e.calStable.textContent=percent>=100?'✅ 3. พร้อมเล่น':metrics.stable?`3. ค้างนิ่ง ${Math.round(percent)}%`:'⚠️ 3. ค้างนิ่ง';
  e.calibrationText.textContent=!metrics.bodyOk
    ?'ให้เห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสองเพียงบางส่วนก็พอ — ไม่ต้องเห็นข้อเท้า'
    :!metrics.armsOk
      ?'กางแขนออกพอสบาย ไม่ต้องเหยียดสุดหรือถอยไกล'
      :!metrics.stable
        ?'ค้างนิ่งและมองตรงชั่วครู่'
        :'ดีมาก พร้อมเริ่มแล้ว';

  if(percent<100)return;

  const ankleL=inferredAnkle(landmarks,25,27,-.012);
  const ankleR=inferredAnkle(landmarks,26,28,.012);
  const ankleMid=mid(ankleL,ankleR);
  s.calibration={
    center:metrics.center,
    shoulderCenter:metrics.shoulderCenter,
    shoulderWidth:metrics.shoulderWidth,
    bodyHeight:Math.max(.28,ankleMid.y-Number(landmarks[0]?.y||0)),
    ankleL,
    ankleR,
    ankleMid,
    ankleSpread:Math.max(.05,dist(ankleL,ankleR)),
    kneeL:{...landmarks[25]},
    kneeR:{...landmarks[26]},
    kneeMid:metrics.kneeCenter,
    lowerBodyMode:(vis(landmarks[27])>=.20&&vis(landmarks[28])>=.20)?'ankle-observed':'knee-inferred',
    ankleObserved:vis(landmarks[27])>=.20&&vis(landmarks[28])>=.20,
    cameraProfile:s.cameraProfile||'front-adaptive',
    cameraSettings:s.cameraSettings||{},
    readinessProfile:'close-range-head-to-knee-v41',
    calibrationRequiredMs:requiredMs,
    ts:Date.now()
  };
  s.phase='ready';
  BH.startCountdown();
};

function lateralMetrics(landmarks,side){
  if(!Array.isArray(landmarks)||!s.calibration)return null;
  const left=side==='left';
  const shoulders=mid(landmarks[11],landmarks[12]);
  const hips=mid(landmarks[23],landmarks[24]);
  const shoulderWidth=Math.max(.055,s.calibration.shoulderWidth||dist(landmarks[11],landmarks[12]));
  const shoulderShift=(shoulders.x-s.calibration.shoulderCenter.x)/shoulderWidth;
  const hipShift=(hips.x-s.calibration.center.x)/shoulderWidth;
  const torsoLean=(shoulders.x-hips.x)/shoulderWidth;
  const arm=armEvidence(landmarks,side,Math.max(.04,dist(landmarks[11],landmarks[12])));
  const direction=left?-1:1;
  const shiftStrength=Math.max(direction*shoulderShift,direction*hipShift*.85,direction*torsoLean*.72);
  const bodyConfidence=avg(landmarks,[0,11,12,13,14,23,24,25,26]);
  const kneesVisible=vis(landmarks[25])>=.13&&vis(landmarks[26])>=.13;
  const centeredSafety=Math.abs(hipShift)<.88;
  const directionReady=shiftStrength>=.022;
  const reachReady=arm.reach>=.34&&arm.level<=.44;
  return{
    directionReady,
    reachReady,
    bodyConfidence,
    kneesVisible,
    centeredSafety,
    shiftStrength,
    shoulderShift,
    hipShift,
    torsoLean,
    arm
  };
}

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(landmarks,key)=>{
  const result=baseEvaluate(landmarks,key)||{};
  if(key!=='left'&&key!=='right')return result;
  const metrics=lateralMetrics(landmarks,key);
  if(!metrics||result.transitionPreview)return result;

  const stability=Number(result.stability||0);
  const confidence=Math.max(Number(result.confidence||0),metrics.bodyConfidence*100);
  const evidence=metrics.directionReady&&metrics.reachReady&&metrics.kneesVisible&&metrics.centeredSafety;
  const qualityReady=confidence>=27&&stability>=27;
  const derivedPose=C(58+metrics.shiftStrength*170+Math.max(0,metrics.arm.reach-.30)*48,0,100);

  result.confidence=confidence;
  result.pose=Math.max(Number(result.pose||0),derivedPose);
  result.safe=Math.max(Number(result.safe||0),metrics.centeredSafety&&metrics.kneesVisible?62:28);
  result.feetStable=metrics.centeredSafety&&metrics.kneesVisible;
  result.lateralEvidence=metrics;
  result.lateralDetectionVersion=RELEASE;

  if(evidence&&qualityReady){
    result.valid=true;
    result.signatureBlocked=false;
    result.feedback=`✅ ตรวจพบท่าเอียง${key==='left'?'ซ้าย':'ขวา'}แล้ว • ค้างไว้`;
  }else if(!metrics.kneesVisible){
    result.valid=false;
    result.feedback='📷 ให้เห็นสะโพกและเข่าทั้งสองเพียงบางส่วน — ไม่ต้องเห็นข้อเท้า';
  }else if(!metrics.directionReady){
    result.valid=false;
    result.feedback=`↔️ เอนลำตัวไปทาง${key==='left'?'ซ้าย':'ขวา'}เพียงเล็กน้อย`;
  }else if(!metrics.reachReady){
    result.valid=false;
    result.feedback=`⭐ เอื้อมแขน${key==='left'?'ซ้าย':'ขวา'}ออกอีกเล็กน้อย`;
  }else if(!qualityReady){
    result.valid=false;
    result.feedback='👍 ท่าถูกแล้ว • มองตรงและค้างให้นิ่งอีกนิด';
  }
  return result;
};

if(typeof BH.setPoseUI==='function'){
  const baseSetPoseUI=BH.setPoseUI;
  BH.setPoseUI=()=>{
    baseSetPoseUI();
    const key=BH.currentPoseKey?.()||s.currentKey;
    if(key==='left')e.poseCue.textContent='เอื้อมแขนซ้ายและเอนซ้ายเพียงเล็กน้อย เท้ายังอยู่ที่เดิม';
    else if(key==='right')e.poseCue.textContent='เอื้อมแขนขวาและเอนขวาเพียงเล็กน้อย เท้ายังอยู่ที่เดิม';
  };
}

if(typeof BH.calcSummary==='function'){
  const baseSummary=BH.calcSummary;
  BH.calcSummary=reason=>{
    const summary=baseSummary(reason)||{};
    summary.closeRangeReadinessVersion=RELEASE;
    summary.readinessProfile='head-shoulder-hip-partial-knee-no-ankle';
    summary.calibrationRequiredMs=850;
    summary.lateralDetectionProfile='symmetric-gentle-shift-elbow-wrist-fallback';
    return summary;
  };
}

if(e.calibrationText)e.calibrationText.textContent='ให้เห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสองเพียงบางส่วนก็พอ — ไม่ต้องเห็นข้อเท้า';
if(e.calBody)e.calBody.textContent='1. ศีรษะ–เข่า';
if(e.calArms)e.calArms.textContent='2. กางแขนพอสบาย';

console.info('[BalanceHold] Close-range readiness and gentle lateral detection ready',RELEASE);
})();