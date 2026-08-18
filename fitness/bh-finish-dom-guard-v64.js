(()=>{
'use strict';
if(window.HH_BALANCE_FINISH_DOM_GUARD_V64?.active){console.info('[BalanceHold] Finish DOM Guard V64 already active');return;}
const BH=window.BH;if(!BH||!BH.state||!BH.el||typeof BH.finish!=='function')return;
const e=BH.el,s=BH.state;
const RELEASE='20260818-BALANCE-FINISH-DOM-GUARD-V64';
function detached(tag='div'){return document.createElement(tag)}
function ensure(){
  if(!e.pauseBtn)e.pauseBtn=detached('button');
  if(!e.resultOverlay){e.resultOverlay=detached('div');e.resultOverlay.className='overlay hidden';document.body.appendChild(e.resultOverlay)}
  if(!e.startOverlay){e.startOverlay=detached('div');e.startOverlay.className='overlay hidden';document.body.appendChild(e.startOverlay)}
  return true;
}
ensure();
const baseFinish=BH.finish;
BH.finish=reason=>{
  ensure();
  try{return baseFinish(reason)}catch(error){
    console.error('[BalanceHold V64] guarded finish recovered',error);
    // Preserve strict completion state; do not fabricate a pass.
    const total=Array.isArray(s.sequence)?s.sequence.length:0;
    const rows=Array.isArray(s.results)?s.results:[];
    if(total===6&&rows.length===6&&Number(s.index||0)>=6){
      try{
        s.phase='summary';
        const summary=BH.calcSummary?.(reason||'finish-dom-recovery-v64')||null;
        if(summary){
          summary.completed=true;summary.completedPoses=6;summary.totalPoses=6;
          summary.finishDomGuardRelease=RELEASE;
          try{BH.renderSummary?.(summary)}catch(renderError){console.warn('[BalanceHold V64] render summary skipped',renderError)}
          try{Promise.resolve(BH.submitSummary?.(summary)).catch(()=>{})}catch(_){}
        }
      }catch(recoveryError){console.error('[BalanceHold V64] recovery summary failed',recoveryError)}
      return;
    }
    throw error;
  }
};
window.HH_BALANCE_FINISH_DOM_GUARD_V64={release:RELEASE,active:true,strictOnly:true};
console.info('[BalanceHold] Finish DOM Guard V64 ready',window.HH_BALANCE_FINISH_DOM_GUARD_V64);
})();