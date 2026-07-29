(()=>{
'use strict';
const RELEASE='20260729-ASSESSMENT-ROUTE-IDENTITY-ATTEMPT-V4';
const STATE_KEY='herohealth_learning_platform_rc2';
const original=window.HH?.openRoute;
if(!window.HH||typeof original!=='function')return;
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function token(prefix,sid){
 const random=globalThis.crypto?.getRandomValues?Array.from(globalThis.crypto.getRandomValues(new Uint32Array(2))).map(v=>v.toString(36)).join(''):Math.random().toString(36).slice(2);
 return `${prefix}-${sid}-${Date.now()}-${random}`;
}
window.HH.openRoute=function(id){
 const C=window.HH_CONFIG||{},s=state(),profile=s.profile||{};
 if(!profile.studentId)return original.call(window.HH,id);
 const route=C.routes?.[id];
 if(!route||String(route).startsWith('#'))return original.call(window.HH,id);
 const url=new URL(route,location.href),sid=String(profile.studentId).trim();
 url.searchParams.set('studentId',sid);
 url.searchParams.set('sid',sid);
 url.searchParams.set('fullName',profile.fullName||'');
 url.searchParams.set('section',profile.section||'');
 url.searchParams.set('group',profile.group||s.group||'');
 url.searchParams.set('return',location.href);
 url.searchParams.set('routeRelease',RELEASE);
 if(id==='pretest'){
  const attempt=token('PRE',sid);
  localStorage.setItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`,attempt);
  url.searchParams.set('attemptId',attempt);
 }
 if(id==='posttest'){
  const attempt=token('POST',sid);
  localStorage.setItem(`HH_ASSESSMENT_POST_ATTEMPT_${sid}`,attempt);
  const preAttempt=localStorage.getItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`)||'';
  url.searchParams.set('attemptId',attempt);
  if(preAttempt)url.searchParams.set('preAttemptId',preAttempt);
 }
 location.href=url.href;
};
window.HHAssessmentRouteLauncher={version:RELEASE};
})();