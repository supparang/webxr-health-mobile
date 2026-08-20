(()=>{
'use strict';
const RELEASE='20260820-PRELOGIN-ENTRY-GUARD-R2-ONE-SHOT';
const q=new URLSearchParams(location.search);
const authority=String(q.get('authority')||'firebase').toLowerCase();
if(!['firebase','dual'].includes(authority))return;
const hasUrlIdentity=['studentId','sid','pid'].some(k=>String(q.get(k)||'').trim());
const handoff=q.get('firebaseReceipt')==='1'||q.has('returnedGame')||q.has('gameCompleted')||q.has('receiptToken')||q.has('authorityRefresh')||q.get('firebaseReady')==='1'||String(q.get('returnSessionPolicy')||'').startsWith('force-firebase-rehydrate');
if(hasUrlIdentity||handoff)return;

// Plain entry link must be immediately interactive and must not hydrate a stale
// student session before the learner submits a new numeric code.
const transientKeys=[
 'herohealth_active_student_id','HH_FIREBASE_LAST_STUDENT_ID','HH_FIREBASE_BOUND_STUDENT_ID',
 'HH_ACTIVE_STUDENT_ID','HH_CURRENT_STUDENT_ID','herohealth_last_student_id','studentId','pid',
 'HH_FIREBASE_RECENT_LOGIN_COMMIT_R74'
];
for(const key of transientKeys){
 try{localStorage.removeItem(key)}catch(_){}
 try{sessionStorage.removeItem(key)}catch(_){}
}
window.__HH_FIREBASE_LOGIN_REQUIRED__=true;
window.__HH_PRELOGIN_ENTRY_GUARD__={release:RELEASE,active:true,mode:'one-shot'};
document.documentElement.dataset.hhPreloginEntry='1';
document.documentElement.style.pointerEvents='auto';

function unlockOnce(){
 const app=document.getElementById('app');
 if(app){try{app.inert=false}catch(_){} app.style.pointerEvents='auto';}
 if(document.body){document.body.style.pointerEvents='auto';document.body.style.overflow='';}
 document.documentElement.style.pointerEvents='auto';
 document.getElementById('hh-firebase-authority-lock')?.remove();
}

// One-shot only. Do NOT observe the whole DOM: Firebase/App rendering mutates the
// subtree frequently and a global MutationObserver can starve Chrome's main thread.
unlockOnce();
if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',unlockOnce,{once:true});
}
requestAnimationFrame(()=>requestAnimationFrame(unlockOnce));
setTimeout(unlockOnce,250);
setTimeout(unlockOnce,1000);
console.info('[HeroHealth Login] pre-login entry guard ready',{release:RELEASE,mode:'plain-entry-immediate-login-one-shot'});
})();
