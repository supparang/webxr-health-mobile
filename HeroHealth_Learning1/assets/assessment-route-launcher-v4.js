(()=>{
'use strict';
const RELEASE='20260729-ASSESSMENT-LOCAL-ROUTE-V6';
const STATE_KEY='herohealth_learning_platform_rc2';
const STUDY_ID='HEROHEALTH-P5-2026';
const LOCAL_ROUTES={
 pretest:'./assessment/pretest.html?v=20260729-public-assessment-v81',
 posttest:'./assessment/posttest.html?v=20260729-public-assessment-v81',
 reflection:'./assessment/reflection.html?v=20260729-public-assessment-v81',
 certificate:'./assessment/certificate.html?v=20260729-public-assessment-v81'
};
const original=window.HH?.openRoute;
if(!window.HH||typeof original!=='function')return;
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function token(prefix,sid){const random=globalThis.crypto?.getRandomValues?Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2))).map(v=>v.toString(36)).join(''):Math.random().toString(36).slice(2);return `${prefix}-${sid}-${Date.now()}-${random}`}
function sessionId(sid){const day=new Date().toISOString().slice(0,10).replaceAll('-',''),key=`HH_ASSESSMENT_TEST_SESSION_${sid}_${day}`;let value='';try{value=sessionStorage.getItem(key)||''}catch(_){}if(!value){value=`HH-TEST-${day}-${sid}-${Date.now()}`;try{sessionStorage.setItem(key,value)}catch(_){}}return value}
window.HH.openRoute=function(id){
 const s=state(),profile=s.profile||{};
 if(!profile.studentId)return original.call(window.HH,id);
 const route=LOCAL_ROUTES[id];
 if(!route)return original.call(window.HH,id);
 const url=new URL(route,location.href),sid=String(profile.studentId).trim(),testSessionId=sessionId(sid);
 url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.set('fullName',profile.fullName||'');url.searchParams.set('section',profile.section||'');url.searchParams.set('group',profile.group||s.group||'');url.searchParams.set('studyId',STUDY_ID);url.searchParams.set('testSessionId',testSessionId);url.searchParams.set('return',new URL('./index.html?v=20260729-public-assessment-v81',location.href).href);url.searchParams.set('routeRelease',RELEASE);
 if(id==='pretest'){const attempt=token('PRE',sid);localStorage.setItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`,attempt);localStorage.setItem(`HH_ASSESSMENT_TEST_SESSION_ACTIVE_${sid}`,testSessionId);url.searchParams.set('attemptId',attempt)}
 if(id==='posttest'){const attempt=token('POST',sid),preAttempt=localStorage.getItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`)||'';localStorage.setItem(`HH_ASSESSMENT_POST_ATTEMPT_${sid}`,attempt);url.searchParams.set('attemptId',attempt);if(preAttempt)url.searchParams.set('preAttemptId',preAttempt)}
 location.assign(url.href);
};
window.HHAssessmentRouteLauncher={version:RELEASE,studyId:STUDY_ID,localRoutes:LOCAL_ROUTES};
})();