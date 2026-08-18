(()=>{
'use strict';
const RELEASE='20260818-HEROHEALTH-RESEARCH-FLOW-R19-STRICT-FIREBASE';
const APP_RELEASE='20260818-PASSPORT-R25-STRICT-RESEARCH-FLOW';
const STATE_KEY='herohealth_learning_platform_rc2';
const STUDY_ID='HEROHEALTH-P5-2026';
const SANDBOX_STUDENT_IDS=new Set(Array.from({length:29},(_,i)=>String(990001+i)));
const isSandboxStudent=sid=>SANDBOX_STUDENT_IDS.has(String(sid||'').trim());
const ASSESSMENT_ROUTES={
 pretest:'./assessment/pretest-firebase.html?v=20260818-pretest-r5-strict-gate',
 posttest:'./assessment/posttest-firebase.html?v=20260818-posttest-r5-strict-gate',
 postexperience:'./assessment/post-experience-firebase-r5.html?v=20260818-r5-atomic-strict-gate',
 reflection:'./assessment/reflection-firebase-r7.html?v=20260818-r7-atomic-strict-gate',
 followup:'./assessment/followup-firebase.html?v=20260814-hh-fu01-r2-receipt'
};
const COMMON_ROUTES={certificate:'./assessment/mission-summary-firebase-r10.html?v=20260818-r10-strict-firebase'};
if(!window.HH||typeof window.HH.openRoute!=='function')return;
const baseOpenRoute=window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__||window.HH.openRoute.bind(window.HH);window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__=baseOpenRoute;
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function hash(str){let h=2166136261>>>0;for(const ch of String(str??'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function stableAttempt(prefix,sid){return `${prefix}-${sid}-${hash(`${RELEASE}|${STUDY_ID}|${prefix}|${sid}`).toString(36).toUpperCase()}`}
function sessionId(sid){const key=`HH_ASSESSMENT_STUDY_SESSION_${STUDY_ID}_${sid}`;let value='';try{value=localStorage.getItem(key)||''}catch(_){}if(!value){value=`HH-STUDY-${hash(`${STUDY_ID}|${sid}`).toString(36).toUpperCase()}`;try{localStorage.setItem(key,value)}catch(_){}}return value}
function smokeMode(url=location.href){const q=new URL(url,location.href).searchParams;return /^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))}
function firebaseReady(s){return window.__HH_FIREBASE_AUTHORITY_READY__===true&&String(s?.firebaseAuthority?.mode||'').toLowerCase()==='firebase'&&String(s?.firebaseAuthority?.sourceOfTruth||'')==='Cloud Firestore'}
function passportReturn(sid,profile,smoke){const u=new URL('./index.html',location.href);u.searchParams.set('authority','firebase');u.searchParams.set('studentId',sid);u.searchParams.set('sid',sid);u.searchParams.set('firebaseReady','1');u.searchParams.set('appv',APP_RELEASE);u.searchParams.set('authorityRefresh',String(Date.now()));if(profile.fullName)u.searchParams.set('fullName',profile.fullName);if(smoke)u.searchParams.set('smoke','1');return u}
window.HH.openRoute=function(id){
 const s=state(),profile=s.profile||{},authority=String(new URLSearchParams(location.search).get('authority')||window.HH_AUTHORITY_MODE||'firebase').toLowerCase();
 if(!profile.studentId)return baseOpenRoute(id);
 const route=COMMON_ROUTES[id]||ASSESSMENT_ROUTES[id];if(!route)return baseOpenRoute(id);
 if(authority==='firebase'&&!firebaseReady(s)){alert('กำลังตรวจความคืบหน้าจาก Firebase กรุณารอสักครู่ หรือเข้าสู่ระบบใหม่');return}
 const sid=String(profile.studentId).trim(),url=new URL(route,location.href),testSessionId=sessionId(sid),smoke=smokeMode();
 url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.delete('pid');url.searchParams.set('fullName',profile.fullName||'');url.searchParams.set('section',profile.section||'');url.searchParams.set('group',profile.group||s.group||'');url.searchParams.set('studyId',STUDY_ID);url.searchParams.set('testSessionId',testSessionId);url.searchParams.set('authority','firebase');if(s?.firebaseAuthority?.uid)url.searchParams.set('firebaseUid',s.firebaseAuthority.uid);if(smoke)url.searchParams.set('smoke','1');
 let returnUrl;
 if(id==='posttest'){
  returnUrl=new URL('./assessment/post-experience-firebase-r5.html',location.href);
  for(const [k,v] of Object.entries({studentId:sid,sid,fullName:profile.fullName||'',section:profile.section||'',group:profile.group||s.group||'',studyId:STUDY_ID,testSessionId,authority:'firebase'}))if(v)returnUrl.searchParams.set(k,v);
  returnUrl.searchParams.set('return',passportReturn(sid,profile,smoke).href);returnUrl.searchParams.set('v',RELEASE);returnUrl.searchParams.set('appv',APP_RELEASE);
 }else{returnUrl=passportReturn(sid,profile,smoke)}
 url.searchParams.set('return',returnUrl.href);url.searchParams.set('routeRelease',RELEASE);url.searchParams.set('appv',APP_RELEASE);url.searchParams.set('_',Date.now());
 if(id==='pretest'){const attempt=stableAttempt('PRE',sid);try{localStorage.setItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`,attempt);localStorage.setItem(`HH_ASSESSMENT_TEST_SESSION_ACTIVE_${sid}`,testSessionId)}catch(_){}url.searchParams.set('attemptId',attempt)}
 if(id==='posttest'){const attempt=stableAttempt('POST',sid),preAttempt=localStorage.getItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`)||stableAttempt('PRE',sid);try{localStorage.setItem(`HH_ASSESSMENT_POST_ATTEMPT_${sid}`,attempt)}catch(_){}url.searchParams.set('attemptId',attempt);url.searchParams.set('preAttemptId',preAttempt)}
 location.assign(url.href);
};
window.HHAssessmentRouteLauncher={version:RELEASE,appRelease:APP_RELEASE,studyId:STUDY_ID,firebaseRoutes:ASSESSMENT_ROUTES,commonRoutes:COMMON_ROUTES,stableAttempt,smokeMode,isSandboxStudent,firebaseReady};console.info('[HeroHealth Assessment Route] strict Firebase research flow installed',RELEASE,APP_RELEASE);
})();