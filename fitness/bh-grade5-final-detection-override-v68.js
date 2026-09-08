(()=>{
'use strict';
const RELEASE='20260908-BALANCE-GRADE5-FINAL-DETECTION-V68';
const BH=window.BH;
if(!BH||!BH.state||typeof BH.evaluatePose!=='function')return;
if(window.__BH_GRADE5_FINAL_DETECTION_V68__)return;
window.__BH_GRADE5_FINAL_DETECTION_V68__=true;
const s=BH.state;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const baseEvaluate=BH.evaluatePose;
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const keyOf=key=>String(s.currentKey||key||'center');

BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  const k=keyOf(key);
  if(r.instructionLocked||s.grade5InstructionLocked)return r;

  const tracked=r.tracked!==false;
  const confidence=num(r.confidence);
  const pose=num(r.pose);
  const stability=num(r.stability);

  // Grade-5 production policy:
  // Safe/control remain analytics scores. They must not independently block a
  // clearly detected pose on mobile when lower-body landmarks are partially lost.
  if(k==='center'){
    const fair=tracked&&confidence>=34&&pose>=52&&stability>=32;
    if(fair){
      r.valid=true;
      r.feedback='✅ กางแขนถูกแล้ว • ค้างไว้';
      r.grade5FairOverride='center-upper-body';
    }
  }else if(k==='left'||k==='right'){
    const fair=tracked&&confidence>=34&&pose>=54&&stability>=32;
    if(fair){
      r.valid=true;
      r.feedback='✅ ท่าถูกแล้ว • ค้างไว้';
      r.grade5FairOverride='star-reach-upper-body';
    }
  }else if(k==='treeLeft'||k==='treeRight'){
    const proofMs=num(r.treeKneeProofMs);
    const proof=!!r.treeKneeEvidence?.proof;
    const fair=tracked&&confidence>=30&&(proofMs>=180||proof);
    if(fair){
      r.valid=true;
      r.signatureBlocked=false;
      r.legVisibilityBlocked=false;
      r.legProofBlocked=false;
      r.feedback='✅ ตรวจพบท่ายกขาแล้ว • ค้างไว้';
      r.grade5FairOverride='tree-knee-proof';
    }
  }else if(k==='boss'){
    const fair=tracked&&confidence>=34&&pose>=54&&stability>=34;
    if(fair){
      r.valid=true;
      r.feedback='✅ Boss ถูกทิศแล้ว • ค้างให้นิ่ง';
      r.grade5FairOverride='boss-upper-body';
    }
  }

  r.safeControlScoringOnly=true;
  r.grade5FinalDetectionVersion=RELEASE;
  return r;
};

window.BH_GRADE5_FINAL_DETECTION_V68={release:RELEASE};
document.documentElement.dataset.bhGrade5FinalDetection='v68';
console.info('[BalanceHold] Grade-5 final detection override ready',RELEASE);
})();
