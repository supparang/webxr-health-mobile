(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||typeof BH.startGame!=='function')return;
if(window.HH_BALANCE_WORKER_INSTRUCTION_BUDGET_V63)return;
const s=BH.state;
const RELEASE='20260818-BALANCE-WORKER-INSTRUCTION-BUDGET-V63';
const baseStart=BH.startGame;
BH.startGame=(...args)=>{
  const originalLimit=Number(s.timeLimit||60);
  const workerBudget=Math.max(originalLimit+45,105);
  s.timeLimit=workerBudget;
  let result;
  try{result=baseStart(...args)}finally{
    // performance-watchdog starts its Worker synchronously inside baseStart.
    // Restore the learner's real active-time limit immediately afterwards.
    s.timeLimit=originalLimit;
    s.workerInstructionBudgetMs=(workerBudget-originalLimit)*1000;
  }
  return result;
};
window.HH_BALANCE_WORKER_INSTRUCTION_BUDGET_V63={release:RELEASE,active:true,extraSeconds:45};
console.info('[BalanceHold] worker instruction budget ready',window.HH_BALANCE_WORKER_INSTRUCTION_BUDGET_V63);
})();