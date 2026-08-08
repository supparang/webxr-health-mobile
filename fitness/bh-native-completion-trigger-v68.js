(()=>{
'use strict';
const BH=window.BH;
if(!BH?.state||!BH?.el||typeof BH.completePose!=='function'||typeof BH.updateGameUI!=='function')return;
if(window.BH_NATIVE_COMPLETION_TRIGGER_V68)return;
const s=BH.state,e=BH.el,C=BH.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const RELEASE='20260808-BALANCE-NATIVE-COMPLETION-TRIGGER-V68';
let triggeredIndex=-1;

function cfg(){return BH.CONFIG?.[e.difficulty?.value]||BH.CONFIG?.easy||BH.CONFIG?.normal||{}}
function requiredMs(){
  const c=cfg();
  const assist=1-(Number(s.assistLevel)||0)*.075;
  return Math.max(1,((Number(c.hold)||1600)+(String(s.currentKey||'')==='boss'?450:0))*assist);
}
function inferenceIntervalMs(){
  const declared=Number(window.BH_SMOKE_PERFORMANCE_V59?.inferenceIntervalMs||window.BH_SMOKE_PERFORMANCE_V63?.inferenceIntervalMs||0);
  if(declared>0)return declared;
  const q=new URLSearchParams(location.search);
  return /^(1|true|yes)$/i.test(String(q.get('smoke')||''))?200:84;
}
function cutoff(req=requiredMs()){
  const frame=inferenceIntervalMs();
  const tolerance=Math.min(190,Math.max(70,frame*.8));
  return C(1-tolerance/Math.max(1,req),.93,.985);
}

const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  const result=baseUpdate(ev,p);
  if(String(s.phase||'')!=='play'||ev?.valid!==true)return result;
  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  const done=Array.isArray(s.results)?s.results.length:0;
  const index=Number(s.index||0);
  if(total!==6||done!==index||index>=total)return result;
  const req=requiredMs(),threshold=cutoff(req);
  const nearComplete=Number(p)>=threshold||Number(s.holdMs||0)>=req-(1-threshold)*req;
  if(nearComplete&&triggeredIndex!==index){
    triggeredIndex=index;
    s.holdMs=Math.max(Number(s.holdMs)||0,req);
    try{
      // Native BH.completePose remains the only authority for result push, index advance,
      // pose transition and final BH.finish('completed').
      BH.completePose(ev,req);
      document.documentElement.dataset.bhNativeCompletion=`pose-${Math.min(index+1,total)}-committed`;
    }catch(error){
      triggeredIndex=-1;
      console.error('[Balance V68] native completion trigger failed',error);
    }
  }
  return result;
};

const baseSetPoseUI=BH.setPoseUI;
if(typeof baseSetPoseUI==='function')BH.setPoseUI=()=>{triggeredIndex=-1;return baseSetPoseUI()};
const baseReset=BH.resetRoundState;
if(typeof baseReset==='function')BH.resetRoundState=()=>{triggeredIndex=-1;return baseReset()};

window.BH_NATIVE_COMPLETION_TRIGGER_V68={release:RELEASE,requiredMs,inferenceIntervalMs,cutoff};
document.documentElement.dataset.bhNativeCompletion='v68-native-authority';
console.info('[BalanceHold] Native Completion Trigger V68 ready',window.BH_NATIVE_COMPLETION_TRIGGER_V68);
})();