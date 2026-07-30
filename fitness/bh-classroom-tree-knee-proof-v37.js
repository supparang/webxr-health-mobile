(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;

const RELEASE='20260730-BALANCE-CLASSROOM-TREE-KNEE-PROOF-V37';
const s=BH.state;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const C=BH.clamp||((value,min,max)=>Math.max(min,Math.min(max,value)));
const vis=point=>Number(point?.v||0);
const clone=point=>({x:Number(point?.x||0),y:Number(point?.y||0),z:Number(point?.z||0),v:Number(point?.v||0)});

function distance(a,b){
  if(!a||!b)return 0;
  return Math.hypot(a.x-b.x,a.y-b.y);
}

function angle(a,b,c){
  if(!a||!b||!c)return 180;
  const ab={x:a.x-b.x,y:a.y-b.y};
  const cb={x:c.x-b.x,y:c.y-b.y};
  const denominator=Math.max(.0001,Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y));
  return Math.acos(C((ab.x*cb.x+ab.y*cb.y)/denominator,-1,1))*180/Math.PI;
}

function lowerLegLength(landmarks,side){
  const hip=landmarks[side==='left'?23:24];
  const knee=landmarks[side==='left'?25:26];
  return C(distance(hip,knee)*.94,.10,.25);
}

function prepareLandmarks(landmarks){
  if(!Array.isArray(landmarks))return landmarks;
  const output=landmarks.map(clone);

  [[25,27,'left',-.012],[26,28,'right',.012]].forEach(([kneeIndex,ankleIndex,side,xOffset])=>{
    const knee=output[kneeIndex];
    const ankle=output[ankleIndex];
    if(!knee||vis(knee)<.24||vis(ankle)>=.44)return;
    output[ankleIndex]={
      x:C(knee.x+xOffset,.015,.985),
      y:C(knee.y+lowerLegLength(output,side),.04,.988),
      z:knee.z,
      v:C(vis(knee)*.92,.52,.78),
      classroomKneeEstimated:true
    };
  });

  return output;
}

// Preserve the neutral knee positions captured during calibration. They are
// used only to verify that the raised/toe-touch leg actually moved.
if(typeof BH.updateCalibration==='function'){
  const baseCalibration=BH.updateCalibration;
  BH.updateCalibration=landmarks=>{
    const before=s.calibration;
    const result=baseCalibration(landmarks);
    if(!before&&s.calibration&&Array.isArray(landmarks)){
      if(landmarks[25])s.calibration.kneeL=clone(landmarks[25]);
      if(landmarks[26])s.calibration.kneeR=clone(landmarks[26]);
      s.calibration.treeProofProfile='hip-knee-mobile-v37';
    }
    return result;
  };
}

function resetProof(key){
  if(s.classroomTreeProofKey===key)return;
  s.classroomTreeProofKey=key;
  s.classroomTreeProofMs=0;
  s.classroomTreeProofLast=performance.now();
}

function treeEvidence(landmarks,key){
  const liftRight=key==='treeLeft';
  const targetHip=landmarks[liftRight?24:23];
  const targetKnee=landmarks[liftRight?26:25];
  const targetAnkle=landmarks[liftRight?28:27];
  const supportHip=landmarks[liftRight?23:24];
  const supportKnee=landmarks[liftRight?25:26];
  const supportAnkle=landmarks[liftRight?27:28];
  const baseline=s.calibration?.[liftRight?'kneeR':'kneeL'];
  const shoulderWidth=Math.max(.07,s.calibration?.shoulderWidth||distance(landmarks[11],landmarks[12])||.16);
  const bodyHeight=Math.max(.28,s.calibration?.bodyHeight||.55);
  const direction=liftRight?1:-1;

  const targetVisible=vis(targetHip)>=.27&&vis(targetKnee)>=.27;
  const supportVisible=vis(supportHip)>=.27&&vis(supportKnee)>=.27;
  const outwardFromHip=direction*(targetKnee.x-targetHip.x)/shoulderWidth;
  const outwardFromBaseline=baseline?direction*(targetKnee.x-baseline.x)/shoulderWidth:0;
  const riseFromBaseline=baseline?(baseline.y-targetKnee.y)/bodyHeight:0;
  const kneeRiseRelative=(supportKnee.y-targetKnee.y)/bodyHeight;
  const targetBend=angle(targetHip,targetKnee,targetAnkle);
  const supportAngle=angle(supportHip,supportKnee,supportAnkle);
  const supportAlignment=Math.abs(supportHip.x-supportKnee.x)/shoulderWidth;

  // Safe Grade-5 evidence: a low lift OR toe-touch with the knee moving
  // outward. Standing straight cannot satisfy these combined conditions.
  const outwardMove=outwardFromBaseline>=.075||outwardFromHip>=.20;
  const lowLift=riseFromBaseline>=.018||kneeRiseRelative>=.025;
  const bentOutward=targetBend<=166&&outwardFromHip>=.13;
  const targetMoved=(outwardMove&&(bentOutward||lowLift))||lowLift;
  const supportStable=supportAngle>=142||supportAlignment<=.42;

  return{
    targetVisible,
    supportVisible,
    targetMoved,
    supportStable,
    outwardFromHip,
    outwardFromBaseline,
    riseFromBaseline,
    kneeRiseRelative,
    targetBend,
    supportAngle,
    liftSide:liftRight?'ขวา':'ซ้าย',
    proof:targetVisible&&supportVisible&&targetMoved&&supportStable
  };
}

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(landmarks,key)=>{
  const isTree=key==='treeLeft'||key==='treeRight';
  if(!isTree)return baseEvaluate(landmarks,key);

  const prepared=prepareLandmarks(landmarks);
  const result=baseEvaluate(prepared,key)||{};
  resetProof(key);

  if(!Array.isArray(prepared))return result;
  const evidence=treeEvidence(prepared,key);
  const now=performance.now();
  const delta=Math.min(100,Math.max(0,now-(s.classroomTreeProofLast||now)));
  s.classroomTreeProofLast=now;

  const poseThreshold=Math.max(44,Number(result.threshold||54)-10);
  const safeThreshold=Math.max(30,Number(result.safeThreshold||38)-6);
  const qualityReady=(result.tracked!==false)&&Number(result.confidence||0)>=34&&Number(result.pose||0)>=poseThreshold&&Number(result.safe||0)>=safeThreshold&&Number(result.stability||0)>=36;

  if(evidence.proof&&qualityReady){
    s.classroomTreeProofMs=Math.min(900,(s.classroomTreeProofMs||0)+delta);
  }else{
    s.classroomTreeProofMs=Math.max(0,(s.classroomTreeProofMs||0)-delta*1.15);
  }

  const requiredMs=280;
  if(s.classroomTreeProofMs>=requiredMs){
    result.valid=true;
    result.signatureBlocked=false;
    result.legVisibilityBlocked=false;
    result.legProofBlocked=false;
    result.feedback=`✅ ตรวจพบท่ายกขา${evidence.liftSide}แบบปลอดภัย • ค้างไว้`;
  }else if(!evidence.targetVisible||!evidence.supportVisible){
    result.valid=false;
    result.feedback='📷 ให้กล้องเห็นสะโพกและเข่าทั้งสอง — ไม่ต้องเห็นข้อเท้า';
  }else if(!evidence.targetMoved){
    result.valid=false;
    result.feedback=`🦵 ยกเข่า${evidence.liftSide}ต่ำ ๆ หรือแตะปลายเท้าออกด้านข้าง`;
  }else if(!evidence.supportStable){
    result.valid=false;
    result.feedback='🧘 ยืดขาข้างที่รับน้ำหนักและยืนให้นิ่ง';
  }else if(!qualityReady){
    result.valid=false;
    result.feedback='👍 ท่าถูกแล้ว • มองตรงและค้างให้นิ่งอีกนิด';
  }else{
    result.valid=false;
    result.feedback=`👍 เห็นการยกขา${evidence.liftSide}แล้ว • ค้างอีกนิด`;
  }

  result.treeKneeProofMs=Math.round(s.classroomTreeProofMs||0);
  result.treeKneeEvidence=evidence;
  result.treeKneeProofVersion=RELEASE;
  result.lowerBodyMode=(vis(landmarks?.[27])>=.44&&vis(landmarks?.[28])>=.44)?'ankle-observed':'knee-verified';
  return result;
};

if(typeof BH.calcSummary==='function'){
  const baseSummary=BH.calcSummary;
  BH.calcSummary=reason=>{
    const summary=baseSummary(reason)||{};
    summary.treeKneeProofVersion=RELEASE;
    summary.treeKneeProofProfile='calibration-relative-hip-knee-temporal';
    return summary;
  };
}

console.info('[BalanceHold] Classroom Tree Knee Proof v37 ready',RELEASE);
})();
