(()=>{
'use strict';
const RELEASE='20260908-BALANCE-GRADE5-FINAL-DETECTION-V69-MOBILE-TREE';
const BH=window.BH;
if(!BH||!BH.state||typeof BH.evaluatePose!=='function')return;
if(window.__BH_GRADE5_FINAL_DETECTION_V69__)return;
window.__BH_GRADE5_FINAL_DETECTION_V69__=true;
const s=BH.state;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const baseEvaluate=BH.evaluatePose;
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const keyOf=key=>String(s.currentKey||key||'center');
const vis=p=>num(p?.v);
const dist=(a,b)=>a&&b?Math.hypot(num(a.x)-num(b.x),num(a.y)-num(b.y)):0;

function directTreeEvidence(lm,k){
  if(!Array.isArray(lm))return{ok:false};
  const liftRight=k==='treeLeft';
  const hip=lm[liftRight?24:23],knee=lm[liftRight?26:25];
  const supportHip=lm[liftRight?23:24],supportKnee=lm[liftRight?25:26];
  if(!hip||!knee||!supportHip||!supportKnee)return{ok:false};
  const visible=vis(hip)>=.18&&vis(knee)>=.18&&vis(supportHip)>=.18&&vis(supportKnee)>=.18;
  const shoulderWidth=Math.max(.07,num(s.calibration?.shoulderWidth)||dist(lm[11],lm[12])||.16);
  const bodyHeight=Math.max(.28,num(s.calibration?.bodyHeight)||.55);
  const baseline=s.calibration?.[liftRight?'kneeR':'kneeL'];
  const dxHip=Math.abs(num(knee.x)-num(hip.x))/shoulderWidth;
  const riseVsSupport=(num(supportKnee.y)-num(knee.y))/bodyHeight;
  const dxBase=baseline?Math.abs(num(knee.x)-num(baseline.x))/shoulderWidth:0;
  const riseBase=baseline?(num(baseline.y)-num(knee.y))/bodyHeight:0;
  const movedFromCalibration=baseline&&(dxBase>=.055||riseBase>=.012);
  const clearlyRaised=riseVsSupport>=.018;
  const clearlyOutward=dxHip>=.16;
  return{ok:visible&&(movedFromCalibration||clearlyRaised||clearlyOutward),visible,dxHip,riseVsSupport,dxBase,riseBase,liftSide:liftRight?'ขวา':'ซ้าย'};
}

BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  const k=keyOf(key);
  if(r.instructionLocked||s.grade5InstructionLocked)return r;

  const tracked=r.tracked!==false;
  const confidence=num(r.confidence);
  const pose=num(r.pose);
  const stability=num(r.stability);

  if(k==='center'){
    const fair=tracked&&confidence>=32&&pose>=50&&stability>=28;
    if(fair){r.valid=true;r.feedback='✅ กางแขนถูกแล้ว • ค้างไว้';r.grade5FairOverride='center-upper-body-v69'}
  }else if(k==='left'||k==='right'){
    const fair=tracked&&confidence>=32&&pose>=52&&stability>=28;
    if(fair){r.valid=true;r.feedback='✅ ท่าถูกแล้ว • ค้างไว้';r.grade5FairOverride='star-reach-upper-body-v69'}
  }else if(k==='treeLeft'||k==='treeRight'){
    const legacyProofMs=num(r.treeKneeProofMs),legacyProof=!!r.treeKneeEvidence?.proof;
    const direct=directTreeEvidence(lm,k);
    const fair=tracked&&confidence>=26&&(legacyProofMs>=140||legacyProof||direct.ok);
    if(fair){
      r.valid=true;
      r.signatureBlocked=false;r.legVisibilityBlocked=false;r.legProofBlocked=false;
      r.feedback=`✅ ตรวจพบท่ายกขา${direct.liftSide||''}แล้ว • ค้างไว้`;
      r.grade5FairOverride='tree-direct-hip-knee-v69';
    }else if(direct.visible){
      r.feedback=`🦵 ยกเข่า${direct.liftSide||''}ขึ้นเล็กน้อย หรือกางออกด้านข้าง แล้วค้างไว้`;
    }
    r.grade5DirectTreeEvidence=direct;
  }else if(k==='boss'){
    const fair=tracked&&confidence>=32&&pose>=52&&stability>=30;
    if(fair){r.valid=true;r.feedback='✅ Boss ถูกทิศแล้ว • ค้างให้นิ่ง';r.grade5FairOverride='boss-upper-body-v69'}
  }

  r.safeControlScoringOnly=true;
  r.grade5FinalDetectionVersion=RELEASE;
  return r;
};

window.BH_GRADE5_FINAL_DETECTION_V68={release:RELEASE};
window.BH_GRADE5_FINAL_DETECTION_V69={release:RELEASE,directTreeEvidence};
document.documentElement.dataset.bhGrade5FinalDetection='v69-mobile-tree';
console.info('[BalanceHold] Grade-5 final detection override ready',RELEASE);
})();
