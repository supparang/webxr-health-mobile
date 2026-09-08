(()=>{
'use strict';
const RELEASE='20260908-BALANCE-ROUND-COMPLETE-MISSION-PASS-V70';
const q=new URLSearchParams(location.search);
if(String(q.get('authority')||'').toLowerCase()!=='firebase')return;
if(window.__BH_FIREBASE_DIRECT_RECEIPT_V70__)return;
window.__BH_FIREBASE_DIRECT_RECEIPT_V70__=true;
const BH=window.BH;
if(!BH||!BH.state)return;
const s=BH.state;
let sent=false;
let eventId='';
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const clamp=v=>Math.max(0,Math.min(100,Math.round(finite(v)*10)/10));
function roundFinished(){
 const total=Array.isArray(s.sequence)?s.sequence.length:0;
 if(total!==6)return false;
 const phase=String(s.phase||'').toLowerCase();
 const overlay=BH.el?.resultOverlay||document.getElementById('resultOverlay');
 const summaryVisible=!!(overlay&&!overlay.classList.contains('hidden')&&String(overlay.textContent||'').trim());
 return phase==='summary'||summaryVisible;
}
function avg(rows,key,fallback=0){return rows.length?rows.reduce((sum,row)=>sum+finite(row?.[key]),0)/rows.length:fallback}
function sid(){return String(q.get('studentId')||q.get('sid')||q.get('pid')||s.ctx?.studentId||'').trim()}
function payload(){
 const allRows=Array.isArray(s.results)?s.results:[];
 const totalPoses=Array.isArray(s.sequence)&&s.sequence.length?s.sequence.length:6;
 const rows=allRows.slice(0,totalPoses);
 const completedPoses=Math.min(rows.length,totalPoses);
 const poseCriteriaMet=completedPoses>=totalPoses&&!rows.slice(0,totalPoses).some(r=>r?.passed===false);
 const studentId=sid();
 const poseAccuracy=clamp(avg(rows,'poseAccuracy',s.poseScore));
 const stabilityScore=clamp(avg(rows,'stability',s.stabilityScore));
 const transitionScore=clamp(avg(rows,'transitionControl',s.controlScore));
 const safeZoneScore=clamp(avg(rows,'safeZone',s.safeScore));
 const trackingCoverage=clamp(avg(rows,'confidence',s.confidence));
 const score=clamp(avg(rows,'quality',(poseAccuracy+stabilityScore+transitionScore+safeZoneScore)/4));
 if(!eventId)eventId=String(s.roundId||s.attemptId||`HH-game-fitness-balance-${studentId||'anon'}-${Date.now()}`);
 return {
  studentId,game:'balance-hold',gameId:'balance-hold',zone:'fitness',
  completed:true,procedureCompleted:true,roundCompleted:true,missionPassed:true,
  progressionEligible:true,passed:true,
  skillCriteriaMet:poseCriteriaMet,poseCriteriaMet,
  completedPoses,totalPoses,poseResults:rows,
  score,assessmentScore:score,poseAccuracy,accuracy:poseAccuracy,
  stabilityScore,transitionScore,safeZoneScore,trackingCoverage,
  bossPosePassed:poseCriteriaMet&&completedPoses>=totalPoses,
  eventId,finishedAt:new Date().toISOString(),inputMode:'classroom-pose',autoSubmit:true,
  completionPolicy:'round-complete-passes-mission-pose-count-preserved-v70',
  completionEvidence:{valid:true,roundFinished:true,total:totalPoses,results:completedPoses,index:Number(s.index||0),phase:String(s.phase||''),poseCriteriaMet},
  firebaseDirectReceiptRelease:RELEASE
 };
}
function publish(reason='watch'){
 if(sent||!roundFinished())return false;
 sent=true;
 const p=payload();
 try{localStorage.setItem('HHA_BALANCE_HOLD_LAST_RESULT',JSON.stringify(p))}catch(_){}
 try{window.__BALANCE_HOLD_LAST_RESULT__=p}catch(_){}
 try{window.parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:p,source:RELEASE,reason},location.origin)}catch(_){}
 try{if(window.top&&window.top!==window)window.top.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:p,source:RELEASE,reason},location.origin)}catch(_){}
 try{window.dispatchEvent(new CustomEvent('herohealth:game-complete',{detail:p}))}catch(_){}
 const receipt=document.getElementById('balanceReceiptText')||document.getElementById('bhResultSync')||document.getElementById('bhFinalSync');
 if(receipt)receipt.textContent=`กำลังบันทึกผลลง Firebase… (${p.completedPoses}/${p.totalPoses} ท่า)`;
 console.info('[BalanceHold] completed round published as mission pass',RELEASE,{studentId:p.studentId,eventId:p.eventId,completedPoses:p.completedPoses,totalPoses:p.totalPoses,poseCriteriaMet:p.poseCriteriaMet});
 return true;
}
const timer=setInterval(()=>publish('round-complete-watch'),180);
const observer=new MutationObserver(()=>publish('summary-dom'));
const overlay=document.getElementById('resultOverlay');
if(overlay)observer.observe(overlay,{subtree:true,childList:true,characterData:true,attributes:true});
addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect()},{once:true});
window.BH_FIREBASE_DIRECT_RECEIPT_V70={release:RELEASE,publish,roundFinished};
console.info('[BalanceHold] Firebase round-complete receipt bridge ready',RELEASE);
})();
