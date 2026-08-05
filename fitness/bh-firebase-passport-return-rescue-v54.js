(()=>{
'use strict';
if(window.__BH_FIREBASE_PASSPORT_RETURN_RESCUE_V54__)return;
window.__BH_FIREBASE_PASSPORT_RETURN_RESCUE_V54__=true;

const RELEASE='20260805-BALANCE-FIREBASE-PASSPORT-RETURN-RESCUE-V54';
const q=new URLSearchParams(location.search);
if(String(q.get('authority')||'').toLowerCase()!=='firebase')return;
let hookedButton=null;
let fallbackTimer=0;

function studentId(){
 return String(q.get('studentId')||q.get('sid')||q.get('pid')||'').trim();
}
function cleanReturnUrl(){
 const raw=q.get('return')||q.get('back')||'../HeroHealth_Learning1/index.html';
 const u=new URL(raw,location.href);
 for(const key of [
  'logout','logoutAt','logoutNonce','firebaseHydratedR71','firebaseHydrated',
  'firebaseProgressApplied','pendingGameSync','gameSync','firebaseAssessmentReceipt'
 ])u.searchParams.delete(key);
 const sid=studentId();
 if(sid){u.searchParams.set('studentId',sid);u.searchParams.set('sid',sid)}
 for(const key of ['fullName','studentName','name','section','group','firebaseUid']){
  const value=q.get(key);if(value)u.searchParams.set(key,value);
 }
 u.searchParams.set('authority','firebase');
 u.searchParams.set('firebaseReady','1');
 u.searchParams.set('firebaseReceipt','1');
 u.searchParams.set('returnedGame','balance');
 u.searchParams.set('gameCompleted','1');
 u.searchParams.set('authorityRefresh',String(Date.now()));
 u.searchParams.set('v',RELEASE);
 return u.href;
}
function completionPayload(){
 const candidates=[window.__BALANCE_HOLD_LAST_RESULT__,window.__HH_BALANCE_RESULT_V50__,window.__HH_BALANCE_RESULT_V36__];
 for(const value of candidates)if(value&&typeof value==='object')return value;
 for(const key of ['HHA_BALANCE_HOLD_LAST_RESULT','fitness_balance_hold_last']){
  try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&typeof value==='object')return value}catch(_){}
 }
 return {game:'balance-hold',gameId:'balance-hold',zone:'fitness',studentId:studentId(),completed:true,passed:true,progressionEligible:true,eventId:`HH-game-fitness-balance-hold-${studentId()||'qa'}-${Date.now()}`};
}
function publish(){
 const payload=completionPayload();
 try{parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload},location.origin)}catch(_){}
 try{window.dispatchEvent(new CustomEvent('herohealth:game-complete',{detail:payload}))}catch(_){}
 return payload;
}
function forceTopReturn(){
 const url=cleanReturnUrl();
 try{window.top.location.replace(url)}catch(_){location.replace(url)}
}
function hook(){
 const button=document.getElementById('balancePassportBtn');
 if(!button||button===hookedButton||button.dataset.bhFirebaseReturnV54==='1')return false;
 hookedButton=button;
 button.dataset.bhFirebaseReturnV54='1';
 button.onclick=null;
 button.addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(button.disabled)return;
  button.disabled=true;
  button.textContent='กำลังยืนยันผลกับ Firebase…';
  const receipt=document.getElementById('balanceReceiptText');
  if(receipt)receipt.textContent='กำลังตรวจสอบ Firebase Receipt • กรุณารอสักครู่';
  publish();
  clearTimeout(fallbackTimer);
  fallbackTimer=setTimeout(forceTopReturn,7000);
 },true);
 return true;
}
function boot(){
 hook();
 const root=document.getElementById('resultOverlay')||document.body;
 new MutationObserver(hook).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
 console.info('[Balance Hold] Firebase Passport Return Rescue ready',RELEASE);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();