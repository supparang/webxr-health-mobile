(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||typeof BH.evaluatePose!=='function')return;
const s=BH.state;
const RELEASE='20260818-BALANCE-BOSS-GRADE5-FAIR-V2';
const baseEvaluate=BH.evaluatePose;
const FLOOR={confidence:36,pose:52,safe:45,stability:45,control:40};
BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  if(String(s.currentKey||'')!=='boss')return r;
  const confidence=Number(r.confidence||0);
  const pose=Number(r.pose||0);
  const safe=Number(r.safe||0);
  const stability=Number(r.stability||0);
  const control=Number(r.control||0);
  const tracked=!!r.tracked||confidence>=FLOOR.confidence;
  const valid=tracked&&confidence>=FLOOR.confidence&&pose>=FLOOR.pose&&safe>=FLOOR.safe&&stability>=FLOOR.stability&&control>=FLOOR.control;
  r.valid=valid;
  r.tracked=tracked;
  r.threshold=FLOOR.pose;
  r.safeThreshold=FLOOR.safe;
  r.requiredStability=FLOOR.stability;
  r.requiredControl=FLOOR.control;
  r.requiredConfidence=FLOOR.confidence;
  r.bossGrade5FairV2=true;
  r.bossGrade5FairV2Release=RELEASE;
  if(valid){
    r.feedback='✅ ท่าถูกแล้ว • ค้างให้นิ่งจนวงกลมเต็ม';
  }else if(confidence<FLOOR.confidence){
    r.feedback='ขยับให้กล้องเห็นไหล่ สะโพก และเข่าชัดขึ้น';
  }else if(pose<FLOOR.pose){
    const dir=String(s.bossKey||key||'right');
    r.feedback=dir==='left'?'กางแขนแล้วเอียงไหล่ไปทางซ้ายอีกนิด':'กางแขนแล้วเอียงไหล่ไปทางขวาอีกนิด';
  }else if(safe<FLOOR.safe){
    r.feedback='ขยับตัวกลับเข้ากลางภาพอีกนิด';
  }else if(stability<FLOOR.stability){
    r.feedback='ท่าถูกแล้ว • ลดการแกว่งอีกนิด';
  }else if(control<FLOOR.control){
    r.feedback='ขยับช้าลง แล้วค้างไหล่กับสะโพกให้นิ่ง';
  }
  return r;
};
window.HH_BALANCE_BOSS_GRADE5_FAIR_V2={release:RELEASE,floors:{...FLOOR},completionPolicy:'strict-6of6'};
console.info('[BalanceHold] Grade 5 Boss Fair V2 ready',window.HH_BALANCE_BOSS_GRADE5_FAIR_V2);
})();