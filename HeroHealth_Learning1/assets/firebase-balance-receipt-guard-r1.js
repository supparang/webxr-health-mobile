(()=>{
'use strict';
const VERSION='20260908-FIREBASE-BALANCE-RECEIPT-GUARD-R1';
const KEY='herohealth_learning_platform_rc2';
const ALIASES=['balance','balancehold','balance-hold'];
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return{}}}
function write(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true}catch(_){return false}}
function verifiedResult(s){
 const results=s?.firebaseGameResults||s?.gameResults||{};
 for(const id of ALIASES){
  const r=results?.[id];
  if(r&&r.completed===true&&r.passed!==false&&r.progressionEligible!==false&&String(r.firebaseReceiptToken||'').trim())return r;
 }
 return null;
}
function balanceBoolean(s){return ALIASES.some(id=>s?.gameCompleted?.fitness?.[id]===true)}
function guard(reason='tick'){
 if(!window.HH_FIREBASE_MODE)return false;
 const s=read();
 if(!s?.profile?.studentId)return false;
 const proof=verifiedResult(s);
 if(proof)return false;
 if(!balanceBoolean(s)&&s?.completed?.fitness!==true)return false;
 s.gameCompleted=s.gameCompleted||{};s.gameCompleted.fitness=s.gameCompleted.fitness||{};
 for(const id of ALIASES)s.gameCompleted.fitness[id]=false;
 s.completed=s.completed||{};s.completed.fitness=false;
 if(s.completed.posttest!==true){s.rewardChampionUnlocked=false;if(s.reward)s.reward.championUnlocked=false}
 s.firebaseBalanceGuard={version:VERSION,reason,blockedAt:new Date().toISOString(),reasonCode:'BALANCE_RECEIPT_REQUIRED'};
 const ok=write(s);
 document.getElementById('hh-champion-overlay')?.remove();
 if(ok){
  window.dispatchEvent(new CustomEvent('hh:passport-rerendered',{detail:{reason:'balance-receipt-guard',at:Date.now()}}));
  console.warn('[HeroHealth Balance Receipt Guard] blocked unverified balance completion',{studentId:s.profile.studentId,reason});
 }
 return ok;
}
addEventListener('DOMContentLoaded',()=>setTimeout(()=>guard('dom-ready'),250));
addEventListener('hh:firebase-state-updated',()=>setTimeout(()=>guard('firebase-state-updated'),0));
addEventListener('storage',e=>{if(e.key===KEY)setTimeout(()=>guard('storage'),0)});
setInterval(()=>guard('interval'),900);
window.HHFirebaseBalanceReceiptGuard={version:VERSION,guard,verifiedResult};
console.info('[HeroHealth Balance Receipt Guard]',VERSION);
})();
