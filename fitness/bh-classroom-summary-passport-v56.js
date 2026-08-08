(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el;
const RELEASE='20260808-BALANCE-SUMMARY-STRICT-COMPLETION-V56.1';
let published=false;

const textNumber=node=>Number(String(node?.textContent||'').replace(/[^0-9.]/g,''))||0;
const query=()=>new URLSearchParams(location.search);
const totalPoses=()=>Math.max(0,Number(s.sequence?.length||0));
const completedPoses=()=>Math.max(0,Number(s.results?.length||0));
const strictComplete=()=>{const total=totalPoses(),done=completedPoses();return total===6&&done>=total&&Number(s.index)>=total};
const completionReason=reason=>/^(completed|completed-|completed_|completed-direct)/i.test(String(reason||''));

function identity(){const q=query();return{studentId:q.get('studentId')||q.get('sid')||q.get('pid')||s.ctx?.studentId||'',studentName:q.get('studentName')||q.get('fullName')||q.get('name')||q.get('nick')||s.ctx?.studentName||'',section:q.get('section')||s.ctx?.section||'',group:q.get('group')||q.get('classId')||s.ctx?.classId||'',zone:q.get('zone')||'fitness',gameId:q.get('gameId')||'balance-hold'}}
function makeSummary(reason){let x={};try{x=BH.calcSummary?.(reason)||{}}catch(err){console.warn('[Balance V56.1] calcSummary fallback',err)}const total=Math.max(1,Number(x.totalPoses||totalPoses()||6));const done=Math.min(total,Math.max(0,Number(x.completedPoses??completedPoses())));const complete=done===total&&strictComplete()&&completionReason(reason);return{...x,score:Number(x.score||s.score||0),completedPoses:done,totalPoses:total,completionRate:Math.round(done/total*100),completed:complete,passed:complete&&x.passed!==false,assessmentScore:Number(x.assessmentScore||0),poseAccuracy:Number(x.poseAccuracy||textNumber(e.hudConfidence)||0),stabilityScore:Number(x.stabilityScore||textNumber(e.hudStability)||0),trackingCoverage:Number(x.trackingCoverage||textNumber(e.hudTracking)||0),reason:String(reason||''),classroomSummaryVersion:RELEASE,strictCompletionGate:true,strictCompletionEvidence:{index:Number(s.index||0),results:done,total}}}
function buildPayload(x){const id=identity();return{...x,...id,game:'balancehold',routeName:'balancehold',completed:true,procedureCompleted:true,progressionEligible:true,passed:x.passed===true,eventId:x.eventId||`HH-game-fitness-balance-hold-${id.studentId||'qa'}-${Date.now()}`,inputMode:'fullbody-pose',gameVersion:RELEASE,autoSubmit:true,completionPolicy:'strict-six-pose-progressive-v56',progressionByCompletion:true,score:Number(x.score||0),accuracy:Number(x.poseAccuracy||0)}}
function publish(x){if(published||!strictComplete()||!completionReason(x?.reason))return false;published=true;const payload=buildPayload(x);try{localStorage.setItem('HHA_BALANCE_HOLD_LAST_RESULT',JSON.stringify(payload))}catch(_){}try{localStorage.setItem(BH.KEY_LAST||'balance_hold_last',JSON.stringify(payload))}catch(_){}window.__BALANCE_HOLD_LAST_RESULT__=payload;try{parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload},location.origin)}catch(_){}try{window.dispatchEvent(new CustomEvent('herohealth:game-complete',{detail:payload}))}catch(_){}return true}
function renderIncomplete(reason){const x=makeSummary(reason);s.phase='summary';s.gameToken=Number(s.gameToken||0)+1;if(e.pauseBtn)e.pauseBtn.textContent='Ⅱ';try{localStorage.setItem(BH.KEY_LAST||'fitness_balance_hold_last',JSON.stringify(x))}catch(_){}try{BH.renderSummary?.(x)}catch(err){console.warn('[Balance V56.1] render incomplete failed',err)}try{BH.submitSummary?.(x)}catch(_){}setTimeout(()=>{if(!e.resultOverlay)return;const lead=e.resultOverlay.querySelector('.lead');if(lead)lead.textContent=reason==='timeup'?`หมดเวลาในรอบนี้ • ทำได้ ${x.completedPoses}/${x.totalPoses} ท่า ยังไม่ปลดล็อก • ลองใหม่เพื่อไปถึง Boss`:`รอบนี้ยังไม่ครบ • ทำได้ ${x.completedPoses}/${x.totalPoses} ท่า ยังไม่ปลดล็อก`;const back=e.resultOverlay.querySelector('#backBtn');if(back)back.textContent='← กลับโดยไม่ปลดล็อก';e.resultOverlay.dataset.strictComplete='0'},0);console.warn('[Balance V56.1] completion blocked',{reason,index:s.index,results:completedPoses(),total:totalPoses()})}

// Capture the legacy finish wrapper, but NEVER call it for incomplete/timeup rounds because
// the older V52 wrapper incorrectly promoted any BH.finish() reason to completed=true.
const legacyFinish=BH.finish;
BH.finish=reason=>{
  if(String(s.phase||'').toLowerCase()==='summary')return;
  const reasonText=String(reason||'');
  const completeNow=strictComplete()&&completionReason(reasonText);
  if(!completeNow){published=false;renderIncomplete(reasonText||'incomplete');return}
  if(typeof legacyFinish==='function')legacyFinish(reasonText);
  const x=makeSummary(reasonText||'completed');publish(x);
  if(e.resultOverlay)e.resultOverlay.dataset.strictComplete='1';
};

// Do not infer completion from HUD text, time, or hold percentage. Six recorded pose results are mandatory.
const timer=setInterval(()=>{if(published||String(s.phase||'').toLowerCase()!=='play')return;if(strictComplete()){const x=makeSummary('completed-state-confirmed-v56');publish(x)}},250);
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
window.BH_SUMMARY_STRICT_V56={release:RELEASE,strictComplete,totalPoses,completedPoses};
document.documentElement.dataset.bhCompletionGate='strict-six-pose-v56-1';
console.info('[BalanceHold] Strict six-pose completion gate ready',RELEASE);
})();