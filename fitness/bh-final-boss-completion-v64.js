(()=>{
'use strict';
const BH=window.BH;
if(!BH?.state||!BH?.el||typeof BH.completePose!=='function'||typeof BH.updateGameUI!=='function')return;
if(window.BH_FINAL_BOSS_COMPLETION_V64)return;
const s=BH.state,e=BH.el;
const RELEASE='20260808-BALANCE-FINAL-BOSS-COMPLETION-V64';
let completing=false;

function requiredMs(){
  const cfg=BH.CONFIG?.[e.difficulty?.value]||BH.CONFIG?.easy||BH.CONFIG?.normal||{};
  const assistFactor=1-(Number(s.assistLevel)||0)*.075;
  return Math.max(1,(Number(cfg.hold)||2600)+450)*assistFactor;
}
function eligible(ev,p){
  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  const results=Array.isArray(s.results)?s.results.length:0;
  return !completing&&String(s.phase||'')==='play'&&String(s.currentKey||'')==='boss'&&
    total===6&&Number(s.index||0)===5&&results===5&&ev?.valid===true&&
    (Number(p)>=.99||Number(s.holdMs||0)>=requiredMs()-80);
}
const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  const result=baseUpdate(ev,p);
  if(eligible(ev,p)){
    completing=true;
    const req=requiredMs();
    s.holdMs=Math.max(Number(s.holdMs)||0,req);
    try{
      BH.completePose(ev,req);
      document.documentElement.dataset.bhFinalBossCompletion='completed-v64';
    }catch(error){
      completing=false;
      console.error('[Balance V64] final boss completion failed',error);
    }
  }
  return result;
};

const baseReset=BH.resetRoundState;
if(typeof baseReset==='function')BH.resetRoundState=()=>{completing=false;return baseReset()};
window.BH_FINAL_BOSS_COMPLETION_V64={release:RELEASE,requiredMs,eligible};
document.documentElement.dataset.bhFinalBossCompletion='v64';
console.info('[BalanceHold] Final Boss Completion V64 ready',RELEASE);
})();
