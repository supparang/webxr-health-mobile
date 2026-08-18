(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state)return;
const RELEASE='20260818-BALANCE-SUMMARY-UI-CANONICAL-V57';
const s=BH.state;
function strictSix(){
  try{
    const total=Array.isArray(s.sequence)?s.sequence.length:0;
    const done=Array.isArray(s.results)?s.results.length:0;
    return total===6&&done>=6&&Number(s.index||0)>=6;
  }catch(_){return false}
}
function canonicalize(summary){
  const x=summary&&typeof summary==='object'?{...summary}:{};
  if(strictSix()){
    x.completedPoses=6;
    x.totalPoses=6;
    x.completionCount=6;
    x.completionRate=100;
    x.completed=true;
    x.procedureCompleted=true;
    x.progressionEligible=true;
    x.passed=x.passed!==false;
    x.strictCompletionEvidence={...(x.strictCompletionEvidence||{}),index:Number(s.index||6),results:6,total:6};
  }
  x.summaryUiCanonicalVersion=RELEASE;
  return x;
}
const baseRender=BH.renderSummary;
if(typeof baseRender==='function'){
  BH.renderSummary=function(summary){
    const out=baseRender.call(this,canonicalize(summary));
    setTimeout(polish,0);
    return out;
  };
}
const baseCalc=BH.calcSummary;
if(typeof baseCalc==='function'){
  BH.calcSummary=function(...args){return canonicalize(baseCalc.apply(this,args)||{})};
}
function polish(){
  const overlay=document.getElementById('resultOverlay');
  if(!overlay)return;
  if(strictSix()){
    for(const node of overlay.querySelectorAll('*')){
      if(node.children.length)continue;
      const t=String(node.textContent||'');
      if(t.includes('5/6'))node.textContent=t.replace(/5\/6/g,'6/6');
      if(t.trim()==='จบรอบแล้ว')node.textContent='ทำภารกิจครบแล้ว';
    }
  }
  for(const node of overlay.querySelectorAll('*')){
    if(node.children.length)continue;
    const t=String(node.textContent||'');
    if(t.includes('Passport และ Google Sheet'))node.textContent=t.replace('Passport และ Google Sheet','Passport และ Firebase');
    if(t.includes('Google Sheet'))node.textContent=t.replace(/Google Sheet/g,'Firebase');
  }
}
const observer=new MutationObserver(polish);
const overlay=document.getElementById('resultOverlay');
if(overlay)observer.observe(overlay,{subtree:true,childList:true,characterData:true});
addEventListener('pagehide',()=>observer.disconnect(),{once:true});
window.BH_SUMMARY_UI_CANONICAL_V57={release:RELEASE,strictSix,canonicalize};
console.info('[BalanceHold] canonical summary UI ready',RELEASE);
})();