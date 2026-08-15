(()=>{
'use strict';
const RELEASE='20260815-FIREBASE-RETURN-LIVE-REFRESH-R1';
const KEY='herohealth_learning_platform_rc2';
const q=new URLSearchParams(location.search);
const isReturn=q.get('firebaseReceipt')==='1'||q.get('gameCompleted')==='1'||!!q.get('returnedGame')||q.get('firebaseReady')==='1';
if(!isReturn)return;
let last=localStorage.getItem(KEY)||'';
let stable=0;
function sync(reason){
  const now=localStorage.getItem(KEY)||'';
  if(now!==last){last=now;stable=0;try{window.HH?.refreshFromStorage?.()}catch(e){console.warn('[HeroHealth Live Refresh] render skipped',e)}window.dispatchEvent(new CustomEvent('hh:firebase-state-updated',{detail:{reason,release:RELEASE}}));return}
  stable++;
}
[120,250,450,750,1100,1600,2300,3200,4500].forEach(ms=>setTimeout(()=>sync('return-poll-'+ms),ms));
const listener=e=>{if(e.key===KEY)sync('storage-event')};
addEventListener('storage',listener);
setTimeout(()=>removeEventListener('storage',listener),7000);
console.info('[HeroHealth Firebase Return Live Refresh] installed',RELEASE,{returnedGame:q.get('returnedGame')||'',studentId:q.get('studentId')||q.get('sid')||''});
})();