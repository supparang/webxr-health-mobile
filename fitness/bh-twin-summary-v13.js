(()=>{
'use strict';
const BH=window.BH;if(!BH||typeof BH.calcSummary!=='function'||typeof BH.payload!=='function')return;
const RELEASE='20260716-BALANCE-HOLD-TWIN-POSE-V13-END-TO-END';
const baseCalc=BH.calcSummary;
BH.calcSummary=function(reason){
  const x=baseCalc(reason)||{};
  x.releaseVersion=RELEASE;
  x.sequencePatternId=BH.state.sequencePatternId||'';
  x.sequencePatternLevel=BH.state.sequencePatternLevel||BH.el?.difficulty?.value||'';
  x.bossPoseCount=(x.poseSequence||[]).filter(v=>v==='boss').length;
  x.recoveryRequired=x.official!==false;
  x.canonicalPath='/webxr-health-mobile/fitness/balance-hold-ar2.html';
  return x;
};
const basePayload=BH.payload;
BH.payload=function(x){
  const p=basePayload(x)||{};
  p.releaseVersion=x.releaseVersion||RELEASE;
  p.sequencePatternId=x.sequencePatternId||'';
  p.sequencePatternLevel=x.sequencePatternLevel||'';
  p.bossPoseCount=Number(x.bossPoseCount||0);
  p.recoveryRequired=x.recoveryRequired?'yes':'no';
  p.canonicalPath=x.canonicalPath||'/webxr-health-mobile/fitness/balance-hold-ar2.html';
  return p;
};
console.info('[BalanceHold] Summary metadata v13 ready',RELEASE);
})();