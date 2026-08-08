(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el,C=BH.clamp;
const RELEASE='20260808-BALANCE-WARMUP-GATE-V61';
const baseEvaluate=BH.evaluatePose;
const visible=(p,min=.24)=>!!p&&Number(p.v??p.visibility??0)>=min;

function warmupEvaluation(lm,base){
  if(!Array.isArray(lm)||!s.calibration)return base;
  const ls=lm[11],rs=lm[12],lh=lm[23],rh=lm[24];
  const tracked=[ls,rs,lh,rh].every(p=>visible(p,.24));
  if(!tracked){
    return {...base,valid:false,tracked:false,confidence:0,pose:0,stability:0,control:0,safe:0,
      feedback:'ให้กล้องเห็นไหล่และสะโพกทั้งสองข้าง',feetStable:true,warmupGateVersion:RELEASE};
  }
  const shoulders={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
  const hips={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
  const shW=Math.max(.04,Math.hypot(ls.x-rs.x,ls.y-rs.y));
  const shoulderLevel=Math.abs(ls.y-rs.y);
  const torsoAngle=Math.atan2(hips.y-shoulders.y,hips.x-shoulders.x)*180/Math.PI;
  const torsoTilt=Math.abs(Math.abs(torsoAngle)-90);
  const centerRef=Number(s.calibration.center?.x??.5);
  const shoulderRef=Number(s.calibration.shoulderCenter?.x??centerRef);
  const hipShift=Math.abs(hips.x-centerRef)/Math.max(.05,Number(s.calibration.shoulderWidth||shW));
  const shoulderShift=Math.abs(shoulders.x-shoulderRef)/Math.max(.05,Number(s.calibration.shoulderWidth||shW));
  const visibility=[ls,rs,lh,rh].reduce((z,p)=>z+Number(p.v??p.visibility??0),0)/4;
  const confidence=C(visibility*100,0,100);
  const pose=C(100-torsoTilt*3.2-shoulderLevel*260-shoulderShift*35,0,100);
  const safe=C(100-hipShift*55,0,100);
  const stability=C(Number(base?.stability??s.stabilityScore??0),0,100);
  const control=C(Number(base?.control??s.controlScore??0),0,100);
  const valid=confidence>=42&&pose>=58&&safe>=44&&stability>=46;
  let feedback='✅ พร้อมแล้ว • ยืนนิ่งตรงกลาง';
  if(confidence<42)feedback='ให้กล้องเห็นไหล่และสะโพกชัดขึ้น';
  else if(torsoTilt>14)feedback='ยืดลำตัวให้ตรงขึ้น';
  else if(shoulderLevel>.11)feedback='ผ่อนไหล่ให้ใกล้ระดับเดียวกัน';
  else if(safe<44)feedback='ขยับลำตัวกลับเข้ากลางภาพ';
  else if(stability<46)feedback='อยู่นิ่งอีกนิด แล้วระบบจะเริ่มนับ';
  return {...base,valid,tracked:true,confidence,pose,stability,control,safe,feetStable:true,
    feedback,threshold:58,safeThreshold:44,warmupGate:true,warmupGateVersion:RELEASE};
}

BH.evaluatePose=(lm,key)=>{
  const base=baseEvaluate(lm,key)||{};
  const isWarmup=String(s.phase||'')==='play'&&Number(s.index||0)===0&&String(s.currentKey||'')==='center';
  return isWarmup?warmupEvaluation(lm,base):base;
};

const baseSetPoseUI=BH.setPoseUI;
if(typeof baseSetPoseUI==='function'){
  BH.setPoseUI=()=>{
    const result=baseSetPoseUI();
    if(Number(s.index||0)===0&&String(s.currentKey||'')==='center'){
      if(e.poseName)e.poseName.textContent='🧘 Warm-up • ยืนนิ่งตรงกลาง';
      if(e.poseCue)e.poseCue.textContent='ให้เห็นไหล่–สะโพก • ยืนตรง • ค้างนิ่ง';
      BH.setCoach?.('ยืนนิ่งตรงกลาง ไม่ต้องกางแขน','ระบบจะเริ่มนับเมื่อเห็นไหล่และสะโพกชัด','🧘','WARM-UP');
    }
    return result;
  };
}

if(typeof BH.calcSummary==='function'){
  const baseSummary=BH.calcSummary;
  BH.calcSummary=reason=>{const x=baseSummary(reason)||{};x.warmupGateVersion=RELEASE;x.warmupPolicy='shoulders-hips-neutral-stance-no-wrist-ankle-required';return x};
}
window.BH_WARMUP_GATE_V61={release:RELEASE};
document.documentElement.dataset.bhWarmupGate='v61';
console.info('[BalanceHold] Warm-up Gate V61 ready',RELEASE);
})();
