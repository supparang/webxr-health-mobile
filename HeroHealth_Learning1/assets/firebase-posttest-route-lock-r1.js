(()=>{
'use strict';
if(window.__HH_FIREBASE_POSTTEST_ROUTE_LOCK_R1__)return;
window.__HH_FIREBASE_POSTTEST_ROUTE_LOCK_R1__=true;
const RELEASE='20260805-FIREBASE-POSTTEST-ROUTE-LOCK-R1';
const KEY='herohealth_learning_platform_rc2';
const STUDY_ID='HEROHEALTH-P5-2026';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}}
function firebaseMode(){const q=new URLSearchParams(location.search);const s=read();return ['firebase','dual'].includes(String(q.get('authority')||s?.firebaseAuthority?.mode||localStorage.getItem('HH_AUTHORITY_MODE')||'').toLowerCase())}
function hash(str){let h=2166136261>>>0;for(const ch of String(str||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function attempt(prefix,sid){return `${prefix}-${sid}-${hash(`${STUDY_ID}|${prefix}|${sid}`).toString(36).toUpperCase()}`}
function openFirebasePosttest(){
 const s=read(),p=s.profile||{},sid=String(p.studentId||new URLSearchParams(location.search).get('studentId')||'').trim();
 if(!sid)return false;
 const u=new URL('./assessment/posttest-firebase.html',location.href);
 const postAttempt=localStorage.getItem(`HH_ASSESSMENT_POST_ATTEMPT_${sid}`)||attempt('POST',sid);
 const preAttempt=localStorage.getItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`)||attempt('PRE',sid);
 const back=new URL('./index.html',location.href);
 back.searchParams.set('authority','firebase');back.searchParams.set('studentId',sid);back.searchParams.set('sid',sid);back.searchParams.set('firebaseReady','1');
 [['authority','firebase'],['studentId',sid],['sid',sid],['fullName',p.fullName||''],['section',p.section||''],['group',p.group||s.group||''],['studyId',STUDY_ID],['attemptId',postAttempt],['preAttemptId',preAttempt],['return',back.href],['routeRelease',RELEASE],['_',Date.now()]].forEach(([k,v])=>u.searchParams.set(k,String(v)));
 if(s?.firebaseAuthority?.uid)u.searchParams.set('firebaseUid',s.firebaseAuthority.uid);
 location.assign(u.href);return true;
}
function install(){
 if(!firebaseMode()||!window.HH||typeof window.HH.openRoute!=='function')return false;
 if(window.HH.openRoute.__hhFirebasePosttestLockR1)return true;
 const original=window.HH.openRoute.bind(window.HH);
 const patched=function(id){if(id==='posttest'&&firebaseMode())return openFirebasePosttest();return original(id)};
 patched.__hhFirebasePosttestLockR1=true;patched.__hhFirebasePosttestLockRelease=RELEASE;
 window.HH.openRoute=patched;
 return true;
}
function reinforce(){install();[100,350,900,1800,3200].forEach(ms=>setTimeout(install,ms))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',reinforce,{once:true});else reinforce();
window.HHFirebasePosttestRouteLock={release:RELEASE,install,openFirebasePosttest};
console.info('[HeroHealth] Firebase Post-test Route Lock ready',RELEASE);
})();
