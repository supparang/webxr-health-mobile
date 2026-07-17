(()=>{
'use strict';
const BH=window.BH;if(!BH||typeof BH.evaluatePose!=='function')return;
const RELEASE='20260717-BALANCE-HOLD-LEG-VISIBILITY-GUARD-V21';
const inFrame=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.02&&p.x<=1.02&&p.y>=-.02&&p.y<=1.02;
const seen=(p,min)=>inFrame(p)&&(p.v??0)>=min;
const base=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=base(lm,key)||{};
  const legPose=['treeLeft','treeRight','airplaneLeft','airplaneRight'].includes(key);
  if(!legPose||!lm)return r;
  const kneesSeen=seen(lm[25],.38)&&seen(lm[26],.38);
  const targetLeft=key==='treeRight'||key==='airplaneRight';
  const targetAnkleSeen=seen(lm[targetLeft?27:28],.28);
  if(!kneesSeen){
    r.valid=false;r.signatureBlocked=true;r.legVisibilityBlocked=true;
    r.feedback='📷 ถอยห่างหรือปรับกล้องให้เห็นเข่าทั้งสองก่อน ระบบจึงจะตรวจการยกขาได้';
  }else if(!targetAnkleSeen){
    r.valid=false;r.signatureBlocked=true;r.legVisibilityBlocked=true;
    r.feedback=`📷 ให้กล้องเห็นข้อเท้า${targetLeft?'ซ้าย':'ขวา'} หรือยกเข่าให้เห็นชัดขึ้นอีกนิด`;
  }
  r.legVisibilityVersion=RELEASE;
  return r;
};
if(typeof BH.calcSummary==='function'){
  const baseCalc=BH.calcSummary;
  BH.calcSummary=reason=>{const x=baseCalc(reason)||{};x.legVisibilityGuardVersion=RELEASE;return x};
}
console.info('[BalanceHold] Leg visibility guard v21 ready',RELEASE);
})();