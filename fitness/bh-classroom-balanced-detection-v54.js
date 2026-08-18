(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||!BH.CONFIG||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el;
const RELEASE='20260818-BALANCE-CLASSROOM-BALANCED-DETECTION-V55-GETTER-SAFE';

function descriptorFor(obj,key){
  let cur=obj;
  while(cur){const d=Object.getOwnPropertyDescriptor(cur,key);if(d)return d;cur=Object.getPrototypeOf(cur)}
  return null;
}
function safePatch(target,patch,label){
  if(!target||typeof target!=='object')return;
  for(const [key,value] of Object.entries(patch)){
    try{
      const d=descriptorFor(target,key);
      if(d&&typeof d.get==='function'&&!d.set){
        console.info('[BalanceHold] getter-only config preserved',label,key,target[key]);
        continue;
      }
      if(d&&d.writable===false&&!d.set){
        console.info('[BalanceHold] read-only config preserved',label,key,target[key]);
        continue;
      }
      target[key]=value;
    }catch(error){
      console.warn('[BalanceHold] config patch skipped',label,key,error?.message||error);
    }
  }
}

safePatch(BH.CONFIG.easy,{hold:2200,poseThreshold:66,safeThreshold:50,gateMs:320,graceMs:650,lostDebounceMs:900,assistAfterMs:6500,maxAssist:1},'easy');
safePatch(BH.CONFIG.normal,{hold:2800,poseThreshold:71,safeThreshold:55,gateMs:380,graceMs:600,lostDebounceMs:850,assistAfterMs:7500,maxAssist:1},'normal');
safePatch(BH.CONFIG.hard,{hold:3300,poseThreshold:76,safeThreshold:60,gateMs:430,graceMs:520,lostDebounceMs:800,assistAfterMs:8500,maxAssist:1},'hard');

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  const level=e.difficulty?.value||'easy';
  const cfg=BH.CONFIG[level]||BH.CONFIG.easy;
  const boss=String(s.currentKey||'')==='boss'||String(key||'').toLowerCase().includes('boss');
  const advanced=boss||['treeLeft','treeRight','airplaneLeft','airplaneRight','crystalBoss'].includes(key);
  const poseThreshold=Number(cfg?.poseThreshold);const safeThreshold=Number(cfg?.safeThreshold);
  const poseFloor=boss?62:Math.max(Number.isFinite(poseThreshold)?poseThreshold-2:0,level==='easy'?64:level==='normal'?69:74);
  const safeFloor=boss?58:Math.max(Number.isFinite(safeThreshold)?safeThreshold-3:0,level==='easy'?47:level==='normal'?52:57);
  const stabilityFloor=boss?58:advanced?(level==='easy'?58:level==='normal'?62:66):(level==='easy'?52:level==='normal'?56:60);
  const controlFloor=boss?50:advanced?(level==='easy'?50:level==='normal'?54:58):(level==='easy'?46:level==='normal'?50:54);
  const confidenceFloor=boss?45:(level==='easy'?45:level==='normal'?50:56);
  const confidence=Number(r.confidence||0),pose=Number(r.pose||0),safe=Number(r.safe||0),stability=Number(r.stability||0),control=Number(r.control||0);
  const valid=!!r.tracked&&confidence>=confidenceFloor&&pose>=poseFloor&&safe>=safeFloor&&stability>=stabilityFloor&&control>=controlFloor;
  r.valid=valid;r.threshold=Math.max(Number(r.threshold||0),poseFloor);r.safeThreshold=Math.max(Number(r.safeThreshold||0),safeFloor);r.requiredStability=stabilityFloor;r.requiredControl=controlFloor;r.requiredConfidence=confidenceFloor;r.balancedDetection=true;r.balancedDetectionVersion=RELEASE;
  if(!valid){
    if(confidence<confidenceFloor)r.feedback='ให้กล้องเห็นไหล่ สะโพก และเข่าชัดขึ้น';
    else if(pose<poseFloor)r.feedback='ปรับท่าให้ใกล้ตัวอย่างมากขึ้น';
    else if(safe<safeFloor)r.feedback='กลับเข้า Safe Zone และควบคุมลำตัว';
    else if(stability<stabilityFloor)r.feedback='ท่าถูกแล้ว แต่ยังแกว่ง • ค้างให้นิ่งขึ้น';
    else if(control<controlFloor)r.feedback='ควบคุมไหล่และสะโพกให้นิ่งอีกนิด';
  }
  return r;
};

if(typeof BH.calcSummary==='function'){
  const baseSummary=BH.calcSummary;
  BH.calcSummary=reason=>{
    const x=baseSummary(reason)||{};
    x.balanceDetectionVersion=RELEASE;x.balanceDetectionProfile='grade5-balanced-getter-safe';
    x.holdProfile=`easy:${Number(BH.CONFIG.easy?.hold||0)}|normal:${Number(BH.CONFIG.normal?.hold||0)}|hard:${Number(BH.CONFIG.hard?.hold||0)}`;
    x.poseThresholdProfile='easy:64|normal:69|hard:74|boss:62';x.stabilityThresholdProfile='easy:52|normal:56|hard:60|advanced:58/62/66|boss:58';x.controlThresholdProfile='easy:46|normal:50|hard:54|boss:50';
    return x;
  };
}
window.HH_BALANCE_DETECTION_V55={release:RELEASE,profile:'grade5-balanced-getter-safe'};
console.info('[BalanceHold] getter-safe Grade 5 balanced detection ready',RELEASE);
})();