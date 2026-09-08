(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;

const RELEASE='20260908-BALANCE-CLASSROOM-TREE-KNEE-PROOF-V38-GRADE5-FAIR';
const s=BH.state;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const C=BH.clamp||((value,min,max)=>Math.max(min,Math.min(max,value)));
const vis=point=>Number(point?.v||0);
const clone=point=>({x:Number(point?.x||0),y:Number(point?.y||0),z:Number(point?.z||0),v:Number(point?.v||0)});

function distance(a,b){if(!a||!b)return 0;return Math.hypot(a.x-b.x,a.y-b.y)}
function angle(a,b,c){if(!a||!b||!c)return 180;const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};const d=Math.max(.0001,Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y));return Math.acos(C((ab.x*cb.x+ab.y*cb.y)/d,-1,1))*180/Math.PI}
function lowerLegLength(landmarks,side){const hip=landmarks[side==='left'?23:24],knee=landmarks[side==='left'?25:26];return C(distance(hip,knee)*.94,.10,.25)}
function prepareLandmarks(landmarks){if(!Array.isArray(landmarks))return landmarks;const out=landmarks.map(clone);[[25,27,'left',-.012],[26,28,'right',.012]].forEach(([ki,ai,side,xoff])=>{const knee=out[ki],ankle=out[ai];if(!knee||vis(knee)<.22||vis(ankle)>=.40)return;out[ai]={x:C(knee.x+xoff,.015,.985),y:C(knee.y+lowerLegLength(out,side),.04,.988),z:knee.z,v:C(vis(knee)*.92,.48,.76),classroomKneeEstimated:true}});return out}

if(typeof BH.updateCalibration==='function'){
  const base=BH.updateCalibration;
  BH.updateCalibration=landmarks=>{const before=s.calibration;const result=base(landmarks);if(!before&&s.calibration&&Array.isArray(landmarks)){if(landmarks[25])s.calibration.kneeL=clone(landmarks[25]);if(landmarks[26])s.calibration.kneeR=clone(landmarks[26]);s.calibration.treeProofProfile='hip-knee-mobile-v38-grade5-fair'}return result};
}
function resetProof(key){if(s.classroomTreeProofKey===key)return;s.classroomTreeProofKey=key;s.classroomTreeProofMs=0;s.classroomTreeProofLast=performance.now()}
function treeEvidence(landmarks,key){
  const liftRight=key==='treeLeft';
  const targetHip=landmarks[liftRight?24:23],targetKnee=landmarks[liftRight?26:25],targetAnkle=landmarks[liftRight?28:27];
  const supportHip=landmarks[liftRight?23:24],supportKnee=landmarks[liftRight?25:26],supportAnkle=landmarks[liftRight?27:28];
  const baseline=s.calibration?.[liftRight?'kneeR':'kneeL'];
  const shoulderWidth=Math.max(.07,s.calibration?.shoulderWidth||distance(landmarks[11],landmarks[12])||.16),bodyHeight=Math.max(.28,s.calibration?.bodyHeight||.55),direction=liftRight?1:-1;
  const targetVisible=vis(targetHip)>=.22&&vis(targetKnee)>=.22,supportVisible=vis(supportHip)>=.22&&vis(supportKnee)>=.22;
  const outwardFromHip=direction*(targetKnee.x-targetHip.x)/shoulderWidth,outwardFromBaseline=baseline?direction*(targetKnee.x-baseline.x)/shoulderWidth:0,riseFromBaseline=baseline?(baseline.y-targetKnee.y)/bodyHeight:0,kneeRiseRelative=(supportKnee.y-targetKnee.y)/bodyHeight;
  const targetBend=angle(targetHip,targetKnee,targetAnkle),supportAngle=angle(supportHip,supportKnee,supportAnkle),supportAlignment=Math.abs(supportHip.x-supportKnee.x)/shoulderWidth;
  const outwardMove=outwardFromBaseline>=.045||outwardFromHip>=.14;
  const lowLift=riseFromBaseline>=.010||kneeRiseRelative>=.015;
  const bentOutward=targetBend<=172&&outwardFromHip>=.09;
  const targetMoved=lowLift||outwardMove||bentOutward;
  const supportStable=supportAngle>=136||supportAlignment<=.50;
  return{targetVisible,supportVisible,targetMoved,supportStable,outwardFromHip,outwardFromBaseline,riseFromBaseline,kneeRiseRelative,targetBend,supportAngle,liftSide:liftRight?'ขวา':'ซ้าย',proof:targetVisible&&supportVisible&&targetMoved&&supportStable};
}

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(landmarks,key)=>{
  const isTree=key==='treeLeft'||key==='treeRight';
  if(!isTree)return baseEvaluate(landmarks,key);
  const prepared=prepareLandmarks(landmarks),result=baseEvaluate(prepared,key)||{};resetProof(key);if(!Array.isArray(prepared))return result;
  const evidence=treeEvidence(prepared,key),now=performance.now(),delta=Math.min(100,Math.max(0,now-(s.classroomTreeProofLast||now)));s.classroomTreeProofLast=now;
  // Grade-5 classroom policy: movement evidence is the gate; pose/safe/stability remain scoring signals.
  const trackingReady=result.tracked!==false&&Number(result.confidence||0)>=26;
  if(evidence.proof&&trackingReady)s.classroomTreeProofMs=Math.min(900,(s.classroomTreeProofMs||0)+delta);else s.classroomTreeProofMs=Math.max(0,(s.classroomTreeProofMs||0)-delta*.65);
  const requiredMs=200;
  if(s.classroomTreeProofMs>=requiredMs){result.valid=true;result.signatureBlocked=false;result.legVisibilityBlocked=false;result.legProofBlocked=false;result.feedback=`✅ ตรวจพบท่ายกขา${evidence.liftSide}แล้ว • ค้างต่อได้เลย`;}
  else if(!evidence.targetVisible||!evidence.supportVisible){result.valid=false;result.feedback='📷 ให้กล้องเห็นสะโพกและเข่าทั้งสอง — ไม่ต้องเห็นข้อเท้า';}
  else if(!evidence.targetMoved){result.valid=false;result.feedback=`🦵 ยกเข่า${evidence.liftSide}เล็กน้อย หรือแตะปลายเท้าออกด้านข้าง`;}
  else if(!evidence.supportStable){result.valid=false;result.feedback='🧘 ยืนขารับน้ำหนักให้นิ่งอีกนิด';}
  else if(!trackingReady){result.valid=false;result.feedback='📷 เห็นท่าแล้ว • ขยับกล้องให้เห็นสะโพกและเข่าชัดขึ้น';}
  else{result.valid=false;result.feedback=`👍 เห็นการยกขา${evidence.liftSide}แล้ว • ค้างอีกนิด`;}
  result.treeKneeProofMs=Math.round(s.classroomTreeProofMs||0);result.treeKneeEvidence=evidence;result.treeKneeProofVersion=RELEASE;result.lowerBodyMode=(vis(landmarks?.[27])>=.40&&vis(landmarks?.[28])>=.40)?'ankle-observed':'knee-verified';return result;
};

if(typeof BH.calcSummary==='function'){
  const baseSummary=BH.calcSummary;
  BH.calcSummary=reason=>{const summary=baseSummary(reason)||{};summary.treeKneeProofVersion=RELEASE;summary.treeKneeProofProfile='grade5-fair-movement-gate-quality-as-score';return summary};
}

window.BH_TREE_KNEE_PROOF_V38={release:RELEASE,requiredProofMs:200,movementGate:true,qualityAsScore:true};
console.info('[BalanceHold] Classroom Tree Knee Proof V38 Grade-5 Fair ready',RELEASE);
})();