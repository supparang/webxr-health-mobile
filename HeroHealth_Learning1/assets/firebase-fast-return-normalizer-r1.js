(()=>{
'use strict';
const RELEASE='20260818-FAST-RETURN-NORMALIZER-R1';
const STATE_KEY='herohealth_learning_platform_rc2';
const q=new URLSearchParams(location.search);
const authority=String(q.get('authority')||'firebase').toLowerCase();
if(authority!=='firebase'&&authority!=='dual')return;
if(q.get('firebaseReceipt')==='1')return;
if(!q.has('authorityRefresh')&&!String(q.get('returnSessionPolicy')||'').startsWith('force-firebase-rehydrate'))return;
let state={};
try{state=JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{}}catch(_){}
const ids=[...new Set(['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean))];
if(ids.length!==1)return;
const sid=ids[0];
const profileSid=String(state?.profile?.studentId||'').trim();
const authoritySid=String(state?.firebaseAuthority?.studentId||'').trim();
const source=String(state?.firebaseAuthority?.sourceOfTruth||'');
const release=String(state?.firebaseAuthority?.release||'');
if(!sid||profileSid!==sid||authoritySid!==sid||source!=='Cloud Firestore'||!/^20260818-FIREBASE-SESSION-R78(?:-|$)/.test(release))return;
q.delete('authorityRefresh');
q.delete('returnSessionPolicy');
q.set('firebaseReceipt','1');
q.set('assessmentReturn','1');
q.set('fastReturn',RELEASE);
const next=location.pathname+(q.toString()?`?${q.toString()}`:'')+location.hash;
try{history.replaceState(null,'',next)}catch(_){}
console.info('[HeroHealth Firebase] same-session return normalized to progress-only receipt verification',RELEASE,{sid});
})();
