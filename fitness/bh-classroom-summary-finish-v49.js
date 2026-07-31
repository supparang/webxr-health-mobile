(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260731-BALANCE-SUMMARY-FINISH-V49';
let finishing=false;

function safeStatus(text,className){
  const node=$?.('sheetStatus');
  if(node){node.textContent=text;if(className)node.className=className;}
}

const baseSubmit=BH.submitSummary;
BH.submitSummary=async x=>{
  try{
    if(typeof baseSubmit==='function')return await baseSubmit(x);
  }catch(error){
    console.warn('[BalanceHold V49] summary submit fallback',error);
    try{BH.queuePayload?.(BH.payload?.(x)||x);}catch(_){}
    safeStatus('⚠️ เก็บผลไว้ในเครื่องแล้ว และจะส่งอีกครั้งเมื่อพร้อม','sheetStatus warn');
  }
};

const baseRender=BH.renderSummary;
BH.renderSummary=x=>{
  try{
    if(typeof baseRender==='function')return baseRender(x);
  }catch(error){
    console.error('[BalanceHold V49] base summary render failed',error);
  }
  if(!e.resultOverlay)return;
  e.resultOverlay.innerHTML=`<section class="modal"><div class="modalHead"><div class="modalIcon">🏆</div><div><h2>ภารกิจสำเร็จ</h2><p class="lead">ทำครบ ${Number(x?.completedPoses||0)}/${Number(x?.totalPoses||6)} ท่า</p></div></div><div class="resultCard bigScore"><div><div class="scoreNum">${Number(x?.score||0)}</div><b>Assessment ${Number(x?.assessmentScore||0)}/100</b></div></div><div class="sheetStatus" id="sheetStatus">📤 กำลังบันทึกผล...</div><div class="actions"><button class="btn blue" id="backBtn">🏠 กลับ Passport</button></div></section>`;
  e.resultOverlay.classList.remove('hidden');
  const back=$?.('backBtn');
  if(back)back.onclick=()=>BH.plannerReturn?.(x);
};

BH.finish=reason=>{
  if(finishing||s.phase==='summary')return;
  finishing=true;
  s.phase='summary';
  s.gameToken=(Number(s.gameToken)||0)+1;
  if(e.pauseBtn)e.pauseBtn.textContent='Ⅱ';
  let summary;
  try{summary=BH.calcSummary?.(reason)||{};}catch(error){
    console.error('[BalanceHold V49] calc summary failed',error);
    summary={reason,score:Number(s.score||0),assessmentScore:0,completedPoses:Array.isArray(s.results)?s.results.length:0,totalPoses:Array.isArray(s.sequence)?s.sequence.length:6,poseResults:Array.isArray(s.results)?s.results:[],studentId:s.ctx?.studentId||'',studentName:s.ctx?.studentName||''};
  }
  try{
    localStorage.setItem(BH.KEY_LAST,JSON.stringify(summary));
    if(summary.isNewBest)localStorage.setItem(BH.KEY_BEST,String(summary.score||0));
  }catch(_){}
  try{BH.renderSummary(summary);}catch(error){console.error('[BalanceHold V49] render summary failed',error);}
  Promise.resolve().then(()=>BH.submitSummary?.(summary)).catch(error=>console.warn('[BalanceHold V49] submit failed',error));
  setTimeout(()=>{try{BH.stopPoseLoop?.();BH.stopCamera?.();}catch(_){}},250);
};

console.info('[BalanceHold] Summary finish guard ready',RELEASE);
})();