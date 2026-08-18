(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||typeof BH.startGame!=='function')return;
if(window.HH_BALANCE_WORKER_INSTRUCTION_BUDGET_V63)return;
const s=BH.state;
const RELEASE='20260818-BALANCE-WORKER-INSTRUCTION-BUDGET-V63-R4';
const baseStart=BH.startGame;
BH.startGame=(...args)=>{
  const originalLimit=Number(s.timeLimit||60);
  // Safety ceiling only. Learner-facing active time is still controlled by the progress-aware clock.
  // 180 s prevents the legacy worker from terminating a valid six-pose run while instructions/transition time are excluded.
  const workerBudget=Math.max(originalLimit+120,180);
  s.timeLimit=workerBudget;
  let result;
  try{result=baseStart(...args)}finally{
    s.timeLimit=originalLimit;
    s.workerInstructionBudgetMs=(workerBudget-originalLimit)*1000;
  }
  return result;
};
window.HH_BALANCE_WORKER_INSTRUCTION_BUDGET_V63={release:RELEASE,active:true,extraSeconds:120,workerCeilingSeconds:180};
console.info('[BalanceHold] worker instruction budget ready',window.HH_BALANCE_WORKER_INSTRUCTION_BUDGET_V63);
})();