(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el||!BH.CONFIG||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el,C=BH.clamp;
const RELEASE='20260717-BALANCE-HOLD-GRADE5-ASSIST-V18';

// Classroom defaults: shorter holds, wider grace window, and earlier gradual help.
Object.assign(BH.CONFIG.easy,{hold:1200,poseThreshold:58,safeThreshold:40,gateMs:220,graceMs:1050,lostDebounceMs:1300,assistAfterMs:4200,maxAssist:3});
Object.assign(BH.CONFIG.normal,{hold:1450,poseThreshold:62,safeThreshold:44,gateMs:260,graceMs:1000,lostDebounceMs:1250,assistAfterMs:4800,maxAssist:3});
Object.assign(BH.CONFIG.hard,{hold:1750,poseThreshold:68,safeThreshold:50,gateMs:320,graceMs:900,lostDebounceMs:1150,assistAfterMs:5600,maxAssist:2});

BH.GRADE5_ASSIST={release:RELEASE,enabled:()=>e.safeMode?.checked!==false,ankleFallbackCount:0};

function cloneLandmarks(lm){return lm?.map(p=>p?{...p}:p)}
function visible(p,min=.30){return !!p&&(p.v??0)>=min}

// When a laptop camera loses only the ankles, estimate a conservative virtual ankle
// from the visible knee and the player's calibration. This keeps pose play possible,
// while Safe/Tracking scores remain slightly penalised and never become perfect.
function addKneeFallback(lm){
  if(!BH.GRADE5_ASSIST.enabled()||!lm||!s.calibration)return{lm,used:false};
  const out=cloneLandmarks(lm);let used=false;
  [[25,27,'ankleL'],[26,28,'ankleR']].forEach(([kneeIndex,ankleIndex,calKey])=>{
    const knee=out[kneeIndex],ankle=out[ankleIndex],cal=s.calibration[calKey];
    if(visible(ankle,.26)||!visible(knee,.42)||!cal)return;
    const bodyH=Math.max(.24,s.calibration.bodyHeight||.55);
    out[ankleIndex]={
      x:C(knee.x+(cal.x-knee.x)*.42,0,1),
      y:C(knee.y+bodyH*.29,0,1),
      z:knee.z||0,
      v:.43,
      grade5Estimated:true
    };
    used=true;
  });
  if(used)BH.GRADE5_ASSIST.ankleFallbackCount++;
  return{lm:out,used};
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
  const relax=level==='easy'?7:level==='normal'?6:3;
  const safeRelax=level==='easy'?9:level==='normal'?7:4;
  const effectivePose=Math.max(50,(r.threshold??cfg.poseThreshold)-relax-s.assistLevel*2);
  const effectiveSafe=Math.max(34,(r.safeThreshold??cfg.safeThreshold)-safeRelax-s.assistLevel);
  const confidenceFloor=Math.max(.39,cfg.confidence-(prepared.used?.11:.07)-s.assistLevel*.018);

  // Primary-school mode accepts a clear attempt; advanced poses still require
  // visible body control and are not converted into automatic passes.
  const attempted=(r.pose||0)>=effectivePose;
  const safeEnough=(r.safe||0)>=effectiveSafe;
  const stableEnough=(r.stability||0)>=(advanced?44:40);
  r.valid=!!r.tracked&&((r.confidence||0)/100)>=confidenceFloor&&attempted&&safeEnough&&stableEnough;
  r.threshold=effectivePose;r.safeThreshold=effectiveSafe;
  r.grade5Assist=true;r.ankleFallbackUsed=prepared.used;

  if(prepared.used){
    r.safe=Math.min(r.safe||0,82);r.confidence=Math.min(r.confidence||0,88);
    if(!r.valid)r.feedback='👍 เห็นช่วงบนชัดแล้ว • ถอยอีกนิดให้เห็นเท้า หรือค้างท่านี้ต่อ';
  }
  if(r.valid){
    const remain=Math.max(0,Math.ceil((cfg.hold-(s.holdMs||0))/1000));
    r.feedback=remain>0?`👍 ดีมาก ค้างไว้อีก ${remain} วินาที`:'🎉 เยี่ยม ผ่านแล้ว!';
  }else if((r.pose||0)>=effectivePose-9&&safeEnough){
    r.feedback='👍 ใกล้ผ่านแล้ว • ปรับอีกนิดและค้างให้นิ่ง';
  }else if((r.safe||0)<effectiveSafe){
    r.feedback=prepared.used?'ถอยให้เห็นเท้ามากขึ้น หรือยืนให้นิ่งตรงกลาง':'ขยับเท้ากลับเข้า Safe Zone อีกนิด';
  }else if((r.stability||0)<(advanced?44:40)){
    r.feedback='หายใจช้า ๆ มองตรง และลดการขยับเล็กน้อย';
  }
  return r;
};

// Show the classroom-assist policy in the setup UI and during play.
function installUI(){
  if(document.getElementById('bhGrade5AssistBadge'))return;
  const badge=document.createElement('span');badge.id='bhGrade5AssistBadge';badge.textContent='🧒 Grade 5 Assist • Hold 1.2–1.8s';
  badge.style.cssText='display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;background:#ecfdf5;border:2px solid #86efac;color:#047857;font-size:11px;font-weight:1000;margin-top:8px';
  const safety=document.querySelector('#startOverlay .safetyNote');safety?.insertAdjacentElement('beforebegin',badge);
  if(e.safeMode){
    e.safeMode.addEventListener('change',()=>{badge.style.opacity=e.safeMode.checked?'1':'.48';badge.textContent=e.safeMode.checked?'🧒 Grade 5 Assist • Hold 1.2–1.8s':'🎯 Standard Pose Rules'});
  }
}

// Add release metadata without writing any extra record.
if(typeof BH.calcSummary==='function'){
  const baseCalc=BH.calcSummary;
  BH.calcSummary=reason=>{
    const x=baseCalc(reason)||{};
    x.grade5Assist=BH.GRADE5_ASSIST.enabled();
    x.grade5AssistVersion=RELEASE;
    x.ankleFallbackCount=BH.GRADE5_ASSIST.ankleFallbackCount;
    x.holdProfile='easy:1200|normal:1450|hard:1750';
    return x;
  };
}

installUI();
console.info('[BalanceHold] Grade 5 Assist v18 ready',RELEASE);
})();