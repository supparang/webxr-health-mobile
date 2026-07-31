(()=>{
'use strict';
const RELEASE='20260731-ASSESSMENT-STUDENT-STABLE-V6';
const STATE_KEY='herohealth_learning_platform_rc2';
const STUDY_ID='HEROHEALTH-P5-2026';
const LOCAL_ROUTES={
 pretest:'./assessment/pretest.html?v=20260731-assessment-stable-v6',
 posttest:'./assessment/posttest.html?v=20260731-assessment-stable-v6',
 reflection:'./assessment/reflection.html?v=20260730-active-receiver-v85',
 certificate:'./assessment/certificate.html?v=20260730-active-receiver-v85'
};
const original=window.HH?.openRoute;
if(!window.HH||typeof original!=='function')return;
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function hash(str){let h=2166136261>>>0;const text=String(str??'');for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function stableAttempt(prefix,sid){return `${prefix}-${sid}-${hash(`${RELEASE}|${STUDY_ID}|${prefix}|${sid}`).toString(36).toUpperCase()}`}
function sessionId(sid){const key=`HH_ASSESSMENT_STUDY_SESSION_${STUDY_ID}_${sid}`;let value='';try{value=localStorage.getItem(key)||''}catch(_){}if(!value){value=`HH-STUDY-${hash(`${STUDY_ID}|${sid}`).toString(36).toUpperCase()}`;try{localStorage.setItem(key,value)}catch(_){}}return value}
window.HH.openRoute=function(id){
 const s=state(),profile=s.profile||{};
 if(!profile.studentId)return original.call(window.HH,id);
 const route=LOCAL_ROUTES[id];
 if(!route)return original.call(window.HH,id);
 const url=new URL(route,location.href),sid=String(profile.studentId).trim(),testSessionId=sessionId(sid);
 url.searchParams.set('studentId',sid);
 url.searchParams.set('sid',sid);
 url.searchParams.set('fullName',profile.fullName||'');
 url.searchParams.set('section',profile.section||'');
 url.searchParams.set('group',profile.group||s.group||'');
 url.searchParams.set('studyId',STUDY_ID);
 url.searchParams.set('testSessionId',testSessionId);
 url.searchParams.set('return',new URL('./index.html?v=20260731-assessment-stable-v6',location.href).href);
 url.searchParams.set('routeRelease',RELEASE);
 url.searchParams.set('_',Date.now());
 if(id==='pretest'){
   const attempt=stableAttempt('PRE',sid);
   localStorage.setItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`,attempt);
   localStorage.setItem(`HH_ASSESSMENT_TEST_SESSION_ACTIVE_${sid}`,testSessionId);
   url.searchParams.set('attemptId',attempt);
 }
 if(id==='posttest'){
   const attempt=stableAttempt('POST',sid);
   const preAttempt=localStorage.getItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`)||stableAttempt('PRE',sid);
   localStorage.setItem(`HH_ASSESSMENT_POST_ATTEMPT_${sid}`,attempt);
   url.searchParams.set('attemptId',attempt);
   url.searchParams.set('preAttemptId',preAttempt);
 }
 location.assign(url.href);
};
window.HHAssessmentRouteLauncher={version:RELEASE,studyId:STUDY_ID,localRoutes:LOCAL_ROUTES,stableAttempt};
})();