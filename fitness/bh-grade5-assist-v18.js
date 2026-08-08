(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el||!BH.CONFIG||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el,C=BH.clamp;
const RELEASE='20260808-BALANCE-HOLD-GRADE5-BALANCED-V18.1';

Object.assign(BH.CONFIG.easy,{hold:2200,poseThreshold:66,safeThreshold:50,gateMs:320,graceMs:650,lostDebounceMs:900,assistAfterMs:6500,maxAssist:1});
Object.assign(BH.CONFIG.normal,{hold:2800,poseThreshold:71,safeThreshold:55,gateMs:380,graceMs:600,lostDebounceMs:850,assistAfterMs:7500,maxAssist:1});
Object.assign(BH.CONFIG.hard,{hold:3300,poseThreshold:76,safeThreshold:60,gateMs:430,graceMs:520,lostDebounceMs:800,assistAfterMs:8500,maxAssist:1});

BH.GRADE5_ASSIST={release:RELEASE,enabled:()=>e.safeMode?.checked!==false,ankleFallbackCount:0,calibrationFallbackUsed:false,profile:'balanced-detection'};
function cloneLandmarks(lm){return lm?.map(p=>p?{...p}:p)}
function visible(p,min=.30){return !!p&&(p.v??0)>=min}

function addCalibrationKneeFallback(lm){
  if(!BH.GRADE5_ASSIST.enabled()||!lm)return{lm,used:false};
  const out=cloneLandmarks(lm);let used=false;
  const shoulderMid=BH.mid(out[11],out[12]),hipMid=BH.mid(out[23],out[24]);
  const torso=Math.max(.10,BH.dist(shoulderMid,hipMid));
  [[25,27,-1],[26,28,1]].forEach(([kneeIndex,ankleIndex,side])=>{
    const knee=out[kneeIndex],ankle=out[ankleIndex];
    if(visible(ankle,.26)||!visible(knee,.42))return;
    out[ankleIndex]={x:C(knee.x+side*torso*.07,0,1),y:C(knee.y+torso*1.08,0,1),z:knee.z||0,v:.42,grade5Estimated:true};
    used=true;
  });
  if(used)BH.GRADE5_ASSIST.calibrationFallbackUsed=true;
  return{lm:out,used};
}

function addKneeFallback(lm){
  if(!BH.GRADE5_ASSIST.enabled()||!lm||!s.calibration)return{lm,used:false};
  const out=cloneLandmarks(lm);let used=false;
  [[25,27,'ankleL'],[26,28,'ankleR']].forEach(([kneeIndex,ankleIndex,calKey])=>{
    const knee=out[kneeIndex],ankle=out[ankleIndex],cal=s.calibration[calKey];
    if(visible(ankle,.26)||!visible(knee,.42)||!cal)return;
    const bodyH=Math.max(.24,s.calibration.bodyHeight||.55);
    out[ankleIndex]={x:C(knee.x+(cal.x-knee.x)*.42,0,1),y:C(knee.y+bodyH*.29,0,1),z:knee.z||0,v:.43,grade5Estimated:true};
    used=true;
  });
  if(used)BH.GRADE5_ASSIST.ankleFallbackCount++;
  return{lm:out,used};
}

if(typeof BH.updateCalibration==='function'){
  const baseUpdateCalibration=BH.updateCalibration;
  BH.updateCalibration=lm=>{
    const prepared=addCalibrationKneeFallback(lm);
    if(prepared.used&&e.calibrationText)e.calibrationText.textContent='เห็นศีรษะถึงเข่าแล้ว • ระบบช่วยประเมินตำแหน่งเท้า แต่ยังต้องทำท่าให้ถูกและนิ่ง';
    return baseUpdateCalibration(prepared.lm);
  };
}

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(landmarks,key)=>{
  const assistOn=BH.GRADE5_ASSIST.enabled();
  const prepared=assistOn?addKneeFallback(landmarks):{lm:landmarks,used:false};
  const r=baseEvaluate(prepared.lm,key)||{};
  if(!assistOn)return r;

  const level=e.difficulty?.value||'normal';
  const cfg=BH.CONFIG[level]||BH.CONFIG.normal;
  const advanced=['treeLeft','treeRight','airplaneLeft','airplaneRight','crystalBoss','boss'].includes(key);
  const relax=level==='easy'?2:level==='normal'?1:0;
  const safeRelax=prepared.used?(level==='easy'?3:2):0;
  const effectivePose=Math.max(cfg.poseThreshold-2,(r.threshold??cfg.poseThreshold)-relax-Math.min(1,Number(s.assistLevel||0)));
  const effectiveSafe=Math.max(cfg.safeThreshold-3,(r.safeThreshold??cfg.safeThreshold)-safeRelax);
  const baseConfidence=Number(cfg.confidence||.46);
  const confidenceFloor=Math.max(level==='easy' ? .45 : level==='normal' ? .50 : .56,baseConfidence-(prepared.used?.03:0));
  const stabilityFloor=advanced?(level==='easy'?58:level==='normal'?62:66):(level==='easy'?52:level==='normal'?56:60);
  const controlFloor=advanced?(level==='easy'?50:level==='normal'?54:58):(level==='easy'?46:level==='normal'?50:54);
  const attempted=(r.pose||0)>=effectivePose;
  const safeEnough=(r.safe||0)>=effectiveSafe;
  const stableEnough=(r.stability||0)>=stabilityFloor;
  const controlEnough=(r.control||0)>=controlFloor;
  const confidenceEnough=((r.confidence||0)/100)>=confidenceFloor;
  r.valid=!!r.tracked&&confidenceEnough&&attempted&&safeEnough&&stableEnough&&controlEnough;
  r.threshold=effectivePose;r.safeThreshold=effectiveSafe;r.grade5Assist=true;r.grade5BalancedDetection=true;r.ankleFallbackUsed=prepared.used;
  r.requiredStability=stabilityFloor;r.requiredControl=controlFloor;r.requiredConfidence=Math.round(confidenceFloor*100);

  if(prepared.used){
    r.safe=Math.min(r.safe||0,82);r.confidence=Math.min(r.confidence||0,88);
    if(!r.valid)r.feedback='เห็นช่วงบนชัดแล้ว • ทำท่าให้ตรงและค้างให้นิ่งอีกนิด';
  }
  if(r.valid){
    const remain=Math.max(0,Math.ceil((cfg.hold-(s.holdMs||0))/1000));
    r.feedback=remain>0?`✅ ท่าถูกแล้ว • ค้างให้นิ่งอีก ${remain} วินาที`:'🎉 เยี่ยม ผ่านแล้ว!';
  }else if(!confidenceEnough)r.feedback='ขยับเข้าแสงหรือถอยให้เห็นลำตัวชัดขึ้น';
  else if(!attempted)r.feedback='ปรับท่าให้ใกล้ตัวอย่างมากขึ้น';
  else if(!safeEnough)r.feedback=prepared.used?'ยืนตรงกลางและควบคุมลำตัว':'ขยับกลับเข้า Safe Zone';
  else if(!stableEnough)r.feedback='ท่าถูกแล้ว แต่ยังแกว่ง • ค้างให้นิ่งขึ้น';
  else if(!controlEnough)r.feedback='ควบคุมไหล่และสะโพกให้นิ่งอีกนิด';
  return r;
};

function installUI(){
  if(document.getElementById('bhGrade5AssistBadge'))return;
  const badge=document.createElement('span');badge.id='bhGrade5AssistBadge';badge.textContent='🧒 Grade 5 Balanced • Hold 2.2–3.3s';
  badge.style.cssText='display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;background:#ecfdf5;border:2px solid #86efac;color:#047857;font-size:11px;font-weight:1000;margin-top:8px';
  document.querySelector('#startOverlay .safetyNote')?.insertAdjacentElement('beforebegin',badge);
  if(e.safeMode)e.safeMode.addEventListener('change',()=>{badge.style.opacity=e.safeMode.checked?'1':'.48';badge.textContent=e.safeMode.checked?'🧒 Grade 5 Balanced • Hold 2.2–3.3s':'🎯 Standard Pose Rules'});
}

if(typeof BH.calcSummary==='function'){
  const baseCalc=BH.calcSummary;
  BH.calcSummary=reason=>{
    const x=baseCalc(reason)||{};
    x.grade5Assist=BH.GRADE5_ASSIST.enabled();x.grade5AssistVersion=RELEASE;
    x.grade5DetectionProfile='balanced-v18.1';
    x.ankleFallbackCount=BH.GRADE5_ASSIST.ankleFallbackCount;
    x.calibrationFallbackUsed=BH.GRADE5_ASSIST.calibrationFallbackUsed;
    x.holdProfile='easy:2200|normal:2800|hard:3300';
    x.poseThresholdProfile='easy:66|normal:71|hard:76';
    x.stabilityFloorProfile='easy:52/58adv|normal:56/62adv|hard:60/66adv';
    return x;
  };
}
installUI();
console.info('[BalanceHold] Grade 5 Balanced detection ready',RELEASE);
})();