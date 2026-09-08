(()=>{
'use strict';
const RELEASE='20260908-FIREBASE-ROUTE-READINESS-NORMALIZER-R26';
const STATE_KEY='herohealth_learning_platform_rc2';
if(!window.HH||typeof window.HH.openRoute!=='function')return;
if(window.__HH_FIREBASE_ROUTE_READY_R26__)return;
window.__HH_FIREBASE_ROUTE_READY_R26__=true;

const wrappedOpenRoute=window.HH.openRoute.bind(window.HH);

function readState(){
  try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}
}
function writeState(s){
  try{localStorage.setItem(STATE_KEY,JSON.stringify(s));return true}catch(_){return false}
}
function currentAuthority(){
  try{return String(new URLSearchParams(location.search).get('authority')||window.HH_AUTHORITY_MODE||'firebase').toLowerCase()}catch(_){return String(window.HH_AUTHORITY_MODE||'firebase').toLowerCase()}
}
function urlIdentityMatches(sid){
  try{
    const q=new URLSearchParams(location.search);
    const ids=['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean);
    return ids.length===0||ids.every(id=>id===sid);
  }catch(_){return true}
}
function normalizeFirebaseAuthority(){
  if(currentAuthority()!=='firebase'&&currentAuthority()!=='dual')return false;
  const s=readState();
  const sid=String(s?.profile?.studentId||'').trim();
  if(!sid||!urlIdentityMatches(sid))return false;

  // Route navigation must not be blocked by stale client-only readiness metadata.
  // Firestore authentication/binding and Security Rules remain authoritative for writes.
  const a=(s.firebaseAuthority&&typeof s.firebaseAuthority==='object')?s.firebaseAuthority:{};
  const sameAuthority=!a.studentId||String(a.studentId).trim()===sid;
  if(!sameAuthority)return false;

  s.firebaseAuthority={
    ...a,
    studentId:sid,
    mode:'firebase',
    sourceOfTruth:'Cloud Firestore',
    hydratedAt:a.hydratedAt||new Date().toISOString(),
    release:a.release||RELEASE
  };
  if(s.firebaseResearchFlow&&typeof s.firebaseResearchFlow==='object'){
    s.firebaseResearchFlow={...s.firebaseResearchFlow,studentId:sid,sourceOfTruth:s.firebaseResearchFlow.sourceOfTruth||'Cloud Firestore'};
  }
  writeState(s);
  try{
    window.__HH_FIREBASE_LOGIN_REQUIRED__=false;
    document.documentElement.dataset.hhFirebaseSession='authenticated';
    document.documentElement.dataset.hhFirebaseRouteNormalizer=RELEASE;
  }catch(_){}
  return true;
}

window.HH.openRoute=function(id){
  const normalized=normalizeFirebaseAuthority();
  if(normalized)console.info('[HeroHealth Firebase Route R26] readiness normalized before route',id);
  return wrappedOpenRoute(id);
};

// Normalize once after initial Passport render/hydration as well.
setTimeout(normalizeFirebaseAuthority,0);
setTimeout(normalizeFirebaseAuthority,400);
setTimeout(normalizeFirebaseAuthority,1200);
window.addEventListener('hh:firebase-state-updated',normalizeFirebaseAuthority);

window.HHFirebaseRouteReadinessNormalizer={version:RELEASE,normalizeFirebaseAuthority};
console.info('[HeroHealth Firebase Route] non-blocking client readiness normalizer installed',RELEASE);
})();
