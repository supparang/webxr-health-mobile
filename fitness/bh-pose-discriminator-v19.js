(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el,C=BH.clamp;
const RELEASE='20260717-BALANCE-HOLD-POSE-DISCRIMINATOR-V19';
const visible=(p,min=.30)=>!!p&&(p.v??0)>=min;
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function angle(a,b,c){
  const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
  const den=Math.max(.0001,Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y));
  return Math.acos(C((ab.x*cb.x+ab.y*cb.y)/den,-1,1))*180/Math.PI;
}
function metrics(lm){
  if(!lm||!s.calibration)return null;
  const shoulders=mid(lm[11],lm[12]),hips=mid(lm[23],lm[24]);
  const shW=Math.max(.04,dist(lm[11],lm[12]));
  const shoulderShift=(shoulders.x-s.calibration.shoulderCenter.x)/Math.max(.05,s.calibration.shoulderWidth);
  const hipShift=(hips.x-s.calibration.center.x)/Math.max(.05,s.calibration.shoulderWidth);
  const torsoTilt=Math.abs(BH.angleLine(shoulders,hips)-90);
  const armLevel=(Math.abs(lm[15].y-lm[11].y)+Math.abs(lm[16].y-lm[12].y))/2;
  const leftExt=(lm[11].x-lm[15].x)/shW,rightExt=(lm[16].x-lm[12].x)/shW;
  const leftKnee=angle(lm[23],lm[25],lm[27]),rightKnee=angle(lm[24],lm[26],lm[28]);
  const bodyH=Math.max(.20,s.calibration.bodyHeight||.55);
  const leftFootLift=(s.calibration.ankleL.y-lm[27].y)/bodyH;
  const rightFootLift=(s.calibration.ankleR.y-lm[28].y)/bodyH;
  const leftKneeLift=(lm[26].y-lm[25].y)/bodyH;
  const rightKneeLift=(lm[25].y-lm[26].y)/bodyH;
  const handsUp=((lm[11].y-lm[15].y)+(lm[12].y-lm[16].y))/2;
  return{shoulderShift,hipShift,torsoTilt,armLevel,leftExt,rightExt,leftKnee,rightKnee,leftFootLift,rightFootLift,leftKneeLift,rightKneeLift,handsUp,
    anklesVisible:visible(lm[27],.28)&&visible(lm[28],.28),kneesVisible:visible(lm[25],.38)&&visible(lm[26],.38)};
}
function signature(key,m){
  if(!m)return{ok:false,message:'จัดให้กล้องเห็นไหล่ สะโพก และเข่าชัดเจน'};
  const level=e.difficulty?.value||'normal';
  const easy=level==='easy',normal=level==='normal';
  switch(key){
    case 'center': {
      const arms=m.leftExt>(easy?.38:.44)&&m.rightExt>(easy?.38:.44)&&m.armLevel<(easy?.27:.23);
      const centered=Math.abs(m.shoulderShift)<(easy?.34:.28)&&Math.abs(m.hipShift)<.42;
      return{ok:arms&&centered,message:!arms?'กางแขนทั้งสองให้อยู่ใกล้ระดับไหล่':'กลับมายืนตรงกลางก่อน'};
    }
    case 'left': {
      const direction=m.shoulderShift<(easy?-.045:-.065)||m.hipShift<(easy?-.035:-.055);
      const reach=m.leftExt>(easy?.50:.58)&&m.armLevel<(easy?.34:.30);
      return{ok:direction&&reach,message:!direction?'เอนลำตัวไปทางซ้ายให้เห็นชัดอีกนิด':'เอื้อมแขนซ้ายออกอีกนิด'};
    }
    case 'right': {
      const direction=m.shoulderShift>(easy?.045:.065)||m.hipShift>(easy?.035:.055);
      const reach=m.rightExt>(easy?.50:.58)&&m.armLevel<(easy?.34:.30);
      return{ok:direction&&reach,message:!direction?'เอนลำตัวไปทางขวาให้เห็นชัดอีกนิด':'เอื้อมแขนขวาออกอีกนิด'};
    }
    case 'treeLeft': {
      const leg=m.rightFootLift>(normal?.010:.016)||m.rightKnee<(normal?166:160)||m.rightKneeLift>(normal?.008:.014);
      const support=m.leftKnee>145&&Math.abs(m.hipShift)<.78;
      return{ok:m.kneesVisible&&leg&&support,message:!m.kneesVisible?'ให้กล้องเห็นเข่าทั้งสองข้าง':!leg?'งอหรือยกขาขวาขึ้นเล็กน้อยก่อนเริ่มนับ':'ลงน้ำหนักบนขาซ้ายและยืนนิ่ง'};
    }
    case 'treeRight': {
      const leg=m.leftFootLift>(normal?.010:.016)||m.leftKnee<(normal?166:160)||m.leftKneeLift>(normal?.008:.014);
      const support=m.rightKnee>145&&Math.abs(m.hipShift)<.78;
      return{ok:m.kneesVisible&&leg&&support,message:!m.kneesVisible?'ให้กล้องเห็นเข่าทั้งสองข้าง':!leg?'งอหรือยกขาซ้ายขึ้นเล็กน้อยก่อนเริ่มนับ':'ลงน้ำหนักบนขาขวาและยืนนิ่ง'};
    }
    case 'airplaneLeft': {
      const tilt=m.torsoTilt>(normal?6:8),arms=m.leftExt>.46&&m.rightExt>.46&&m.armLevel<.30;
      const rear=m.rightFootLift>(normal?.012:.020)||m.rightKneeLift>(normal?.010:.018)||m.rightKnee<164;
      return{ok:m.kneesVisible&&tilt&&arms&&rear,message:!tilt?'เอนลำตัวไปข้างหน้าเล็กน้อย':!arms?'กางแขนออกเหมือนปีกเครื่องบิน':!rear?'เลื่อนหรือยกขาขวาไปด้านหลังเล็กน้อย':'รักษาน้ำหนักบนขาซ้าย'};
    }
    case 'airplaneRight': {
      const tilt=m.torsoTilt>(normal?6:8),arms=m.leftExt>.46&&m.rightExt>.46&&m.armLevel<.30;
      const rear=m.leftFootLift>(normal?.012:.020)||m.leftKneeLift>(normal?.010:.018)||m.leftKnee<164;
      return{ok:m.kneesVisible&&tilt&&arms&&rear,message:!tilt?'เอนลำตัวไปข้างหน้าเล็กน้อย':!arms?'กางแขนออกเหมือนปีกเครื่องบิน':!rear?'เลื่อนหรือยกขาซ้ายไปด้านหลังเล็กน้อย':'รักษาน้ำหนักบนขาขวา'};
    }
    case 'crystalBoss':
    case 'boss': {
      const vShape=m.handsUp>(normal?.025:.040)&&m.leftExt>.30&&m.rightExt>.30;
      const centered=Math.abs(m.shoulderShift)<.38&&Math.abs(m.hipShift)<.48;
      return{ok:vShape&&centered,message:!vShape?'ยกแขนทั้งสองเฉียงขึ้นเป็นรูปตัว V':'กลับมายืนมั่นคงตรงกลาง'};
    }
    default:return{ok:true,message:''};
  }
}
const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  const sig=signature(key,metrics(lm));
  r.poseSignaturePassed=!!sig.ok;
  r.poseSignatureVersion=RELEASE;
  if(!sig.ok){
    r.valid=false;
    r.feedback='🎯 '+sig.message;
    r.signatureBlocked=true;
  }else if(r.valid){
    r.feedback=(r.feedback||'👍 ท่าถูกแล้ว • ค้างต่อ').replace('ใกล้ผ่านแล้ว','ท่าถูกแล้ว');
  }
  return r;
};
if(typeof BH.calcSummary==='function'){
  const baseCalc=BH.calcSummary;
  BH.calcSummary=reason=>{const x=baseCalc(reason)||{};x.poseDiscriminatorVersion=RELEASE;return x};
}
console.info('[BalanceHold] Pose discriminator v19 ready',RELEASE);
})();