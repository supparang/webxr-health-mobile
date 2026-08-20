(()=>{
'use strict';
const RELEASE='20260820-PRELOGIN-ENTRY-GUARD-R1';
const q=new URLSearchParams(location.search);
const authority=String(q.get('authority')||'firebase').toLowerCase();
if(!['firebase','dual'].includes(authority))return;
const hasUrlIdentity=['studentId','sid','pid'].some(k=>String(q.get(k)||'').trim());
const handoff=q.get('firebaseReceipt')==='1'||q.has('returnedGame')||q.has('gameCompleted')||q.has('receiptToken')||q.has('authorityRefresh')||q.get('firebaseReady')==='1'||String(q.get('returnSessionPolicy')||'').startsWith('force-firebase-rehydrate');
if(hasUrlIdentity||handoff)return;

// Plain entry link must always be immediately interactive. Do not let stale
// browser identity/hydration state block a new child from typing a login code.
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
window.__HH_PRELOGIN_ENTRY_GUARD__={release:RELEASE,active:true};
document.documentElement.dataset.hhPreloginEntry='1';
document.documentElement.style.pointerEvents='auto';
function unlock(){
 const app=document.getElementById('app');
 if(app){try{app.inert=false}catch(_){} app.style.pointerEvents='auto';}
 if(document.body){document.body.style.pointerEvents='auto';document.body.style.overflow='';}
 document.documentElement.style.pointerEvents='auto';
 document.getElementById('hh-firebase-authority-lock')?.remove();
 document.querySelectorAll('[data-hh-loading-overlay="1"],.hh-loading-overlay,.firebase-loading-overlay').forEach(el=>el.remove());
}
unlock();
new MutationObserver(unlock).observe(document.documentElement,{childList:true,subtree:true});
console.info('[HeroHealth Login] pre-login entry guard ready',{release:RELEASE,mode:'plain-entry-immediate-login'});
})();
