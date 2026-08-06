(()=>{
'use strict';
const RELEASE='20260806-ASSESSMENT-FIREBASE-ROUTE-R10-REFLECTION';
const STATE_KEY='herohealth_learning_platform_rc2';
const STUDY_ID='HEROHEALTH-P5-2026';
const SHEET_ROUTES={pretest:'./assessment/pretest.html?v=20260731-assessment-stable-v6',posttest:'./assessment/posttest.html?v=20260805-authority-gate-v4',reflection:'./assessment/reflection.html?v=20260731-reflection-r54'};
const FIREBASE_ROUTES={pretest:'./assessment/pretest-firebase.html?v=20260804-firebase-assessment-r2',posttest:'./assessment/posttest-firebase.html?v=20260805-firebase-posttest-r3',reflection:'./assessment/reflection-firebase.html?v=20260806-firebase-reflection-r1'};
const COMMON_ROUTES={certificate:'./assessment/certificate.html?v=20260730-active-receiver-v85'};
if(!window.HH||typeof window.HH.openRoute!=='function')return;
if(window.HHAssessmentRouteLauncher?.version===RELEASE)return;
const baseOpenRoute=window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__||window.HH.openRoute.bind(window.HH);
window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__=baseOpenRoute;
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function hash(str){let h=2166136261>>>0;const text=String(str??'');for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function stableAttempt(prefix,sid){return `${prefix}-${sid}-${hash(`${RELEASE}|${STUDY_ID}|${prefix}|${sid}`).toString(36).toUpperCase()}`}
function sessionId(sid){const key=`HH_ASSESSMENT_STUDY_SESSION_${STUDY_ID}_${sid}`;let value='';try{value=localStorage.getItem(key)||''}catch(_){}if(!value){value=`HH-STUDY-${hash(`${STUDY_ID}|${sid}`).toString(36).toUpperCase()}`;try{localStorage.setItem(key,value)}catch(_){}}return value}
window.HH.openRoute=function(id){
 const s=state(),profile=s.profile||{};
 if(!profile.studentId)return baseOpenRoute(id);
 const current=new URL(location.href),mode=String(current.searchParams.get('authority')||s?.firebaseAuthority?.mode||localStorage.getItem('HH_AUTHORITY_MODE')||'firebase').toLowerCase();
 const firebaseMode=mode==='firebase'||mode==='dual';
 const route=COMMON_ROUTES[id]||(firebaseMode?FIREBASE_ROUTES[id]:SHEET_ROUTES[id]);
 if(!route)return baseOpenRoute(id);
 const url=new URL(route,location.href),sid=String(profile.studentId).trim(),testSessionId=sessionId(sid);
 url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.set('fullName',profile.fullName||'');url.searchParams.set('section',profile.section||'');url.searchParams.set('group',profile.group||s.group||'');url.searchParams.set('studyId',STUDY_ID);url.searchParams.set('testSessionId',testSessionId);url.searchParams.set('authority',firebaseMode?'firebase':mode);
 if(s?.firebaseAuthority?.uid)url.searchParams.set('firebaseUid',s.firebaseAuthority.uid);
 const returnUrl=new URL('./index.html',location.href);returnUrl.searchParams.set('authority',firebaseMode?'firebase':mode);returnUrl.searchParams.set('studentId',sid);returnUrl.searchParams.set('sid',sid);if(firebaseMode)returnUrl.searchParams.set('firebaseReady','1');
 url.searchParams.set('return',returnUrl.href);url.searchParams.set('routeRelease',RELEASE);url.searchParams.set('_',Date.now());
 if(id==='pretest'){const attempt=stableAttempt('PRE',sid);localStorage.setItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`,attempt);localStorage.setItem(`HH_ASSESSMENT_TEST_SESSION_ACTIVE_${sid}`,testSessionId);url.searchParams.set('attemptId',attempt)}
 if(id==='posttest'){const attempt=stableAttempt('POST',sid);const preAttempt=localStorage.getItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`)||stableAttempt('PRE',sid);localStorage.setItem(`HH_ASSESSMENT_POST_ATTEMPT_${sid}`,attempt);url.searchParams.set('attemptId',attempt);url.searchParams.set('preAttemptId',preAttempt)}
 location.assign(url.href);
};
window.HHAssessmentRouteLauncher={version:RELEASE,studyId:STUDY_ID,sheetRoutes:SHEET_ROUTES,firebaseRoutes:FIREBASE_ROUTES,stableAttempt};
console.info('[HeroHealth Assessment Route] installed',RELEASE);
})();