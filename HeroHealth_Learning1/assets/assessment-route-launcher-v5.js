(()=>{
'use strict';
const RELEASE='20260908-HEROHEALTH-RESEARCH-FLOW-R28-NEW-PATH-NONBLOCKING';
const APP_RELEASE='20260908-PASSPORT-R58-ROUTE-R28-NEW-PATH';
const STATE_KEY='herohealth_learning_platform_rc2';
const STUDY_ID='HEROHEALTH-P5-2026';
const SANDBOX_STUDENT_IDS=new Set(Array.from({length:29},(_,i)=>String(990001+i)));
const isSandboxStudent=sid=>SANDBOX_STUDENT_IDS.has(String(sid||'').trim());
const ASSESSMENT_ROUTES={
 pretest:'./assessment/pretest-firebase.html?v=20260908-research-grade',
 posttest:'./assessment/posttest-firebase.html?v=20260908-research-grade',
 postexperience:'./assessment/post-experience-firebase-r5.html?v=20260908-permission-fix',
 reflection:'./assessment/reflection-firebase-r7.html?v=20260908-r8-create-first',
 followup:'./assessment/followup-firebase.html?v=20260818-hh-fu01-r3-atomic-strict'
};
const COMMON_ROUTES={certificate:'./assessment/mission-summary-firebase-r10.html?v=20260818-r10-strict-firebase'};
if(!window.HH||typeof window.HH.openRoute!=='function')return;
const baseOpenRoute=window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__||window.HH.openRoute.bind(window.HH);window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__=baseOpenRoute;
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function hash(str){let h=2166136261>>>0;for(const ch of String(str??'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function stableAttempt(prefix,sid){return `${prefix}-${sid}-${hash(`${STUDY_ID}|${prefix}|${sid}`).toString(36).toUpperCase()}`}
function sessionId(sid){const key=`HH_ASSESSMENT_STUDY_SESSION_${STUDY_ID}_${sid}`;let value='';try{value=localStorage.getItem(key)||''}catch(_){}if(!value){value=`HH-STUDY-${hash(`${STUDY_ID}|${sid}`).toString(36).toUpperCase()}`;try{localStorage.setItem(key,value)}catch(_){}}return value}
function smokeMode(url=location.href){const q=new URL(url,location.href).searchParams;return /^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))}
function acceptedAuthorityRelease(){return true}
function firebaseReady(s){
 const profileSid=String(s?.profile?.studentId||'').trim();
 const q=new URLSearchParams(location.search);
 const urlIds=['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean);
 const urlIdentityOK=urlIds.length===0||urlIds.every(id=>id===profileSid);
 return Boolean(profileSid&&urlIdentityOK);
}
function passportReturn(sid,profile,smoke){const u=new URL('./index.html',location.href);u.searchParams.set('authority','firebase');u.searchParams.set('studentId',sid);u.searchParams.set('sid',sid);u.searchParams.set('firebaseReady','1');u.searchParams.set('appv',APP_RELEASE);u.searchParams.set('authorityRefresh',String(Date.now()));if(profile.fullName)u.searchParams.set('fullName',profile.fullName);if(smoke)u.searchParams.set('smoke','1');return u}
window.HH.openRoute=function(id){
 const s=state(),profile=s.profile||{};
 if(!profile.studentId)return baseOpenRoute(id);
 const route=COMMON_ROUTES[id]||ASSESSMENT_ROUTES[id];if(!route)return baseOpenRoute(id);
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
window.HHAssessmentRouteLauncher={version:RELEASE,appRelease:APP_RELEASE,studyId:STUDY_ID,firebaseRoutes:ASSESSMENT_ROUTES,commonRoutes:COMMON_ROUTES,stableAttempt,smokeMode,isSandboxStudent,firebaseReady,acceptedAuthorityRelease};console.info('[HeroHealth Assessment Route] R28 new-path nonblocking launcher installed',RELEASE,APP_RELEASE);
})();