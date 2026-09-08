(()=>{
'use strict';
const RELEASE='20260908-BALANCE-FIREBASE-DIRECT-RECEIPT-V66';
const q=new URLSearchParams(location.search);
if(String(q.get('authority')||'').toLowerCase()!=='firebase')return;
if(window.__BH_FIREBASE_DIRECT_RECEIPT_V66__)return;
window.__BH_FIREBASE_DIRECT_RECEIPT_V66__=true;
const BH=window.BH;
if(!BH||!BH.state)return;
const s=BH.state;
let sent=false;
let eventId='';
const finite=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const clamp=v=>Math.max(0,Math.min(100,Math.round(finite(v)*10)/10));
function strictSix(){
 const total=Array.isArray(s.sequence)?s.sequence.length:0;
 const rows=Array.isArray(s.results)?s.results:[];
 return total===6&&rows.length>=6&&Number(s.index||0)>=6&&!rows.slice(0,6).some(r=>r?.passed===false);
}
function avg(rows,key,fallback=0){return rows.length?rows.reduce((sum,row)=>sum+finite(row?.[key]),0)/rows.length:fallback}
function sid(){return String(q.get('studentId')||q.get('sid')||q.get('pid')||s.ctx?.studentId||'').trim()}
function payload(){
 const rows=(Array.isArray(s.results)?s.results:[]).slice(0,6);
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
  completed:true,procedureCompleted:true,progressionEligible:true,passed:true,skillCriteriaMet:true,
  completedPoses:6,totalPoses:6,poseResults:rows,
  score,assessmentScore:score,poseAccuracy,accuracy:poseAccuracy,
  stabilityScore,transitionScore,safeZoneScore,trackingCoverage,bossPosePassed:true,
  eventId,finishedAt:new Date().toISOString(),inputMode:'classroom-pose',autoSubmit:true,
  completionPolicy:'strict-six-pose-firebase-direct-v66',
  strictCompletionEvidence:{valid:true,total:6,results:6,index:Number(s.index||6),phase:String(s.phase||'')},
  firebaseDirectReceiptRelease:RELEASE
 };
}
function publish(reason='watch'){
 if(sent||!strictSix())return false;
 sent=true;
 const p=payload();
 try{localStorage.setItem('HHA_BALANCE_HOLD_LAST_RESULT',JSON.stringify(p))}catch(_){}
 try{window.__BALANCE_HOLD_LAST_RESULT__=p}catch(_){}
 try{window.parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:p,source:RELEASE,reason},location.origin)}catch(_){}
 try{if(window.top&&window.top!==window)window.top.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:p,source:RELEASE,reason},location.origin)}catch(_){}
 try{window.dispatchEvent(new CustomEvent('herohealth:game-complete',{detail:p}))}catch(_){}
 const receipt=document.getElementById('balanceReceiptText')||document.getElementById('bhResultSync')||document.getElementById('bhFinalSync');
 if(receipt)receipt.textContent='กำลังบันทึกผลลง Firebase…';
 console.info('[BalanceHold] direct Firebase completion published',RELEASE,{studentId:p.studentId,eventId:p.eventId});
 return true;
}
const timer=setInterval(()=>publish('strict-six-watch'),180);
const observer=new MutationObserver(()=>publish('summary-dom'));
const overlay=document.getElementById('resultOverlay');
if(overlay)observer.observe(overlay,{subtree:true,childList:true,characterData:true,attributes:true});
addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect()},{once:true});
window.BH_FIREBASE_DIRECT_RECEIPT_V66={release:RELEASE,publish,strictSix};
console.info('[BalanceHold] Firebase direct receipt bridge ready',RELEASE);
})();
